/**
 * gmlp.ts - gMLP Spatial Gating Unit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * gMLP replaces attention with a spatial gating unit. The input features are
 * split in half. One half is normalized across features and mixed across tokens
 * by a small learned matrix to form a gate. The other half is multiplied by
 * that gate. The product lets every token influence every other token through
 * a single linear map, which is much cheaper than a quadratic attention map.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(S * d + S^2 * d/2) for S tokens and d features
 *   Space: O(S * d) for the split and gated tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grids reveal the value half, its normalized form, the gate, and output.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface GmlpInput {
    x?: Matrix;
    spatialWeights?: Matrix;
    gamma?: number[];
    beta?: number[];
    eps?: number;
}

/** Layer normalization across the feature axis of a single token. */
export function layerNorm(row: number[], gamma: number[], beta: number[], eps: number): number[] {
    const n = row.length;
    if (n === 0) return [];
    const mean = row.reduce((a, b) => a + b, 0) / n;
    const variance = row.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / n;
    const inv = 1 / Math.sqrt(variance + eps);
    return row.map((v, i) => (v - mean) * inv * (gamma[i] ?? 1) + (beta[i] ?? 0));
}

/** Run the spatial gating unit and return each intermediate table. */
export function gmlpForward(X: Matrix, W: Matrix, gamma: number[], beta: number[], eps: number) {
    const S = X.length;
    const d = X[0]?.length ?? 0;
    const h = Math.floor(d / 2);
    const u: Matrix = X.map((row) => row.slice(0, h));
    const v: Matrix = X.map((row) => row.slice(h));
    const normV: Matrix = v.map((row) => layerNorm(row, gamma, beta, eps));
    const gate: Matrix = Array.from({ length: S }, (_, t) =>
        Array.from({ length: h }, (_, c) => {
            let sum = 0;
            for (let s = 0; s < S; s += 1) sum += (W[t]?.[s] ?? 0) * (normV[s]?.[c] ?? 0);
            return sum;
        }),
    );
    const output: Matrix = u.map((row, t) => row.map((value, c) => value * (gate[t]?.[c] ?? 0)));
    return { u, v, normV, gate, output };
}

function grid(matrix: Matrix, state: "idle" | "comparing" | "active" | "sorted"): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < (matrix[r]?.length ?? 0); c += 1) {
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: (matrix[r]?.[c] ?? 0).toFixed(3),
                value: Number((matrix[r]?.[c] ?? 0).toFixed(8)),
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GmlpInput | null) ?? {};
    const X: Matrix = task.x ?? [
        [1, 2, 0.5, -1],
        [0, -1, 2, 1],
    ];
    const W: Matrix = task.spatialWeights ?? [
        [1, 0.5],
        [0.5, 1],
    ];
    const h = Math.floor((X[0]?.length ?? 0) / 2);
    const gamma: number[] = Array.isArray(task.gamma) && task.gamma.length === h ? task.gamma : new Array(h).fill(1);
    const beta: number[] = Array.isArray(task.beta) && task.beta.length === h ? task.beta : new Array(h).fill(0);
    const eps = typeof task.eps === "number" && task.eps > 0 ? task.eps : 1e-5;
    const { u, v, normV, gate, output } = gmlpForward(X, W, gamma, beta, eps);

    let step = 0;
    yield {
        stepNumber: step,
        entities: grid(X, "idle"),
        edges: [],
        description: `Split the ${X[0]?.length ?? 0} features of each token into a value half and a gate half.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: X.length, cols: X[0]?.length ?? 0, phase: "input", x: X, u, v },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: grid(normV, "comparing"),
        edges: [],
        description: "Normalize the value half across features for every token.",
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: X.length, cols: h, phase: "normalize", x: X, normV },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: grid(gate, "active"),
        edges: [],
        description: "Mix the normalized values across tokens with the spatial gate matrix.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: X.length, cols: h, phase: "gate", x: X, normV, gate, spatialWeights: W },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: grid(output, "sorted"),
        edges: [],
        description: "Multiply the untouched half by the gate to produce the gMLP output.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: X.length, cols: h, phase: "output", x: X, gate, output, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "gMLP asks a simple question: what if a small fixed linear map across tokens were enough instead of attention? It splits each token's features, normalizes one half, and lets a spatial weight matrix mix that half across all tokens. The result becomes a gate that scales the other half, so any token can modulate any other token without building a full attention matrix.",
        invariants: [
            "Layer normalization makes each normalized token have approximately zero mean and unit variance.",
            "The gate has the same shape as the untouched half of the input.",
            "The output is the elementwise product of the untouched half and the gate.",
        ],
        correctness:
            "Layer normalization is applied directly from its definition, subtracting the token mean and dividing by the standard deviation plus epsilon before applying gain and bias. The spatial gate is a matrix product with the learned S by S weights, so each gate entry is a weighted sum over all tokens. Multiplying by the untouched half is the defining gating operation; there is no approximation, so the computed table is exactly the layer output.",
        complexityRationale:
            "Normalizing and splitting cost O(S d). The spatial matrix multiply costs O(S squared times d/2). Intermediate tables are all at most S by d, so space is O(S d).",
        uses: [
            "Attention-free language and vision models",
            "A cheap token-mixing block in efficient architectures",
            "Studying how much capacity cross-token linear mixing provides",
        ],
        references: [
            "Liu et al., Pay Attention to MLPs, NeurIPS 2021",
            "Ba et al., Layer Normalization, arXiv 2016",
        ],
        workedExample:
            "For two tokens with four features, the last two features of each token form the value half. After normalization their mean is zero. A two by two spatial matrix blends the two normalized rows, and the first two features of each token are multiplied by the corresponding blended values to give the two by two output.",
    },
    id: "gmlp",
    name: "gMLP Spatial Gating",
    category: "ml-ai",
    complexity: { time: "O(S * d + S^2 * d/2)", space: "O(S * d)" },
    defaultInput: {
        x: [
            [1, 2, 0.5, -1],
            [0, -1, 2, 1],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "split each token into an untouched half and a value half",
        "normalize the value half across features",
        "compute the gate by mixing normalized values across tokens",
        "multiply the untouched half by the gate",
        "collect the gated output table",
        "done: report the gMLP output",
    ],
};

export default module;
