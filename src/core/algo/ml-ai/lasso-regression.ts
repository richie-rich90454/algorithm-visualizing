/**
 * lasso-regression.ts - L1 Regularized Regression by Coordinate Descent
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lasso regression fits a linear model while penalizing the sum of absolute
 * coefficient values. The L1 penalty drives many coefficients to exactly zero,
 * which performs feature selection. Coordinate descent minimizes the objective
 * one coefficient at a time using a closed-form soft-threshold update.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sweeps * d * n * d) for n samples and d features
 *   Space: O(d) for the coefficient vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per coefficient; the bar being updated is active.
 *   - Green bars were updated earlier in the current sweep.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface LassoInput {
    X?: number[][];
    y?: number[];
    lambda?: number;
    sweeps?: number;
}

/** Soft-threshold a value by lambda. */
function softThreshold(value: number, lambda: number): number {
    if (value > lambda) {
        return value - lambda;
    }
    if (value < -lambda) {
        return value + lambda;
    }
    return 0;
}

/** Objective: half squared error plus the L1 penalty. */
function objective(X: number[][], y: number[], w: number[], lambda: number): number {
    let total = 0;
    for (let i = 0; i < y.length; i += 1) {
        let prediction = 0;
        for (let j = 0; j < w.length; j += 1) {
            prediction += (X[i]?.[j] ?? 0) * w[j]!;
        }
        const residual = (y[i] ?? 0) - prediction;
        total += 0.5 * residual * residual;
    }
    for (const value of w) {
        total += lambda * Math.abs(value);
    }
    return total;
}

/** One bar per coefficient value. */
function bars(w: number[], current: number): VisualEntity[] {
    return w.map((value, index) => ({
        id: `w-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(6)),
        state:
            index === current ? ("active" as const) : index < current ? ("sorted" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Fit lasso coefficients with cyclic coordinate descent. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LassoInput | null) ?? {};
    const X: number[][] =
        Array.isArray(task.X) && task.X.length > 0 ? task.X.map((row) => (Array.isArray(row) ? row.slice() : [])) : [[1, 0], [0, 1], [1, 1], [2, 1]];
    const y: number[] = Array.isArray(task.y) && task.y.length > 0 ? task.y.slice() : [1, 2, 3, 5];
    const lambda = typeof task.lambda === "number" && task.lambda >= 0 ? task.lambda : 0.5;
    const sweeps = Math.max(1, Math.min(typeof task.sweeps === "number" ? task.sweeps : 4, 50));
    const d = X[0]?.length ?? 0;
    const w = new Array<number>(d).fill(0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(w, -1),
        edges: [],
        description: `Fitting lasso on ${y.length} samples with ${d} features and lambda = ${lambda}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { w: w.slice(), lambda, sweep: 0, feature: -1, objective: Number(objective(X, y, w, lambda).toFixed(6)) },
    };
    step += 1;

    for (let sweep = 0; sweep < sweeps; sweep += 1) {
        for (let j = 0; j < d; j += 1) {
            let rho = 0;
            let z = 0;
            for (let i = 0; i < y.length; i += 1) {
                const xij = X[i]?.[j] ?? 0;
                let partial = 0;
                for (let k = 0; k < d; k += 1) {
                    if (k !== j) {
                        partial += (X[i]?.[k] ?? 0) * w[k]!;
                    }
                }
                rho += xij * ((y[i] ?? 0) - partial);
                z += xij * xij;
            }
            w[j] = z > 0 ? softThreshold(rho, lambda) / z : 0;
            const last = sweep === sweeps - 1 && j === d - 1;
            yield {
                stepNumber: step,
                entities: bars(w, j),
                edges: [],
                description: `Sweep ${sweep + 1}, feature ${j}: rho ${rho.toFixed(3)}, z ${z.toFixed(3)}, new coefficient ${w[j]!.toFixed(3)}.`,
                codeLineNumber: last ? 6 : 5,
                layout: "array",
                meta: {
                    w: w.map((v) => Number(v.toFixed(6))),
                    lambda,
                    sweep: sweep + 1,
                    feature: j,
                    rho: Number(rho.toFixed(6)),
                    z: Number(z.toFixed(6)),
                    objective: Number(objective(X, y, w, lambda).toFixed(6)),
                },
            };
            step += 1;
        }
    }
}

/** The lasso regression module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Lasso regression is ordinary least squares with an added cost for large coefficients, where the cost is the sum of absolute values. That sharp penalty has a useful side effect: it snaps small coefficients to exactly zero. Coordinate descent fits one coefficient at a time to its optimal value given all the others, which is simple and fast.",
        invariants: [
            "Each coordinate update uses the residuals with the current feature removed.",
            "A coefficient is set by soft-thresholding the correlation rho and dividing by the feature energy z.",
            "The objective never increases after a full update of any coordinate.",
        ],
        correctness:
            "For a fixed set of other coefficients, the objective as a function of one coefficient is a convex quadratic plus an absolute value. Its minimizer is the soft-thresholded correlation divided by the feature energy, which is exactly the update applied. Cycling through all coordinates therefore descends the objective and converges to a lasso solution.",
        complexityRationale:
            "Each coordinate update scans n samples and d coefficients to form the partial prediction, costing O(n times d). There are d updates per sweep and a fixed number of sweeps, giving O(sweeps times d squared times n) time and O(d) space for the weights.",
        uses: [
            "Feature selection in high-dimensional regression",
            "Sparse linear models in genetics and signal processing",
            "Compressed sensing and variable screening",
        ],
        references: [
            "Tibshirani, Regression Shrinkage and Selection via the Lasso, 1996",
            "Friedman et al., Regularization Paths for Generalized Linear Models, 2010",
        ],
        workedExample:
            "With samples (1,0), (0,1), (1,1), (2,1), targets 1, 2, 3, 5, and lambda 0.5, the first feature has correlation rho = 14 and energy z = 6, so its weight becomes (14 minus 0.5) over 6, about 2.25. Repeated sweeps refine both weights until the objective settles.",
    },
    id: "lasso-regression",
    name: "Lasso Regression",
    category: "ml-ai",
    complexity: { time: "O(sweeps * d^2 * n)", space: "O(d)" },
    defaultInput: {
        X: [[1, 0], [0, 1], [1, 1], [2, 1]],
        y: [1, 2, 3, 5],
        lambda: 0.5,
        sweeps: 4,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize all coefficients to zero",
        "repeat for a fixed number of sweeps",
        "for each feature j compute correlation rho with the residual",
        "compute feature energy z as the sum of squared values",
        "set weight j to soft threshold of rho by lambda divided by z",
        "record the objective after each update",
        "done: report the fitted coefficients",
    ],
};

export default module;
