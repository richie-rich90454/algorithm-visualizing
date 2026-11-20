/**
 * sliding-window-attention.ts - Sliding-Window (Local) Attention Mask
 *
 * Teachable core: this module implements the windowed causal attention mask
 * used by long-context transformers, not a full production attention kernel.
 * Each query at position i attends only to keys in [i-w+1, i]; all other
 * positions are masked to zero before a row softmax.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Numerically stable softmax over a single row of scores. */
export function softmax(row: number[]): number[] {
    if (row.length === 0) {
        return [];
    }
    const max = Math.max(...row);
    const exps = row.map((value) => Math.exp(value - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    return exps.map((value) => value / total);
}

export interface WindowAttention {
    weights: number[][];
    output: number[][];
    mask: boolean[][];
}

/** Compute windowed causal attention for queries, keys, and values. */
export function windowedAttention(
    Q: number[][],
    K: number[][],
    V: number[][],
    window: number,
): WindowAttention {
    const n = Q.length;
    const d = K[0]?.length ?? 1;
    const scale = Math.sqrt(d);
    const outDim = V[0]?.length ?? 0;
    const mask: boolean[][] = [];
    const weights: number[][] = [];
    const output: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        const lo = Math.max(0, i - window + 1);
        const rowMask: boolean[] = Array.from({ length: K.length }, (_, j) => j >= lo && j <= i);
        const rowScores: number[] = [];
        for (let j = lo; j <= i && j < K.length; j += 1) {
            const query = Q[i] ?? [];
            const key = K[j] ?? [];
            let dot = 0;
            for (let k = 0; k < d; k += 1) {
                dot += (query[k] ?? 0) * (key[k] ?? 0);
            }
            rowScores.push(dot / scale);
        }
        const probs = softmax(rowScores);
        const rowWeights: number[] = Array(K.length).fill(0);
        let p = 0;
        for (let j = lo; j <= i && j < K.length; j += 1) {
            rowWeights[j] = probs[p] ?? 0;
            p += 1;
        }
        const outRow: number[] = [];
        for (let k = 0; k < outDim; k += 1) {
            let value = 0;
            for (let j = 0; j < V.length; j += 1) {
                value += (rowWeights[j] ?? 0) * ((V[j] ?? [])[k] ?? 0);
            }
            outRow.push(value);
        }
        mask.push(rowMask);
        weights.push(rowWeights);
        output.push(outRow);
    }
    return { weights, output, mask };
}

/** Build the n by n weight-grid cells, revealing rows up to `revealed`. */
function makeCells(weights: number[][], revealed: number, current: number): VisualEntity[] {
    const cols = weights[0]?.length ?? 0;
    const entities: VisualEntity[] = [];
    for (let row = 0; row < weights.length; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const shown = row < revealed;
            const weight = weights[row]?.[col] ?? 0;
            const state: EntityState = row === current ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? weight.toFixed(2) : "?",
                value: shown ? weight : 0,
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        queries?: number[][];
        keys?: number[][];
        values?: number[][];
        window?: number;
    } | null) ?? {};
    const Q: number[][] = task.queries ?? [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, -1],
    ];
    const K: number[][] = task.keys ?? Q;
    const V: number[][] = task.values ?? Q;
    const window = typeof task.window === "number" ? Math.max(1, Math.floor(task.window)) : 2;
    const { weights, output } = windowedAttention(Q, K, V, window);
    const n = weights.length;
    const cols = weights[0]?.length ?? 0;
    const outDim = output[0]?.length ?? 0;
    const flatten = (m: number[][]): number[] => m.reduce<number[]>((acc, row) => acc.concat(row), []);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(weights, 0, -1),
        edges: [],
        description: `Windowed causal attention over ${n} positions with window ${window} (teaching core of a long-context attention mask).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { phase: "weights", rows: n, cols, n, window },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const lo = Math.max(0, i - window + 1);
        yield {
            stepNumber: step,
            entities: makeCells(weights, i + 1, i),
            edges: [],
            description: `Query ${i} attends only to keys ${lo}..${i}; masked positions stay zero, and the allowed row softmax sums to one.`,
            codeLineNumber: i === 0 ? 1 : 2,
            layout: "grid",
            meta: { phase: "weights", rows: n, cols, n, window, weights: flatten(weights) },
        };
        step += 1;
    }

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(output, i + 1, i),
            edges: [],
            description: `Output ${i}: weighted average of values in the window = ${(output[i] ?? []).map((v) => v.toFixed(2)).join(", ")}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { phase: "output", rows: n, cols: outDim, n, window, output: flatten(output), weights: flatten(weights) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(output, n, -1),
        edges: [],
        description: `Done: ${n} outputs computed, each using at most ${window} local keys.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { phase: "output", rows: n, cols: outDim, n, window, output: flatten(output), weights: flatten(weights), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Full attention compares every token with every other token, which is quadratic in sequence length. Sliding-window attention keeps only a fixed-size band around the diagonal: a query looks at the current and previous few tokens. Masking the rest to zero makes the cost linear in the sequence length for a fixed window.",
        invariants: [
            "A query at position i can attend only to keys j with i-w+1 <= j <= i.",
            "Masked weights are exactly zero, and each query row of allowed weights sums to one.",
            "Each output row is a convex combination of the value rows inside the window.",
        ],
        correctness:
            "The mask sets disallowed scores to zero weight before normalization, so softmax is applied only over the allowed positions, which by construction form a valid probability distribution. Multiplying these weights by the values gives the defined local attention output; the computation is a direct evaluation of the masked-attention definition.",
        complexityRationale:
            "Each of the n queries scores at most w keys of dimension d and mixes at most w values, giving O(n*w*d) time and O(n*w) stored weights instead of O(n^2). A fixed window makes this linear in n.",
        uses: [
            "Long-context language models that cannot afford quadratic attention",
            "Streaming generation with a bounded key-value cache",
            "Local inductive biases in audio and time-series transformers",
        ],
        references: [
            "Beltagy, Peters, and Cohan, Longformer: The Long-Document Transformer, 2020",
            "Child et al., Generating Long Sequences with Sparse Transformers, 2019",
        ],
        workedExample:
            "With four positions, window two, and identity keys, query 2 attends only to keys 1 and 2. Its two scaled scores are 0 and 1/sqrt(2), so softmax yields about 0.39 and 0.61 on those keys and exactly zero everywhere else.",
    },
    id: "sliding-window-attention",
    name: "Sliding Window Attention",
    category: "ml-ai",
    complexity: { time: "O(n*w*d)", space: "O(n*w)" },
    defaultInput: {
        queries: [[1, 0], [0, 1], [1, 1], [0, -1]],
        keys: [[1, 0], [0, 1], [1, 1], [0, -1]],
        values: [[1, 0], [0, 1], [1, 1], [0, -1]],
        window: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "fix window w and scale by square root of key dimension",
        "for each query position i set the window start to max(0, i-w+1)",
        "score query i against keys in the window only",
        "apply softmax to the in-window scores",
        "write zero weights to every masked position",
        "multiply the weights by the values in the window",
        "done: emit all local attention outputs",
    ],
};

export default module;
