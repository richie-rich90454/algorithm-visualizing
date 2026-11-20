/**
 * ledoit-wolf-shrinkage.ts - Ledoit-Wolf Covariance Shrinkage
 *
 * The sample covariance matrix is noisy when there are few observations
 * relative to the number of features. Ledoit-Wolf shrinkage replaces it with a
 * convex combination of the sample matrix and a well-conditioned target, here
 * the identity scaled by the average variance. The shrinkage intensity is
 * estimated from the sampling variance of the off-diagonal entries.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LWInput {
    data?: number[][];
}

interface CovResult {
    mean: number[];
    sample: number[][];
    variance: number[][];
    target: number[][];
    intensity: number;
    shrunk: number[][];
}

/** Compute the sample covariance and Ledoit-Wolf style intensity. */
function covariance(data: number[][]): CovResult {
    const n = data.length;
    const p = n > 0 ? data[0]!.length : 0;
    const mean = Array.from({ length: p }, (_, j) =>
        data.reduce((sum, row) => sum + (row[j] ?? 0), 0) / Math.max(1, n));
    const centered = data.map((row) => row.map((v, j) => v - (mean[j] ?? 0)));
    const sample = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    const variance = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    const denominator = Math.max(1, n - 1);
    for (let i = 0; i < p; i += 1) {
        for (let j = 0; j < p; j += 1) {
            let sum = 0;
            let squaredDeviations = 0;
            for (let k = 0; k < n; k += 1) {
                const product = (centered[k]?.[i] ?? 0) * (centered[k]?.[j] ?? 0);
                sum += product;
            }
            const s = sum / denominator;
            sample[i]![j] = s;
            for (let k = 0; k < n; k += 1) {
                const product = (centered[k]?.[i] ?? 0) * (centered[k]?.[j] ?? 0);
                squaredDeviations += (product - s) ** 2;
            }
            variance[i]![j] = squaredDeviations / (n * denominator);
        }
    }
    const averageVariance = Array.from({ length: p }, (_, i) => sample[i]![i] ?? 0)
        .reduce((a, b) => a + b, 0) / Math.max(1, p);
    const target = Array.from({ length: p }, (_, i) =>
        Array.from({ length: p }, (_, j) => (i === j ? averageVariance : 0)));
    let numerator = 0;
    let denominatorIntensity = 0;
    for (let i = 0; i < p; i += 1) {
        for (let j = 0; j < p; j += 1) {
            if (i === j) continue;
            numerator += variance[i]![j]!;
            denominatorIntensity += (sample[i]![j] ?? 0) ** 2;
        }
    }
    const intensity = denominatorIntensity > 0
        ? Math.min(1, Math.max(0, numerator / denominatorIntensity))
        : 1;
    const shrunk = Array.from({ length: p }, (_, i) =>
        Array.from({ length: p }, (_, j) =>
            (1 - intensity) * (sample[i]![j] ?? 0) + intensity * (target[i]![j] ?? 0)));
    return { mean, sample, variance, target, intensity, shrunk };
}

function makeCells(matrix: number[][], active: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    matrix.forEach((row, i) => {
        row.forEach((value, j) => {
            const index = i * row.length + j;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: value.toFixed(4),
                value,
                state: done ? "sorted" : index === active ? "highlight" : index < active ? "visited" : "idle",
                x: j,
                y: i,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, value },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LWInput | null) ?? {};
    const raw = Array.isArray(task.data) ? task.data.filter(Array.isArray).map((row) => row.map(Number)) : [];
    const data = raw.length >= 2 && raw.every((row) => row.length === raw[0]!.length)
        ? raw
        : [
            [1.0, 2.1, -0.3], [1.9, 3.0, 0.2], [3.2, 2.8, 1.1], [2.7, 4.1, 0.7],
            [0.4, 1.2, -1.0], [2.2, 2.0, 0.4], [3.8, 3.6, 1.4], [1.1, 2.7, -0.2],
          ];
    const result = covariance(data);
    const p = result.sample.length;
    const traceBefore = result.sample.reduce((sum, row, i) => sum + (row[i] ?? 0), 0);
    const traceAfter = result.shrunk.reduce((sum, row, i) => sum + (row[i] ?? 0), 0);

    yield {
        stepNumber: 0,
        entities: makeCells(result.sample, -1, false),
        edges: [],
        description: `Ledoit-Wolf shrinkage on ${data.length} observations of ${p} features; begin with the sample covariance.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: p,
            cols: p,
            p,
            n: data.length,
            intensity: 0,
            traceBefore,
            traceAfter: 0,
            sample: result.sample,
            shrunk: result.sample,
            done: false,
        },
    };

    let step = 1;
    for (let i = 0; i < p; i += 1) {
        for (let j = 0; j < p; j += 1) {
            yield {
                stepNumber: step,
                entities: makeCells(result.sample, i * p + j, false),
                edges: [],
                description: `Estimate the sampling variance of covariance entry (${i}, ${j}) to gauge how noisy that entry is.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: {
                    rows: p,
                    cols: p,
                    p,
                    n: data.length,
                    intensity: 0,
                    traceBefore,
                    traceAfter: 0,
                    sample: result.sample,
                    variance: result.variance,
                    shrunk: result.sample,
                    done: false,
                },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(result.shrunk, -1, true),
        edges: [],
        description: `Shrinkage intensity ${result.intensity.toFixed(4)}: blend the sample covariance with the scaled identity, preserving the trace.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: p,
            cols: p,
            p,
            n: data.length,
            intensity: result.intensity,
            traceBefore,
            traceAfter,
            sample: result.sample,
            variance: result.variance,
            target: result.target,
            shrunk: result.shrunk,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When the number of observations is close to the number of features, the sample covariance matrix has badly estimated eigenvalues and can even be singular. Shrinkage pulls each noisy entry toward a simple, well-behaved target matrix. The amount of pulling is chosen automatically: entries whose estimates fluctuate a lot get shrunk more.",
        invariants: [
            "The shrinkage intensity always lies between zero and one.",
            "The shrunk matrix is symmetric because both the sample and target matrices are symmetric.",
            "The trace is preserved because the target has the average sample variance on its diagonal.",
        ],
        correctness:
            "The optimal intensity for a linear combination minimizes the expected squared Frobenius error between the estimate and the true covariance. For the scaled identity target the numerator is the sum of asymptotic variances of the off-diagonal sample covariances, estimated here by the average squared deviation of per-observation cross-products, and the denominator is the squared size of those covariances. Clipping to the unit interval keeps the result a valid convex combination, which preserves symmetry and positive semidefiniteness because both ingredients are positive semidefinite.",
        complexityRationale:
            "For p features and n observations, filling the covariance and variance arrays costs O(n p squared) time and O(p squared) space; the animation adds one frame per matrix entry.",
        uses: [
            "Regularizing covariance estimates in portfolio optimization",
            "Stabilizing linear and quadratic discriminant analysis",
            "Preconditioning in signal processing and Gaussian models",
        ],
        references: [
            "Ledoit and Wolf, A Well-Conditioned Estimator for Large-Dimensional Covariance Matrices, 2004",
            "Ledoit and Wolf, Nonlinear Eigenvalue Shrinkage of Large Covariance Matrices, 2020",
        ],
        workedExample:
            "With two features whose sample covariance is [[1, 0.8], [0.8, 1]] and an estimated intensity of 0.5, the shrunk matrix is [[1, 0.4], [0.4, 1]]. The diagonal is unchanged because the target diagonal equals the average variance of one, while the noisy off-diagonal is pulled halfway toward zero.",
    },
    id: "ledoit-wolf-shrinkage",
    name: "Ledoit-Wolf Shrinkage",
    category: "statistics-probability",
    complexity: { time: "O(n p^2)", space: "O(p^2)" },
    defaultInput: {
        data: [
            [1.0, 2.1, -0.3], [1.9, 3.0, 0.2], [3.2, 2.8, 1.1], [2.7, 4.1, 0.7],
            [0.4, 1.2, -1.0], [2.2, 2.0, 0.4], [3.8, 3.6, 1.4], [1.1, 2.7, -0.2],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "center each feature by subtracting its sample mean",
        "form the sample covariance with denominator n minus one",
        "for every entry estimate the variance of its per-observation cross-product",
        "build the target as the identity times the average sample variance",
        "set intensity to off-diagonal variance over squared off-diagonal covariance",
        "clip the intensity to the interval from zero to one",
        "blend sample and target with that intensity",
        "done: report the shrunken covariance matrix",
    ],
};

export default module;
