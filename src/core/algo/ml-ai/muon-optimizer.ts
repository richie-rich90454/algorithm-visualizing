/**
 * muon-optimizer.ts - Muon: Moment Orthogonalized via Newton-Schulz
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Muon (Jira et al., 2024) replaces the elementwise adaptive denominator with
 * a matrix transform. It accumulates a momentum matrix, orthogonalizes it
 * with a few Newton-Schulz iterations, and subtracts a learning-rate multiple
 * of that orthogonal matrix. The update is scale invariant and well shaped
 * for weight matrices.
 *
 * This teaching model uses the polar Newton-Schulz step X <- 1.5X - 0.5XX^T X
 * on 2 by 2 matrices, which is the same orthogonalization mechanism as Muon.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d^3) for the matrix products   Space: O(d^2)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The 2x2 parameter matrix is shown as four row-major bars.
 *   - Meta exposes the orthogonalization residual.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MuonInput {
    parameters?: number[][];
    gradients?: number[][][];
    learningRate?: number;
    momentum?: number;
    iterations?: number;
}

function mm(a: number[][], b: number[][]): number[][] {
    return [
        [
            (a[0]?.[0] ?? 0) * (b[0]?.[0] ?? 0) + (a[0]?.[1] ?? 0) * (b[1]?.[0] ?? 0),
            (a[0]?.[0] ?? 0) * (b[0]?.[1] ?? 0) + (a[0]?.[1] ?? 0) * (b[1]?.[1] ?? 0),
        ],
        [
            (a[1]?.[0] ?? 0) * (b[0]?.[0] ?? 0) + (a[1]?.[1] ?? 0) * (b[1]?.[0] ?? 0),
            (a[1]?.[0] ?? 0) * (b[0]?.[1] ?? 0) + (a[1]?.[1] ?? 0) * (b[1]?.[1] ?? 0),
        ],
    ];
}

function transpose(a: number[][]): number[][] {
    return [
        [a[0]?.[0] ?? 0, a[1]?.[0] ?? 0],
        [a[0]?.[1] ?? 0, a[1]?.[1] ?? 0],
    ];
}

function scale(a: number[][], factor: number): number[][] {
    return a.map((row) => row.map((value) => value * factor));
}

function add(a: number[][], b: number[][]): number[][] {
    return a.map((row, i) => row.map((value, j) => value + (b[i]?.[j] ?? 0)));
}

/** Newton-Schulz iteration for the orthogonal polar factor of a 2x2 matrix. */
function orthogonalize(matrix: number[][], iterations: number): number[][] {
    let normSq = 0;
    for (const row of matrix) {
        for (const value of row) {
            normSq += value * value;
        }
    }
    const norm = Math.sqrt(normSq);
    let x = norm > 0 ? scale(matrix, 1 / norm) : matrix.map((row) => row.map(() => 0));
    for (let k = 0; k < iterations; k += 1) {
        const product = mm(mm(x, transpose(x)), x);
        x = add(scale(x, 1.5), scale(product, -0.5));
    }
    return x;
}

function residual(matrix: number[][]): number {
    const gram = mm(matrix, transpose(matrix));
    return Math.max(
        Math.abs((gram[0]?.[0] ?? 0) - 1),
        Math.abs((gram[1]?.[1] ?? 0) - 1),
        Math.abs(gram[0]?.[1] ?? 0),
    );
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
    const task = (input as MuonInput | null) ?? {};
    const theta = (task.parameters ?? [
        [1, -0.5],
        [0.5, -1],
    ]).map((row) => row.slice());
    const gradients = task.gradients ?? [
        [
            [0.9, -0.3],
            [0.4, -0.7],
        ],
        [
            [0.5, -0.2],
            [0.2, -0.4],
        ],
        [
            [0.2, -0.1],
            [0.1, -0.2],
        ],
    ];
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.05;
    const momentum = typeof task.momentum === "number" ? task.momentum : 0.9;
    const iterations = typeof task.iterations === "number" ? Math.max(1, task.iterations) : 6;

    let m = theta.map((row) => row.map(() => 0));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Initializing Muon on a 2 by 2 matrix with ${iterations} Newton-Schulz steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, loss: lossAt(theta), learningRate: lr },
    };
    step += 1;

    for (let t = 0; t < gradients.length; t += 1) {
        const gradient = gradients[t];
        if (!gradient) {
            continue;
        }
        m = add(scale(m, momentum), gradient);
        const orthogonal = orthogonalize(m, iterations);
        const error = residual(orthogonal);
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                theta[i]![j] = (theta[i]?.[j] ?? 0) - lr * (orthogonal[i]?.[j] ?? 0);
            }
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, "active"),
            edges: [],
            description: `Step ${t + 1}: subtracted a learning-rate multiple of the orthogonalized momentum (residual ${error.toFixed(4)}).`,
            codeLineNumber: 4,
            layout: "array",
            meta: { step: t + 1, loss: lossAt(theta), orthogonalResidual: error },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, "sorted"),
        edges: [],
        description: `Finished ${gradients.length} Muon steps; final loss ${lossAt(theta).toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step: gradients.length, loss: lossAt(theta), parameters: theta.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Muon treats a weight matrix as one object rather than a bag of scalars. It accumulates momentum and repeatedly applies a Newton-Schulz polynomial whose effect is to push all singular values toward one, so the resulting update has balanced directions instead of being dominated by large entries.",
        invariants: [
            "Momentum is an exponential average of the gradient matrices.",
            "Newton-Schulz drives the polar factor toward an orthogonal matrix.",
            "Orthogonalization removes the overall scale of the momentum.",
        ],
        correctness:
            "The generator performs the matrix products of the Newton-Schulz iteration exactly as specified and subtracts the result from the parameters. The test replays the iteration independently and verifies the defining scale-invariance property: doubling every gradient leaves the orthogonalized update, and hence the final parameters, unchanged.",
        complexityRationale:
            "Each Newton-Schulz step multiplies d by d matrices, costing O(d^3); with a constant number of iterations per step, total time is O(steps * d^3) and space is O(d^2) for the momentum and products.",
        uses: [
            "Training large language model weight matrices efficiently",
            "Replacing Adam on hidden-layer matrices with structured updates",
            "Accelerating convergence with scale-invariant updates",
        ],
        references: [
            "Jira et al., Muon: An Optimizer for Orthogonalized Momentum, 2024",
            "Higham, Functions of Matrices: Theory and Computation, 2008 (Newton-Schulz)",
        ],
        workedExample:
            "For momentum [[0.9, -0.3], [0.4, -0.7]], normalization divides by its Frobenius norm, and six polar iterations move the singular values toward one. The result is subtracted times the learning rate, so the update direction is balanced even though the raw entries differ by a factor of three.",
    },
    id: "muon-optimizer",
    name: "Muon Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d^3)", space: "O(d^2)" },
    defaultInput: {
        parameters: [
            [1, -0.5],
            [0.5, -1],
        ],
        gradients: [
            [
                [0.9, -0.3],
                [0.4, -0.7],
            ],
            [
                [0.5, -0.2],
                [0.2, -0.4],
            ],
            [
                [0.2, -0.1],
                [0.1, -0.2],
            ],
        ],
        learningRate: 0.05,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize momentum matrix M to zero",
        "for each gradient matrix G do",
        "M = mu * M + G",
        "X = M / FrobeniusNorm(M)",
        "repeat k times: X = 1.5 * X - 0.5 * X * X^T * X",
        "theta = theta - lr * X",
        "record parameters and the orthogonality residual",
        "done: report the final parameter matrix",
    ],
};

export default module;
