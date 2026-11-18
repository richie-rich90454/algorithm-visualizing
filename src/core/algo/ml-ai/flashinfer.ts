/**
 * flashinfer.ts - Online Softmax Attention Over a Paged KV Cache
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * FlashInfer is a library for efficient LLM inference, not one algorithm. Its
 * teachable core is paged attention with a streaming (online) softmax: keys and
 * values live in fixed-size pages, and a query is answered by walking the pages
 * while keeping a running maximum, running denominator, and running weighted
 * sum. This avoids materializing all attention scores at once. The toy uses one
 * scalar query and scalar keys, so the math is exact and independently
 * checkable; it is not a GPU kernel or a production attention implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n cached tokens, one pass over the pages
 *   Space: O(1) extra state plus the n cached key/value slots
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells are cached tokens arranged by page (row) and slot (column).
 *   - The current token is ACTIVE; processed tokens are SORTED.
 *   - The running max, denominator, and attention output are reported in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FlashInferInput {
    query?: number;
    keys?: number[];
    values?: number[];
    pageSize?: number;
}

/** Build the paged KV-cache cells for a frame. */
function makeCells(
    values: number[],
    pageSize: number,
    current: number,
    processed: number,
): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (index < processed) {
            state = "sorted";
        } else if (index === current) {
            state = "active";
        }
        return {
            id: `token-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: Math.floor(index / pageSize), col: index % pageSize, index },
        };
    });
}

/** Run online softmax over the paged cache. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FlashInferInput | null) ?? {};
    const query = typeof task.query === "number" ? task.query : 2;
    const keys = Array.isArray(task.keys) ? task.keys : [1, 2, 3, 4];
    const values = Array.isArray(task.values) && task.values.length === keys.length
        ? task.values
        : keys.map((_, index) => index + 1);
    const pageSize = typeof task.pageSize === "number" && task.pageSize > 0
        ? Math.floor(task.pageSize)
        : 2;
    const pages = keys.length > 0 ? Math.ceil(keys.length / pageSize) : 1;

    let maxScore = -Infinity;
    let denom = 0;
    let acc = 0;
    let step = 0;

    const frame = (
        current: number,
        processed: number,
        description: string,
        codeLineNumber: number,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(values, pageSize, current, processed),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: {
            rows: pages,
            cols: pageSize,
            query,
            pageSize,
            maxScore: Number.isFinite(maxScore) ? maxScore : 0,
            denom,
            output: denom > 0 ? acc / denom : 0,
            processed,
        },
    });

    yield frame(-1, 0, `Paged KV cache with ${keys.length} token(s) in ${pages} page(s); online softmax starts.`, 0);

    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i] ?? 0;
        const value = values[i] ?? 0;
        const score = query * key;
        const nextMax = Math.max(maxScore, score);
        const scale = maxScore === -Infinity ? 0 : Math.exp(maxScore - nextMax);
        const weight = Math.exp(score - nextMax);
        denom = denom * scale + weight;
        acc = acc * scale + weight * value;
        maxScore = nextMax;
        yield frame(
            i,
            i + 1,
            `Page ${Math.floor(i / pageSize)}, slot ${i % pageSize}: score ${score}, running max ${maxScore}, output ${acc / denom}.`,
            2,
        );
    }

    const output = denom > 0 ? acc / denom : 0;
    yield frame(-1, keys.length, `Attention output ${output} after streaming all ${keys.length} token(s).`, 5);
}

/** The FlashInfer teaching-core module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of scoring every cached token at once, paged attention walks the key/value cache page by page and folds each token into a running summary. A running maximum rescales earlier contributions so exponentials never overflow, and a running denominator and weighted sum finish the softmax. The result is identical to ordinary attention but needs only constant extra state.",
        invariants: [
            "The running maximum is the largest score seen so far.",
            "The denominator always equals the sum of rescaled exponential weights.",
            "After each token the ratio acc divided by denom is the softmax output over tokens seen so far.",
        ],
        correctness:
            "Let m be the running maximum. Replacing each weight exp(s_i) by exp(s_i - m) multiplies every term by the same positive constant exp(-m), which cancels in the ratio acc/denom. When m grows, rescaling the old denominator and accumulator by exp(m_old - m_new) preserves that common factor, so the final ratio equals the ordinary softmax of all scores.",
        complexityRationale:
            "Each cached token is visited once with a constant number of arithmetic operations, giving O(n) time and O(1) extra space beyond the cache. Real paged attention has the same asymptotic cost while avoiding a materialized score matrix.",
        uses: [
            "Autoregressive decoding with a paged KV cache in LLM serving",
            "Variable-length batched attention without padding waste",
            "Streaming attention where keys arrive incrementally",
        ],
        references: [
            "Kwon et al., Efficient Memory Management for Large Language Model Serving with PagedAttention, 2023",
            "Dao, Flashattention: Fast and Memory-Efficient Exact Attention with IO-Awareness, 2022",
        ],
        workedExample:
            "With query 2, keys [1, 2], values [0.5, 1], the scores are 2 and 4. Token 0 sets the running max to 2 and output 0.5. Token 1 rescales by exp(2-4), giving weights exp(-2) and 1, so the output becomes (0.5*exp(-2) + 1) / (exp(-2) + 1), matching the ordinary softmax.",
    },
    id: "flashinfer",
    name: "FlashInfer (Paged Attention Core)",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { query: 2, keys: [1, 2, 3, 4], values: [0.5, 1, 1.5, 2], pageSize: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "set running maximum to minus infinity, denominator and sum to zero",
        "for each token in the paged KV cache",
        "compute score as query times the token key",
        "grow the maximum and rescale the stored denominator and sum",
        "add the rescaled exponential weight and its value contribution",
        "continue until every page has been consumed",
        "done: divide the sum by the denominator for the attention output",
    ],
};

export default module;
