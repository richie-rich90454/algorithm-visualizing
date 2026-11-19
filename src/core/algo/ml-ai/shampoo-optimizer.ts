/**
 * shampoo-optimizer.ts - Shampoo: Preconditioned Tensor Optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Shampoo (Gupta et al., 2018) builds separate covariance matrices for the two
 * dimensions of a weight matrix and preconditions the gradient with the minus
 * one-quarter power of each. For a 2 by 2 matrix those powers are computed in
 * closed form from the symmetric eigendecomposition. The result balances the
 * update along both axes before scaling by the learning rate.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d^3)   Space: O(d^2) for the two covariances
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The 2x2 parameter matrix is shown as four row-major bars.
 *   - Meta exposes the eigenvalues of both covariance matrices.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ShampooInput {
    parameters?: number[][];
    gradients?: number[][][];
    learningRate?: number;
    decay?: number;
    epsilon?: number;
}

function mm(a: number[][], b: number[][]): number[][] {
    return [
        [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
        [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
    ];
}

function transpose(a: number[][]): number[][] {
    return [
        [a[0][0], a[1][0]],
        [a[0][1], a[1][1]],
    ];
}

function eig2x2(a: number, b: number, c: number): { q: number[][]; values: number[] } {
    const trace = a + c;
    const disc = Math.sqrt((a - c) * (a - c) + 4 * b * b);
    const l1 = (trace + disc) / 2;
    const l2 = (trace - disc) / 2;
    let v1x: number;
    let v1y: number;
    if (Math.abs(b) > 1e-12) {
        v1x = b;
        v1y = l1 - a;
        const norm = Math.sqrt(v1x * v1x + v1y * v1y);
        v1x /= norm;
        v1y /= norm;
    } else if (a >= c) {
        v1x = 1;
        v1y = 0;
    } else {
        v1x = 0;
        v1y = 1;
    }
    return { q: [[v1x, -v1y], [v1y, v1x]], values: [l1, l2] };
}

/** Reconstruct Q diag(lambda^p) Q^T for a symmetric 2x2 input. */
function power(a: number, b: number, c: number, p: number, epsilon: number): number[][] {
    const eig = eig2x2(a, b, c);
    const q = eig.q;
    const d0 = Math.pow(Math.max(0, eig.values[0]) + epsilon, p);
    const d1 = Math.pow(Math.max(0, eig.values[1]) + epsilon, p);
    return [
        [q[0][0] * q[0][0] * d0 + q[0][1] * q[0][1] * d1, q[0][0] * q[1][0] * d0 + q[0][1] * q[1][1] * d1],
        [q[0][0] * q[1][0] * d0 + q[0][1] * q[1][1] * d1, q[1][0] * q[1][0] * d0 + q[1][1] * q[1][1] * d1],
    ];
}

function makeBars(matrix: number[][], state: EntityState): VisualEntity[] {
    return matrix.flat().map((value, index) => ({
        id: `param-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, row: Math.floor(index / 2), col: index % 2 },
    }));
}

function lossAt(matrix: number[][]): number {
    let total = 0;
    for (const row of matrix) {
        for (const value of row) {
            total += 0.5 * value * value;
        }
    }
    return total;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ShampooInput | null) ?? {};
    const theta = (task.parameters ?? [
        [1, -0.5],
        [0.5, -1],
    ]).map((row) => row.slice());
    const gradients = task.gradients ?? [
        [
            [0.8, -0.3],
            [0.2, -0.6],
        ],
        [
            [0.4, -0.2],
            [0.1, -0.3],
        ],
        [
            [0.2, -0.1],
            [0.05, -0.15],
        ],
    ];
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.05;
    const decay = typeof task.decay === "number" ? task.decay : 0.9;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;

    let left = [
        [0, 0],
        [0, 0],
    ];
    let right = [
        [0, 0],
        [0, 0],
    ];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Initializing Shampoo with minus-one-quarter covariance preconditioning.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, loss: lossAt(theta), learningRate: lr },
    };
    step += 1;

    for (let t = 0; t < gradients.length; t += 1) {
        const g = gradients[t];
        if (!g) {
            continue;
        }
        const gt = transpose(g);
        const ggT = mm(g, gt);
        const gTg = mm(gt, g);
        left = left.map((row, i) =>
            row.map((value, j) => decay * value + (1 - decay) * (ggT[i]?.[j] ?? 0)),
        );
        right = right.map((row, i) =>
            row.map((value, j) => decay * value + (1 - decay) * (gTg[i]?.[j] ?? 0)),
        );
        const fL = power(left[0]?.[0] ?? 0, left[0]?.[1] ?? 0, left[1]?.[1] ?? 0, -0.25, epsilon);
        const fR = power(right[0]?.[0] ?? 0, right[0]?.[1] ?? 0, right[1]?.[1] ?? 0, -0.25, epsilon);
        const update = mm(fL, mm(g, fR));
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                theta[i]![j] = (theta[i]?.[j] ?? 0) - lr * (update[i]?.[j] ?? 0);
            }
        }
        const eigL = eig2x2(left[0]?.[0] ?? 0, left[0]?.[1] ?? 0, left[1]?.[1] ?? 0);
        const eigR = eig2x2(right[0]?.[0] ?? 0, right[0]?.[1] ?? 0, right[1]?.[1] ?? 0);
        yield {
            stepNumber: step,
            entities: makeBars(theta, "active"),
            edges: [],
            description: `Step ${t + 1}: preconditioned by L^(-1/4) and R^(-1/4) before the update.`,
            codeLineNumber: 6,
            layout: "array",
            meta: {
                step: t + 1,
                loss: lossAt(theta),
                leftEigen: eigL.values.slice(),
                rightEigen: eigR.values.slice(),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, "sorted"),
        edges: [],
        description: `Finished ${gradients.length} Shampoo steps; final loss ${lossAt(theta).toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { step: gradients.length, loss: lossAt(theta), parameters: theta.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Shampoo observes that a weight matrix has two independent directions, along rows and along columns, each with its own curvature. It builds a covariance matrix for each direction and rescales the gradient by the minus-one-quarter power of both, which is cheaper than a full Hessian while staying invariant to rescaling the axes.",
        invariants: [
            "The row covariance is an average of G times G transpose.",
            "The column covariance is an average of G transpose times G.",
            "The preconditioner is the minus-one-quarter power of each covariance.",
        ],
        correctness:
            "The generator computes the two matrix powers through the closed-form 2 by 2 eigendecomposition. The test replays the computation independently and checks the characteristic property that for a diagonal gradient the preconditioned update reduces to the sign of each entry.",
        complexityRationale:
            "Eigendecomposition of the d by d covariances dominates at O(d^3) per step, with O(d^2) storage for the covariances and intermediate products.",
        uses: [
            "Second-order-style training of neural network weight matrices",
            "Accelerating convergence on ill-conditioned objectives",
            "A structural preconditioner that respects matrix geometry",
        ],
        references: [
            "Gupta et al., Shampoo: Preconditioned Stochastic Tensor Optimization, ICML 2018",
            "Anil et al., Scalable Second Order Optimization, 2020",
        ],
        workedExample:
            "For a single diagonal gradient [[0.8, 0], [0, -0.3]], both covariances are diagonal, so their minus-one-quarter powers act entry by entry and the update becomes the sign pattern [[1, 0], [0, -1]] scaled by the learning rate.",
    },
    id: "shampoo-optimizer",
    name: "Shampoo Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d^3)", space: "O(d^2)" },
    defaultInput: {
        parameters: [
            [1, -0.5],
            [0.5, -1],
        ],
        gradients: [
            [
                [0.8, -0.3],
                [0.2, -0.6],
            ],
            [
                [0.4, -0.2],
                [0.1, -0.3],
            ],
            [
                [0.2, -0.1],
                [0.05, -0.15],
            ],
        ],
        learningRate: 0.05,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize row covariance L and column covariance R to zero",
        "for each gradient matrix G do",
        "L = decay*L + (1-decay)*G*G^T; R = decay*R + (1-decay)*G^T*G",
        "eigendecompose L and R symmetrically",
        "form F = L^(-1/4) and H = R^(-1/4) from the eigenvalues",
        "theta = theta - lr * F * G * H",
        "record parameters and leading eigenvalues",
        "done: report the final parameter matrix",
    ],
};

export default module;
