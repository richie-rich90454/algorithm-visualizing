/**
 * kfac.ts - Kronecker-Factored Approximate Curvature
 *
 * KFAC approximates the Fisher information matrix of a linear layer as a
 * Kronecker product of two much smaller covariance matrices: A, the covariance
 * of layer inputs, and S, the covariance of output gradients. The natural
 * gradient direction is then obtained by whitening the ordinary gradient with
 * the two inverses, giving S^{-1} G A^{-1}. This avoids forming the full
 * weight-sized Fisher while capturing curvature along both input and output
 * axes.
 *
 * Time O(n d^2 + d^3) for small covariance dimension d; space O(d^2).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface KfacResult {
    A: number[][];
    S: number[][];
    invA: number[][];
    invS: number[][];
    grad: number[][];
    naturalGrad: number[][];
}

/** Invert a small square matrix by Gauss-Jordan elimination with pivoting. */
export function invertMatrix(matrix: number[][]): number[][] {
    const n = matrix.length;
    const aug = matrix.map((row, i) => [
        ...row,
        ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    ]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) pivot = r;
        }
        const swap = aug[col];
        aug[col] = aug[pivot];
        aug[pivot] = swap;
        const div = aug[col][col] || 1e-12;
        for (let c = 0; c < 2 * n; c += 1) aug[col][c] /= div;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const factor = aug[r][col];
            for (let c = 0; c < 2 * n; c += 1) aug[r][c] -= factor * aug[col][c];
        }
    }
    return aug.map((row) => row.slice(n));
}

function transpose(m: number[][]): number[][] {
    return m[0].map((_, c) => m.map((row) => row[c]));
}

function multiply(a: number[][], b: number[][]): number[][] {
    return a.map((row) => b[0].map((_, c) => row.reduce((sum, v, k) => sum + v * b[k][c], 0)));
}

function covariance(x: number[][]): number[][] {
    const m = x[0].length;
    const n = x.length;
    const result = Array.from({ length: m }, () => Array(m).fill(0));
    for (const row of x) {
        for (let i = 0; i < m; i += 1) {
            for (let j = 0; j < m; j += 1) result[i][j] += row[i] * row[j];
        }
    }
    return result.map((r) => r.map((v) => v / n));
}

/** Compute the KFAC factors and the natural-gradient matrix for a linear layer. */
export function kfacStep(
    x: number[][],
    dY: number[][],
    damping: number,
): KfacResult {
    const xt = transpose(x);
    const dyt = transpose(dY);
    const A = covariance(x);
    const S = covariance(dY);
    const grad = multiply(dyt, x).map((row) => row.map((v) => v / x.length));
    const dA = A.map((row, i) => row.map((v, j) => v + (i === j ? damping : 0)));
    const dS = S.map((row, i) => row.map((v, j) => v + (i === j ? damping : 0)));
    const invA = invertMatrix(dA);
    const invS = invertMatrix(dS);
    const naturalGrad = multiply(multiply(invS, grad), invA);
    return { A, S, invA, invS, grad, naturalGrad };
}

function makeCells(result: KfacResult, revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    result.naturalGrad.forEach((row, r) => {
        row.forEach((value, c) => {
            const shown = r <= revealed;
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: shown ? value.toFixed(4) : "?",
                value: shown ? value : 0,
                state: shown ? "active" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<{ x: number[][]; dY: number[][]; damping: number }> | null) ?? {};
    const x: number[][] = Array.isArray(task.x) && task.x.length > 0
        ? task.x
        : [[1, 0], [0, 1], [1, 1], [-1, 0.5]];
    const dY: number[][] = Array.isArray(task.dY) && task.dY.length > 0
        ? task.dY
        : [[0.5, -0.2], [-0.1, 0.4], [0.3, 0.2], [0, -0.5]];
    const damping = typeof task.damping === "number" ? task.damping : 1e-3;
    const result = kfacStep(x, dY, damping);
    const rows = result.naturalGrad.length;
    const cols = result.naturalGrad[0].length;
    const baseMeta = { rows, cols, damping, samples: x.length };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(result, -1),
        edges: [],
        description: `Factor the Fisher of a ${x[0].length} to ${dY[0].length} layer into input and output covariances.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, naturalGrad: result.naturalGrad.flat() },
    };
    step += 1;

    for (let i = 0; i < rows; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(result, i),
            edges: [],
            description: `Row ${i}: whiten the ordinary gradient with the damped inverse factors.`,
            codeLineNumber: i === 0 ? 2 : 3,
            layout: "grid",
            meta: { ...baseMeta, current: i, naturalGrad: result.naturalGrad.flat() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result, rows - 1),
        edges: [],
        description: "Done: the natural-gradient matrix rescales the gradient by both covariance inverses.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...baseMeta, naturalGrad: result.naturalGrad.flat(), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Second-order optimizers use curvature to take better steps, but the full Fisher matrix for a weight tensor is far too large to store. KFAC observes that for a linear layer the Fisher factors as a Kronecker product of an input covariance and an output-gradient covariance. Whitening the gradient with the two small inverses therefore approximates the full natural gradient at a fraction of the cost.",
        invariants: [
            "The input factor A equals X transpose times X divided by the sample count.",
            "The output factor S equals dY transpose times dY divided by the sample count.",
            "The natural gradient equals inv(S) times the ordinary gradient times inv(A).",
        ],
        correctness:
            "Both covariance factors are computed by the standard outer-product sum, so they match the empirical second moments exactly. A damping term is added to the diagonal before inversion to keep the matrices nonsingular. Gauss-Jordan inversion is verified in the tests by multiplying each inverse by its factor and checking that the result is the identity; the natural-gradient product is then recomputed independently and matched element by element.",
        complexityRationale:
            "Forming each covariance costs O(n d^2) for n samples and dimension d, and inverting the two small d by d matrices costs O(d^3), independent of the number of weights in the layer.",
        uses: [
            "Second-order or natural-gradient training of neural networks",
            "K-FAC optimizers in large-scale deep learning frameworks",
            "Curvature-aware approximation for fully connected and convolutional layers",
        ],
        references: [
            "Martens and Grosse, Optimizing Neural Networks with Kronecker-factored Approximate Curvature, ICML 2015",
            "Grosse and Martens, A Kronecker-factored Approximate Fisher Matrix for Convolution Layers, ICML 2016",
        ],
        workedExample:
            "For four input rows with two features, A is the two by two average of outer products of the rows. With a damping of 0.001 the damped inverse of A times A is nearly the identity. Multiplying the ordinary gradient on the left by inv(S) and on the right by inv(A) yields the natural-gradient matrix shown in the visualization.",
    },
    id: "kfac",
    name: "KFAC",
    category: "ml-ai",
    complexity: { time: "O(n d^2 + d^3)", space: "O(d^2)" },
    defaultInput: {
        x: [[1, 0], [0, 1], [1, 1], [-1, 0.5]],
        dY: [[0.5, -0.2], [-0.1, 0.4], [0.3, 0.2], [0, -0.5]],
        damping: 0.001,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "form input covariance A from layer activations",
        "form output covariance S from upstream gradients",
        "compute the ordinary weight gradient",
        "add damping and invert A and S",
        "multiply the gradient by inv S on the left",
        "multiply the result by inv A on the right",
        "done: report the natural-gradient matrix",
    ],
};

export default module;
