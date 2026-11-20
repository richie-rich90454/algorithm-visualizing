/**
 * transformer-block.ts - One Transformer Encoder Block (Numeric Demo)
 *
 * A fully worked single-head block: scaled dot-product attention, a residual
 * connection, layer normalization, and a small ReLU feed-forward network. The
 * matrices are small enough that every number is computed exactly.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface Input {
    Q: Matrix;
    K: Matrix;
    V: Matrix;
    W: Matrix;
    b: number[];
}

function transpose(m: Matrix): Matrix {
    return m[0]?.map((_, col) => m.map((row) => row[col] ?? 0)) ?? [];
}

function multiply(a: Matrix, b: Matrix): Matrix {
    return a.map((row) =>
        b[0]?.map((_, col) => row.reduce((acc, value, k) => acc + value * (b[k]?.[col] ?? 0), 0)) ?? [],
    );
}

function softmaxRow(row: number[]): number[] {
    const max = Math.max(...row);
    const exps = row.map((v) => Math.exp(v - max));
    const total = exps.reduce((a, b) => a + b, 0) || 1;
    return exps.map((v) => v / total);
}

function layerNormRow(row: number[]): number[] {
    const mean = row.reduce((a, b) => a + b, 0) / Math.max(1, row.length);
    const variance = row.reduce((acc, v) => acc + (v - mean) ** 2, 0) / Math.max(1, row.length);
    const std = Math.sqrt(variance) || 1;
    return row.map((v) => (v - mean) / std);
}

function cells(matrix: Matrix, state: "active" | "sorted" | "path" | "comparing"): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < (matrix[row]?.length ?? 0); col += 1) {
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: (matrix[row]?.[col] ?? 0).toFixed(3),
                value: matrix[row]?.[col] ?? 0,
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

function shape(m: Matrix): [number, number] {
    return [m.length, m[0]?.length ?? 0];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<Input> | null) ?? {};
    const cfg: Input = {
        Q: task.Q ?? [
            [1, 0],
            [0, 1],
        ],
        K: task.K ?? [
            [1, 1],
            [0, 1],
        ],
        V: task.V ?? [
            [1, 2],
            [3, 4],
        ],
        W: task.W ?? [
            [1, -1],
            [1, 1],
        ],
        b: task.b ?? [0, 0],
    };
    const dk = Math.max(1, cfg.Q[0]?.length ?? 1);
    const scale = Math.sqrt(dk);
    const scores = multiply(cfg.Q, transpose(cfg.K)).map((row) => row.map((v) => v / scale));
    const attention = scores.map(softmaxRow);
    const attnOut = multiply(attention, cfg.V);
    const residual = attnOut.map((row, i) => row.map((v, j) => v + (cfg.Q[i]?.[j] ?? 0)));
    const normalized = residual.map(layerNormRow);
    const projected = multiply(normalized, cfg.W);
    const output = projected.map((row) => row.map((v, j) => Math.max(0, v + (cfg.b[j] ?? 0))));

    const [scoreRows, scoreCols] = shape(scores);
    const [outRows, outCols] = shape(output);
    const rowSums = attention.map((row) => row.reduce((a, b) => a + b, 0));

    yield {
        stepNumber: 0,
        entities: cells(scores, "comparing"),
        edges: [],
        description: `Scaled dot-product scores = Q K^T / sqrt(${dk}).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: scoreRows, cols: scoreCols, phase: "scores", rowSums: [] },
    };
    yield {
        stepNumber: 1,
        entities: cells(attention, "active"),
        edges: [],
        description: "Softmax over each query row turns scores into attention weights that sum to one.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: scoreRows, cols: scoreCols, phase: "attention", rowSums: rowSums.map((v) => Number(v.toFixed(8))) },
    };
    yield {
        stepNumber: 2,
        entities: cells(attnOut, "sorted"),
        edges: [],
        description: "Multiplying attention by V produces the context vectors for each query.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: scoreRows, cols: outCols, phase: "context", rowSums: [] },
    };
    yield {
        stepNumber: 3,
        entities: cells(normalized, "path"),
        edges: [],
        description: "Adding the residual and applying layer normalization centers and scales each row.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: scoreRows, cols: outCols, phase: "norm", rowSums: [] },
    };
    yield {
        stepNumber: 4,
        entities: cells(output, "sorted"),
        edges: [],
        description: "A ReLU feed-forward layer gives the final output of the transformer block.",
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: outRows,
            cols: outCols,
            phase: "output",
            rowSums: [],
            outputRow0: (output[0] ?? []).map((v) => Number(v.toFixed(8))),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A transformer block lets each token look at every other token, weigh how relevant each one is, and mix their information together. It then refines the result with a small feed-forward network, using residual connections and normalization to keep training stable.",
        invariants: [
            "Attention weights in each row are nonnegative and sum to one.",
            "The context vector is a weighted sum of the value vectors.",
            "Layer normalization gives each output row mean zero and variance one.",
        ],
        correctness:
            "Scaled dot-product attention computes scores Q K^T / sqrt(d) and applies a row-wise softmax, which by construction yields a probability distribution per query. Multiplying by V is exactly the weighted sum of values. Layer normalization subtracts the row mean and divides by the row standard deviation, so the normalized row has mean zero and variance one; the feed-forward step then applies the elementwise ReLU.",
        complexityRationale:
            "With n tokens of width d, the Q K^T and attention-V products each cost O(n^2 * d), and the feed-forward layer costs O(n * d * d_ff), giving O(n^2 * d + n * d * d_ff) time and O(n^2) space for the attention matrix.",
        uses: [
            "Encoder and decoder layers of large language models",
            "Machine translation and text summarization",
            "Vision transformers that attend over image patches",
        ],
        references: [
            "Vaswani et al., Attention Is All You Need, 2017",
            "Ba, Kiros, and Hinton, Layer Normalization, 2016",
        ],
        workedExample:
            "With Q = [[1,0],[0,1]] and K = [[1,1],[0,1]], the scaled scores are [[0.71,0.71],[0,0.71]]. The softmax rows weight the two keys, the context is their blend with V, and the feed-forward layer produces the final two-number output shown in the last frame.",
    },
    id: "transformer-block",
    name: "Transformer Block",
    category: "ml-ai",
    complexity: { time: "O(n^2 * d + n * d * d_ff)", space: "O(n^2)" },
    defaultInput: {
        Q: [
            [1, 0],
            [0, 1],
        ],
        K: [
            [1, 1],
            [0, 1],
        ],
        V: [
            [1, 2],
            [3, 4],
        ],
        W: [
            [1, -1],
            [1, 1],
        ],
        b: [0, 0],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compute scores as Q times K transposed divided by square root of the key width",
        "apply softmax to each row of scores to get attention weights",
        "multiply the attention weights by V to get context vectors",
        "add the input residuals to the context vectors",
        "apply layer normalization to each row",
        "multiply by the feed-forward weights, add bias, and apply ReLU",
        "done: report the block output",
    ],
};

export default module;
