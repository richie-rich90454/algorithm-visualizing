/**
 * svrg.ts - Stochastic Variance Reduced Gradient
 *
 * SVRG removes the variance of stochastic gradients by pairing each sample
 * gradient at the current point with the same sample gradient at a periodically
 * refreshed snapshot, then adding the full gradient at that snapshot. The
 * paired difference has low variance and is an unbiased estimate of the true
 * gradient, which allows a constant step size and linear convergence on smooth
 * strongly convex objectives.
 *
 * Limits of the demo: the objective is ridge regression on a small explicit
 * data table, samples are visited in a fixed cyclic order, and the snapshot is
 * refreshed once per epoch. No importance sampling, mini-batches, or nonconvex
 * objectives are modeled.
 *
 * Time: O(epochs * n * d + epochs * n * d for the snapshot). Space: O(n + d).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Sample {
    a: number[];
    y: number;
}

/** Exact ridge solution of (X^T X + lambda n I) w = X^T y. */
export function exactRidge(data: Sample[], lambda: number): number[] {
    const d = data[0]?.a.length ?? 0;
    const gram: number[][] = Array.from({ length: d }, () => new Array<number>(d).fill(0));
    const rhs = new Array<number>(d).fill(0);
    for (const sample of data) {
        for (let i = 0; i < d; i += 1) {
            rhs[i] = rhs[i] as number + sample.y * (sample.a[i] as number);
            for (let j = 0; j < d; j += 1) {
                (gram[i] as number[])[j] = (gram[i] as number[])[j] as number + (sample.a[i] as number) * (sample.a[j] as number);
            }
        }
    }
    for (let i = 0; i < d; i += 1) {
        (gram[i] as number[])[i] = (gram[i] as number[])[i] as number + lambda * data.length;
    }
    const A = gram.map((row, i) => [...row, rhs[i] as number]);
    for (let col = 0; col < d; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < d; row += 1) {
            if (Math.abs((A[row] as number[])[col] as number) > Math.abs((A[pivot] as number[])[col] as number)) {
                pivot = row;
            }
        }
        [A[col], A[pivot]] = [A[pivot] as number[], A[col] as number[]];
        const pv = (A[col] as number[])[col] as number;
        for (let j = col; j <= d; j += 1) {
            (A[col] as number[])[j] = (A[col] as number[])[j] as number / pv;
        }
        for (let row = 0; row < d; row += 1) {
            if (row === col) {
                continue;
            }
            const factor = (A[row] as number[])[col] as number;
            for (let j = col; j <= d; j += 1) {
                (A[row] as number[])[j] = (A[row] as number[])[j] as number - factor * ((A[col] as number[])[j] as number);
            }
        }
    }
    return A.map((row) => row[d] as number);
}

function dot(a: number[], w: number[]): number {
    return a.reduce((sum, value, i) => sum + value * (w[i] as number), 0);
}

/** Gradient of the single-sample squared loss plus regularization. */
function sampleGradient(sample: Sample, w: number[], lambda: number): number[] {
    const residual = dot(sample.a, w) - sample.y;
    return sample.a.map((value, j) => 2 * residual * value + 2 * lambda * (w[j] as number));
}

/** Full gradient as the mean of the per-sample gradients. */
function fullGradient(data: Sample[], w: number[], lambda: number): number[] {
    const d = w.length;
    return Array.from({ length: d }, (_, j) =>
        data.reduce((sum, sample) => {
            const residual = dot(sample.a, w) - sample.y;
            return sum + 2 * residual * (sample.a[j] as number) + 2 * lambda * (w[j] as number);
        }, 0) / data.length,
    );
}

function objective(data: Sample[], w: number[], lambda: number): number {
    const loss = data.reduce((sum, sample) => sum + (dot(sample.a, w) - sample.y) ** 2, 0) / data.length;
    const reg = w.reduce((sum, value) => sum + value * value, 0);
    return loss + lambda * reg;
}

function distance(a: number[], b: number[]): number {
    return Math.sqrt(a.reduce((sum, value, i) => sum + (value - (b[i] as number)) ** 2, 0));
}

function makeBars(w: number[], obj: number, active: number): VisualEntity[] {
    return [...w, obj].map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: index < w.length ? `w${index}=${value.toFixed(5)}` : `objective=${value.toFixed(5)}`,
        value,
        state: index === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index < w.length ? "weight" : "objective" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { data?: { a: number[]; y: number }[]; lambda?: number; stepSize?: number; epochs?: number } | null) ?? {};
    const data: Sample[] = Array.isArray(task.data) && task.data.length > 0
        ? task.data.map((sample) => ({ a: sample.a.map(Number), y: Number(sample.y) }))
        : [
            { a: [1, 0], y: 1 }, { a: [0, 1], y: 2 },
            { a: [1, 1], y: 3 }, { a: [1, -1], y: -1 },
        ];
    const lambda = Math.max(0, Number(task.lambda ?? 0.1));
    const eta = Math.max(1e-6, Number(task.stepSize ?? 0.08));
    const epochs = Math.min(80, Math.max(1, Math.floor(Number(task.epochs ?? 14)) || 14));
    const optimum = exactRidge(data, lambda);
    const d = optimum.length;
    let w = new Array<number>(d).fill(0);
    let step = 0;
    const history: number[] = [objective(data, w, lambda)];

    yield {
        stepNumber: step,
        entities: makeBars(w, history[0] as number, -1),
        edges: [],
        description: `Minimize ridge regression on ${data.length} samples with SVRG for ${epochs} epochs.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { epochs, lambda, stepSize: eta, optimum: [...optimum], objectives: [...history], w: [...w] },
    };
    step += 1;

    for (let epoch = 0; epoch < epochs; epoch += 1) {
        const snapshot = w.slice();
        const meanGradient = fullGradient(data, snapshot, lambda);
        for (let i = 0; i < data.length; i += 1) {
            const sample = data[i] as Sample;
            const atCurrent = sampleGradient(sample, w, lambda);
            const atSnapshot = sampleGradient(sample, snapshot, lambda);
            const estimate = atCurrent.map((value, j) => value - (atSnapshot[j] as number) + (meanGradient[j] as number));
            w = w.map((value, j) => value - eta * (estimate[j] as number));
            const obj = objective(data, w, lambda);
            history.push(obj);
            yield {
                stepNumber: step,
                entities: makeBars(w, obj, i),
                edges: [],
                description: `Epoch ${epoch + 1}, sample ${i}: variance-reduced step, objective ${obj.toFixed(6)}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: {
                    epoch: epoch + 1,
                    sample: i,
                    snapshot: [...snapshot],
                    w: [...w],
                    objectives: [...history],
                    gradientEstimate: [...estimate],
                    distanceToOptimum: distance(w, optimum),
                },
            };
            step += 1;
        }
    }

    const finalObj = history[history.length - 1] as number;
    yield {
        stepNumber: step,
        entities: makeBars(w, finalObj, -1),
        edges: [],
        description: `Final objective ${finalObj.toFixed(8)} at distance ${distance(w, optimum).toExponential(2)} from the ridge optimum.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            w: [...w],
            optimum: [...optimum],
            objectives: [...history],
            finalObjective: finalObj,
            distanceToOptimum: distance(w, optimum),
            converged: distance(w, optimum) < 1e-4,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain stochastic gradient step is cheap but noisy, so it needs a shrinking step size to settle. SVRG keeps a snapshot of the parameters and a full gradient at that snapshot. For each sample it uses the change in that sample's gradient since the snapshot plus the full gradient, which is still unbiased but has much smaller variance.",
        invariants: [
            "The variance-reduced direction is an unbiased estimate of the full gradient.",
            "The snapshot and its full gradient stay fixed within an epoch.",
            "For strongly convex smooth objectives the expected objective decreases geometrically.",
        ],
        correctness:
            "The estimator equals the gradient of the sample at the current point minus the gradient of the same sample at the snapshot plus the full gradient at the snapshot. Its expectation is the full gradient at the current point, so it is unbiased. Under smoothness and strong convexity the paired difference is bounded by a constant times the distance between the current point and the optimum, which yields a linear convergence rate with a constant step size.",
        complexityRationale:
            "Each epoch computes one full gradient over n samples and then n stochastic updates, each costing O(d), so an epoch is O(n d). Only the current point, the snapshot, and the mean gradient are kept, giving O(n + d) space.",
        uses: [
            "Training logistic and ridge models with a constant step size",
            "Large-scale empirical risk minimization",
            "Variance reduction in finite-sum optimization",
        ],
        references: [
            "Johnson and Zhang, Accelerating Stochastic Gradient Descent using Predictable Variance Reduction, 2013",
            "Nocedal and Wright, Numerical Optimization, 2nd edition",
        ],
        workedExample:
            "On four samples with features (1,0), (0,1), (1,1), (1,-1), targets 1, 2, 3, -1 and lambda 0.1, the ridge optimum is about (0.882, 1.765). Starting at zero, repeated snapshot epochs bring the iterate within 1e-4 of that point.",
    },
    id: "svrg",
    name: "Stochastic Variance Reduced Gradient",
    category: "numerical-optimization",
    complexity: { time: "O(epochs * n * d)", space: "O(n + d)" },
    defaultInput: {
        data: [
            { a: [1, 0], y: 1 }, { a: [0, 1], y: 2 },
            { a: [1, 1], y: 3 }, { a: [1, -1], y: -1 },
        ],
        lambda: 0.1,
        stepSize: 0.08,
        epochs: 30,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the sample table, regularization and step size",
        "initialize the parameters at zero",
        "for each epoch save a snapshot of the parameters",
        "compute the full gradient at the snapshot",
        "for each sample build gradient current minus gradient snapshot plus full gradient",
        "take one step against that variance-reduced direction",
        "record the objective value after each step",
        "done: report the final parameters and distance to the optimum",
    ],
};

export default module;
