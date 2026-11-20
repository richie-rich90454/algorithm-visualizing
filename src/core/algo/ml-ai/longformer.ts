/**
 * longformer.ts - Longformer Sliding Window Attention
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Longformer scales attention to long documents by replacing the full
 * quadratic attention pattern with a fixed-size sliding window around each
 * token plus a few global tokens that attend to and from everywhere. This
 * keeps both local context and document-level information at linear cost.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * (w + g) * d) for window w and g global tokens
 *   Space: O(n * (w + g)) for the sparse attention pattern
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the boolean attention mask and the resulting attention
 *     weights, making the sliding band and global rows and columns visible.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LongformerInput {
    tokens?: number[][];
    window?: number;
    globals?: number[];
}

/** True when token i is allowed to attend to token j. */
export function longformerMask(n: number, window: number, globals: number[]): boolean[][] {
    const globalSet = new Set(globals);
    return Array.from({ length: n }, (_v, i) =>
        Array.from({ length: n }, (_w, j) =>
            Math.abs(i - j) <= window || globalSet.has(i) || globalSet.has(j)));
}

/** Masked softmax attention using the Longformer sparse pattern. */
export function longformerAttention(
    tokens: number[][],
    window: number,
    globals: number[],
): { mask: boolean[][]; weights: number[][]; output: number[][] } {
    const n = tokens.length;
    const d = tokens[0]?.length ?? 1;
    const mask = longformerMask(n, window, globals);
    const scale = Math.sqrt(d);
    const weights = tokens.map((q, i) => {
        const scores = tokens.map((k, j) =>
            (mask[i]?.[j] ? 1 : 0) *
            (q.reduce((sum, value, dim) => sum + value * (k[dim] ?? 0), 0) / scale)
            - (mask[i]?.[j] ? 0 : Infinity),
        );
        const max = Math.max(...scores.filter(Number.isFinite));
        const exps = scores.map((score) => Number.isFinite(score) ? Math.exp(score - max) : 0);
        const total = exps.reduce((a, b) => a + b, 0);
        return exps.map((value) => value / total);
    });
    const output = tokens.map((_row, i) =>
        Array.from({ length: d }, (_v, dim) =>
            weights[i]!.reduce((sum, weight, j) => sum + weight * (tokens[j]?.[dim] ?? 0), 0)));
    return { mask, weights, output };
}

function cells(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `c-${index}`,
        type: "cell" as const,
        label: value.toFixed(2),
        value: Number(value.toFixed(10)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LongformerInput | null) ?? {};
    const tokens: number[][] = task.tokens ?? [[1, 0], [0, 1], [1, 1], [0.5, 0.5], [1, 0.2], [0.2, 1]];
    const window = typeof task.window === "number" ? Math.max(0, task.window) : 1;
    const globals: number[] = task.globals ?? [0, 5];
    const { mask, weights, output } = longformerAttention(tokens, window, globals);
    const n = tokens.length;
    const maskFlat = mask.flat().map((v) => (v ? 1 : 0));
    const weightFlat = weights.flat();

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(maskFlat.map(() => 0), maskFlat.map(() => "unvisited")),
        edges: [],
        description: `Prepare ${n} tokens with a sliding window of ${window} and ${globals.length} global token(s).`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { n, window, globals, mask: [], weights: [], output: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(maskFlat, maskFlat.map((v) => v ? "active" : "idle")),
        edges: [],
        description: `Build the sparse mask: a sliding band plus global rows and columns.`,
        codeLineNumber: 1,
        layout: "matrix",
        meta: { n, window, globals, mask, weights: [], output: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(weightFlat, weightFlat.map(() => "comparing")),
        edges: [],
        description: `Apply masked softmax so each token attends only to its allowed positions.`,
        codeLineNumber: 2,
        layout: "matrix",
        meta: { n, window, globals, mask, weights: weightFlat, output: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(output.flat(), output.flat().map(() => "sorted")),
        edges: [],
        description: `Done: each token has a context vector from its sparse neighborhood.`,
        codeLineNumber: 3,
        layout: "matrix",
        meta: { n, window, globals, mask, weights: weightFlat, output: output.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Longformer makes attention practical for long documents by limiting each token to a small local window and adding a handful of global tokens that see everything. The local band captures nearby context while the global tokens carry information across the whole sequence, giving most of the benefit of full attention at a fraction of the cost.",
        invariants: [
            "A token always attends to itself and to tokens within the window radius.",
            "Global tokens attend to every position and are attended to by every position.",
            "Each row of the masked softmax weights sums to one.",
        ],
        correctness:
            "The mask is symmetric because the distance condition and the global-token condition are symmetric, so if i can see j then j can see i. Masked softmax sets disallowed scores to negative infinity, which contributes zero after exponentiation, so normalization is over exactly the allowed positions and each row sums to one. Including global rows and columns guarantees a path of length at most two between any two tokens through a global token, preserving global information flow that a pure sliding window would lose.",
        complexityRationale:
            "Each token attends to at most two times the window radius plus the number of global tokens positions, so computing all weights takes O(n (w + g) d) time. Only the sparse mask and weights are stored, using O(n (w + g)) space.",
        uses: [
            "Long-document question answering and summarization",
            "Genomic sequence modeling with thousands of tokens",
            "Efficient document classification and retrieval encoders",
        ],
        references: [
            "Beltagy, Peters and Cohan, Longformer: The Long-Document Transformer, arXiv 2020",
            "Child et al., Generating Long Sequences with Sparse Transformers, arXiv 2019",
        ],
        workedExample:
            "With six tokens, window radius one and globals at positions 0 and 5, token 3 attends only to tokens 2, 3 and 4 plus the two globals. Its attention row has five nonzero weights that sum to one, and its output is the weighted average of those five token vectors.",
    },
    id: "longformer",
    name: "Longformer (Sliding Window Attention)",
    category: "ml-ai",
    complexity: { time: "O(n (w + g) d)", space: "O(n (w + g))" },
    defaultInput: {
        tokens: [[1, 0], [0, 1], [1, 1], [0.5, 0.5], [1, 0.2], [0.2, 1]],
        window: 1,
        globals: [0, 5],
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "read tokens, window radius and global token indices",
        "for each pair allow attention if close or either token is global",
        "compute scaled dot-product scores for allowed pairs",
        "set disallowed scores to negative infinity",
        "apply softmax over allowed scores only",
        "average values with the resulting weights",
        "done: report the sparse attention output",
    ],
};

export default module;
