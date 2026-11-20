/**
 * soap-optimizer.ts - SOAP: Shampoo in the Eigenbasis with Adam
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SOAP (Vyas et al., 2024) diagonalizes the two gradient covariance matrices
 * of Shampoo and runs Adam in the resulting eigenbasis. It keeps Shampoo's
 * invariant preconditioning while avoiding the costly fractional matrix
 * powers at every step, because the basis changes slowly over training.
 *
 * This teaching model uses closed-form 2 by 2 symmetric eigendecomposition.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d^3) for eigendecompositions   Space: O(d^2)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The 2x2 parameter matrix is shown as four row-major bars.
 *   - Meta exposes the covariance eigenvalues for verification.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SoapInput {
    parameters?: number[][];
    gradients?: number[][][];
    learningRate?: number;
    decay?: number;
    beta1?: number;
    beta2?: number;
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

/** Closed-form eigendecomposition of a symmetric 2x2 matrix, columns of Q are eigenvectors. */
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
    const v2x = -v1y;
    const v2y = v1x;
    return { q: [[v1x, v2x], [v1y, v2y]], values: [l1, l2] };
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
    const task = (input as SoapInput | null) ?? {};
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
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.9;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.999;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;

    let left = [
        [0, 0],
        [0, 0],
    ];
    let right = [
        [0, 0],
        [0, 0],
    ];
    let mHatState = [
        [0, 0],
        [0, 0],
    ];
    let vHatState = [
        [0, 0],
        [0, 0],
    ];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Initializing SOAP with eigendecomposed covariance and Adam in the eigenbasis.`,
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
        const timeStep = t + 1;
        const gt = transpose(g);
        const ggT = mm(g, gt);
        const gTg = mm(gt, g);
        left = left.map((row, i) =>
            row.map((value, j) => decay * value + (1 - decay) * (ggT[i]?.[j] ?? 0)),
        );
        right = right.map((row, i) =>
            row.map((value, j) => decay * value + (1 - decay) * (gTg[i]?.[j] ?? 0)),
        );
        const eigL = eig2x2(left[0]?.[0] ?? 0, left[0]?.[1] ?? 0, left[1]?.[1] ?? 0);
        const eigR = eig2x2(right[0]?.[0] ?? 0, right[0]?.[1] ?? 0, right[1]?.[1] ?? 0);
        const qL = eigL.q;
        const qR = eigR.q;
        const projected = mm(transpose(qL), mm(g, qR));
        mHatState = mHatState.map((row, i) =>
            row.map((value, j) => beta1 * value + (1 - beta1) * (projected[i]?.[j] ?? 0)),
        );
        vHatState = vHatState.map((row, i) =>
            row.map(
                (value, j) =>
                    beta2 * value + (1 - beta2) * (projected[i]?.[j] ?? 0) * (projected[i]?.[j] ?? 0),
            ),
        );
        const updateProjected = mHatState.map((row, i) =>
            row.map(
                (value, j) =>
                    (value / (1 - Math.pow(beta1, timeStep))) /
                    (Math.sqrt((vHatState[i]?.[j] ?? 0) / (1 - Math.pow(beta2, timeStep))) + epsilon),
            ),
        );
        const update = mm(qL, mm(updateProjected, transpose(qR)));
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                theta[i]![j] = (theta[i]?.[j] ?? 0) - lr * (update[i]?.[j] ?? 0);
            }
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, "active"),
            edges: [],
            description: `Step ${timeStep}: Adam step taken in the covariance eigenbasis; largest eigenvalues ${eigL.values[0].toFixed(4)} and ${eigR.values[0].toFixed(4)}.`,
            codeLineNumber: 6,
            layout: "array",
            meta: {
                step: timeStep,
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
        description: `Finished ${gradients.length} SOAP steps; final loss ${lossAt(theta).toFixed(6)}.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { step: gradients.length, loss: lossAt(theta), parameters: theta.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Shampoo preconditions a gradient by rotating it into the eigenbasis of its row and column covariances. SOAP goes one step further and runs ordinary Adam in that rotating basis. Because the rotation changes slowly, the expensive eigendecomposition can be refreshed only occasionally in practice.",
        invariants: [
            "The two covariance matrices are running averages of G times G transpose and G transpose times G.",
            "The gradient and update are rotated by orthogonal eigenvector matrices.",
            "Within the eigenbasis the update is the standard bias-corrected Adam step.",
        ],
        correctness:
            "The generator uses the closed-form symmetric 2 by 2 eigendecomposition and applies Adam in the projected basis, then rotates back. The test replays these steps independently and verifies the key consequence: for a diagonal gradient matrix the eigenvalues align with the axes and SOAP reduces exactly to elementwise Adam.",
        complexityRationale:
            "The dominant cost is eigendecomposition of d by d covariances, O(d^3), once per step in this model; the Adam work is O(d^2) and all state uses O(d^2) space.",
        uses: [
            "Training large transformer layers with structured second-order updates",
            "Bridging first-order Adam and full Shampoo preconditioning",
            "Optimizers with cached eigendecompositions refreshed periodically",
        ],
        references: [
            "Vyas et al., SOAP: ShampoO with Adam in the Eigenbasis, NeurIPS 2024",
            "Gupta et al., Shampoo: Preconditioned Stochastic Tensor Optimization, ICML 2018",
        ],
        workedExample:
            "On a diagonal gradient [[0.8, 0], [0, -0.3]] the row and column covariances are diagonal, so the eigenvectors are the coordinate axes. SOAP then behaves like Adam applied separately to 0.8 and -0.3, which makes the update easy to check by hand.",
    },
    id: "soap-optimizer",
    name: "SOAP Optimizer",
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
        "initialize row and column covariances L and R to zero",
        "for each gradient matrix G do",
        "L = decay*L + (1-decay)*G*G^T; R = decay*R + (1-decay)*G^T*G",
        "eigendecompose L = QL diag(a) QL^T and R = QR diag(b) QR^T",
        "projected = QL^T * G * QR; update m, v by Adam on projected",
        "step = mHat / (sqrt(vHat) + eps) in the projected basis",
        "theta = theta - lr * QL * step * QR^T",
        "record parameters and leading eigenvalues",
        "done: report the final parameter matrix",
    ],
};

export default module;
