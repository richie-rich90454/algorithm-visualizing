/**
 * scaled-dot-product-attention.ts - Scaled Dot-Product Attention
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Each query is compared with every key by a dot product, scaled by the square
 * root of the key dimension to keep the scores from saturating the softmax.
 * The resulting row-stochastic weights then take a weighted average of the
 * values. This is the attention operation at the heart of the transformer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 * d) for n queries and keys of dimension d
 *   Space: O(n^2) for the score and weight matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - First the n by n attention-weight matrix is revealed one query row at a
 *     time; each row is highlighted while it is computed.
 *   - Then the n by d output matrix is revealed one row at a time.
 *   - All drawable objects are grid cells carrying their row and column.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Numerically stable softmax over one row of scores. */
export function softmax(row: number[]): number[] {
    if (row.length === 0) {
        return [];
    }
    const max = Math.max(...row);
    const exps = row.map((value) => Math.exp(value - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    return exps.map((value) => value / total);
}

/** Compute scores, softmax weights, and the attention output. */
export function attention(Q: number[][], K: number[][], V: number[][]) {
    const n = Q.length;
    const d = K[0]?.length ?? 1;
    const scale = Math.sqrt(d);
    const scores: number[][] = [];
    const weights: number[][] = [];
    const output: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        const query = Q[i] ?? [];
        const row: number[] = [];
        for (let j = 0; j < K.length; j += 1) {
            const key = K[j] ?? [];
            let dot = 0;
            for (let k = 0; k < d; k += 1) {
                dot += (query[k] ?? 0) * (key[k] ?? 0);
            }
            row.push(dot / scale);
        }
        scores.push(row);
        const w = softmax(row);
        weights.push(w);
        const outRow: number[] = [];
        const outDim = V[0]?.length ?? 0;
        for (let k = 0; k < outDim; k += 1) {
            let value = 0;
            for (let j = 0; j < V.length; j += 1) {
                value += (w[j] ?? 0) * ((V[j] ?? [])[k] ?? 0);
            }
            outRow.push(value);
        }
        output.push(outRow);
    }
    return { scores, weights, output };
}

/** Build grid cells for a matrix, revealing rows up to `revealed`. */
function makeCells(
    matrix: number[][],
    revealed: number,
    current: number,
): VisualEntity[] {
    const cols = matrix[0]?.length ?? 0;
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const shown = row < revealed;
            const state: EntityState = row === current ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? (matrix[row]?.[col] ?? 0).toFixed(2) : "?",
                value: shown ? (matrix[row]?.[col] ?? 0) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

/** The scaled dot-product attention generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { queries?: number[][]; keys?: number[][]; values?: number[][] } | null
    ) ?? {};
    const Q: number[][] = task.queries ?? [
        [1, 0],
        [0, 1],
    ];
    const K: number[][] = task.keys ?? [
        [1, 0],
        [0, 1],
    ];
    const V: number[][] = task.values ?? [
        [1, 0],
        [0, 1],
    ];
    const { scores, weights, output } = attention(Q, K, V);
    const n = weights.length;
    const outDim = output[0]?.length ?? 0;
    const flatten = (matrix: number[][]): number[] => matrix.reduce<number[]>((acc, row) => acc.concat(row), []);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(weights, 0, -1),
        edges: [],
        description: `Attention over ${n} queries and ${K.length} keys with dimension ${K[0]?.length ?? 0}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { phase: "weights", rows: n, cols: K.length, n, d: K[0]?.length ?? 0 },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(weights, i + 1, i),
            edges: [],
            description: `Query ${i}: scores ${(scores[i] ?? []).map((score) => score.toFixed(2)).join(", ")}; softmax weights ${(weights[i] ?? []).map((weight) => weight.toFixed(2)).join(", ")}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                phase: "weights",
                rows: n,
                cols: K.length,
                n,
                d: K[0]?.length ?? 0,
                weights: flatten(weights),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(output, 0, -1),
        edges: [],
        description: "Attention weights are row-stochastic; now take the weighted average of the values.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { phase: "output", rows: n, cols: outDim, n, d: outDim, weights: flatten(weights) },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(output, i + 1, i),
            edges: [],
            description: `Output row ${i}: ${(output[i] ?? []).map((value) => value.toFixed(3)).join(", ")}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                phase: "output",
                rows: n,
                cols: outDim,
                n,
                d: outDim,
                output: flatten(output),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(output, n, -1),
        edges: [],
        description: `Done: attention output shape ${n} by ${outDim}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            phase: "output",
            rows: n,
            cols: outDim,
            n,
            d: outDim,
            output: flatten(output),
            weights: flatten(weights),
            converged: true,
        },
    };
}

/** The scaled dot-product attention module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Turn each query and key into a dot-product similarity score, divide by the square root of the dimension so the scores stay in a useful range, and softmax each row into probabilities. Each output is the probability-weighted mix of the values, so a query pulls most from the keys it attends to most strongly.",
        invariants: [
            "The scale factor is the square root of the key dimension.",
            "Every row of the attention-weight matrix sums to one.",
            "Each output row is a convex combination of the value rows.",
        ],
        correctness:
            "The dot product measures alignment between a query and a key; scaling prevents large magnitudes from making the softmax nearly one-hot. Softmax normalizes each row into a valid probability distribution, and multiplying by the values computes the expected value under that distribution, which is exactly the defined attention output.",
        complexityRationale:
            "Computing all n by n scores costs O(n^2 * d) multiply-adds, the softmaxes cost O(n^2), and forming the output costs O(n^2 * d). Storing scores and weights uses O(n^2) space.",
        uses: [
            "Self-attention and cross-attention in transformer models",
            "Machine translation and text generation",
            "Cross-modal retrieval that aligns text with images",
        ],
        references: [
            "Vaswani et al., Attention Is All You Need, NeurIPS 2017",
            "Bahdanau, Cho, and Bengio, Neural Machine Translation by Jointly Learning to Align, ICLR 2015",
        ],
        workedExample:
            "With identity queries and keys, the scaled scores are the identity matrix divided by the square root of two. Softmax turns each row into about 0.73 on the matching key and 0.27 on the other, so each output row is 0.73 of its own value plus 0.27 of the other.",
    },
    id: "scaled-dot-product-attention",
    name: "Scaled Dot-Product Attention",
    category: "ml-ai",
    complexity: { time: "O(n^2 * d)", space: "O(n^2)" },
    defaultInput: {
        queries: [
            [1, 0],
            [0, 1],
        ],
        keys: [
            [1, 0],
            [0, 1],
        ],
        values: [
            [1, 0],
            [0, 1],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "let scale be the square root of the key dimension",
        "for each query compute scaled dot products with all keys",
        "apply softmax to each row of scaled scores",
        "multiply the weight matrix by the value matrix",
        "each output row is a weighted sum of the value rows",
        "done: report the attention output matrix",
    ],
};

export default module;
