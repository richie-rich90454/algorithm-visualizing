/**
 * ga-lore.ts - GaLore: Gradient Low-Rank Projection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * GaLore (Zhao et al., 2024) observes that gradient matrices are often close to
 * low rank. It projects each gradient onto a rank-r subspace, keeps the
 * optimizer state only in that small subspace, and projects the update back.
 * This cuts the memory of Adam-style training while preserving full-parameter
 * learning because the projection basis changes with the gradient.
 *
 * This teaching model uses a 2 by 2 matrix and rank one, obtained from the
 * leading eigenvector of the row covariance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d^3) for the subspace basis   Space: O(d * r)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The 2x2 parameter matrix is shown as four row-major bars.
 *   - Meta exposes the rank-one update and the leading eigenvector.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GaLoreInput {
    parameters?: number[][];
    gradients?: number[][][];
    learningRate?: number;
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
    const task = (input as GaLoreInput | null) ?? {};
    const theta = (task.parameters ?? [
        [1, -0.5],
        [0.5, -1],
    ]).map((row) => row.slice());
    const gradients = task.gradients ?? [
        [
            [0.9, -0.4],
            [0.3, -0.6],
        ],
        [
            [0.5, -0.2],
            [0.2, -0.3],
        ],
        [
            [0.2, -0.1],
            [0.1, -0.15],
        ],
    ];
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.05;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.9;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.999;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;

    let m = [0, 0];
    let v = [0, 0];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Initializing GaLore with rank-one gradient projection on a 2 by 2 matrix.`,
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
        const gt = [
            [g[0]?.[0] ?? 0, g[1]?.[0] ?? 0],
            [g[0]?.[1] ?? 0, g[1]?.[1] ?? 0],
        ];
        const ggT = mm(g, gt);
        const eig = eig2x2(ggT[0]?.[0] ?? 0, ggT[0]?.[1] ?? 0, ggT[1]?.[1] ?? 0);
        const u = [eig.q[0]?.[0] ?? 1, eig.q[1]?.[0] ?? 0];
        const gLow = [
            (u[0] ?? 0) * (g[0]?.[0] ?? 0) + (u[1] ?? 0) * (g[1]?.[0] ?? 0),
            (u[0] ?? 0) * (g[0]?.[1] ?? 0) + (u[1] ?? 0) * (g[1]?.[1] ?? 0),
        ];
        m = m.map((value, j) => beta1 * value + (1 - beta1) * (gLow[j] ?? 0));
        v = v.map((value, j) => beta2 * value + (1 - beta2) * (gLow[j] ?? 0) * (gLow[j] ?? 0));
        const updateLow = m.map(
            (value, j) =>
                value /
                (1 - Math.pow(beta1, timeStep)) /
                (Math.sqrt((v[j] ?? 0) / (1 - Math.pow(beta2, timeStep))) + epsilon),
        );
        const delta = [
            [(u[0] ?? 0) * (updateLow[0] ?? 0), (u[0] ?? 0) * (updateLow[1] ?? 0)],
            [(u[1] ?? 0) * (updateLow[0] ?? 0), (u[1] ?? 0) * (updateLow[1] ?? 0)],
        ];
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                theta[i]![j] = (theta[i]?.[j] ?? 0) - lr * (delta[i]?.[j] ?? 0);
            }
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, "active"),
            edges: [],
            description: `Step ${timeStep}: projected the gradient to rank one, applied Adam, and lifted the update back.`,
            codeLineNumber: 7,
            layout: "array",
            meta: {
                step: timeStep,
                loss: lossAt(theta),
                delta: delta.flat(),
                leadingEigenvector: u.slice(),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, "sorted"),
        edges: [],
        description: `Finished ${gradients.length} GaLore steps; final loss ${lossAt(theta).toFixed(6)}.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { step: gradients.length, loss: lossAt(theta), parameters: theta.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Full Adam keeps two optimizer values for every weight. GaLore notices that gradients of large matrices live near a low-dimensional subspace, so it projects the gradient into that subspace, runs Adam there with a tiny state, and maps the update back to the full matrix.",
        invariants: [
            "The projection is the leading eigenvector of the row covariance.",
            "Adam state is kept only on the rank-reduced gradient vector.",
            "The lifted update is an outer product and therefore has rank one.",
        ],
        correctness:
            "The generator computes the leading eigenvector in closed form, runs Adam on the projected gradient, and lifts the update back. The test replays the recurrence independently and verifies that the exposed update has rank one, which is the defining structural guarantee of the low-rank projection.",
        complexityRationale:
            "Finding the basis costs O(d^3) for a d by d covariance, while the Adam work is O(d * r), so time is O(steps * d^3) here and optimizer space is only O(d * r).",
        uses: [
            "Memory-efficient pretraining of large language models",
            "Fine-tuning with a fraction of the Adam optimizer state",
            "Low-rank adaptation on full weight matrices",
        ],
        references: [
            "Zhao et al., GaLore: Memory-Efficient LLM Training by Gradient Low-Rank Projection, ICML 2024",
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
        ],
        workedExample:
            "For gradient [[0.9, -0.4], [0.3, -0.6]] the leading eigenvector of G times G transpose points mostly along the first row. Projecting gives two small numbers on which Adam runs, and lifting back yields an update matrix whose two rows are scalar multiples of each other.",
    },
    id: "ga-lore",
    name: "GaLore Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d^3)", space: "O(d * r)" },
    defaultInput: {
        parameters: [
            [1, -0.5],
            [0.5, -1],
        ],
        gradients: [
            [
                [0.9, -0.4],
                [0.3, -0.6],
            ],
            [
                [0.5, -0.2],
                [0.2, -0.3],
            ],
            [
                [0.2, -0.1],
                [0.1, -0.15],
            ],
        ],
        learningRate: 0.05,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize Adam moments m and v on the low-rank space",
        "for each gradient matrix G do",
        "compute leading eigenvector u of G * G^T",
        "project gLow = u^T * G into the rank-r subspace",
        "m = beta1*m + (1-beta1)*gLow; v = beta2*v + (1-beta2)*gLow^2",
        "updateLow = mHat / (sqrt(vHat) + eps)",
        "lift delta = u * updateLow and set theta = theta - lr * delta",
        "record parameters and the rank-one update",
        "done: report the final parameter matrix",
    ],
};

export default module;
