/**
 * elastic-net.ts - Elastic Net Regression by Coordinate Descent
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Elastic net combines the L1 penalty of lasso with the L2 penalty of ridge
 * regression. The L1 term drives coefficients to exactly zero, while the L2
 * term stabilizes highly correlated features and spreads weight among them.
 * Coordinate descent minimizes the objective one coefficient at a time: soft
 * threshold the partial residual correlation with lambda1 and divide by the
 * feature energy plus lambda2. This module fits the model from scratch and
 * reports the objective after each update.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(sweeps * d^2 * n) for n samples and d features
 *   Space: O(d) for the coefficient vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per coefficient; the one being updated is active.
 *   - Earlier updates in the sweep are green, untouched ones are idle.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface ElasticNetInput {
    X?: number[][];
    y?: number[];
    lambda1?: number;
    lambda2?: number;
    sweeps?: number;
}

function softThreshold(value: number, lambda: number): number {
    if (value > lambda) {
        return value - lambda;
    }
    if (value < -lambda) {
        return value + lambda;
    }
    return 0;
}

function objective(X: number[][], y: number[], w: number[], lambda1: number, lambda2: number): number {
    let total = 0;
    for (let i = 0; i < y.length; i += 1) {
        let prediction = 0;
        for (let j = 0; j < w.length; j += 1) {
            prediction += (X[i]?.[j] ?? 0) * (w[j] ?? 0);
        }
        const residual = (y[i] ?? 0) - prediction;
        total += 0.5 * residual * residual;
    }
    for (const value of w) {
        total += lambda1 * Math.abs(value) + 0.5 * lambda2 * value * value;
    }
    return total;
}

function bars(w: number[], current: number): VisualEntity[] {
    return w.map((value, index) => ({
        id: `w-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(6)),
        state: index === current ? "active" : index < current ? "sorted" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Fit elastic net coefficients with cyclic coordinate descent. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ElasticNetInput | null) ?? {};
    const X: number[][] = Array.isArray(task.X) && task.X.length > 0 ? task.X.map((row) => (Array.isArray(row) ? row.slice() : [])) : [[1, 0], [0, 1], [1, 1], [2, 1]];
    const y: number[] = Array.isArray(task.y) && task.y.length > 0 ? task.y.slice() : [1, 2, 3, 5];
    const lambda1 = typeof task.lambda1 === "number" && task.lambda1 >= 0 ? task.lambda1 : 0.3;
    const lambda2 = typeof task.lambda2 === "number" && task.lambda2 >= 0 ? task.lambda2 : 0.5;
    const sweeps = Math.max(1, Math.min(typeof task.sweeps === "number" ? Math.trunc(task.sweeps) : 6, 50));
    const d = X[0]?.length ?? 0;
    const w = new Array<number>(d).fill(0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(w, -1),
        edges: [],
        description: `Fitting elastic net on ${y.length} samples with ${d} features, lambda1 ${lambda1}, lambda2 ${lambda2}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { w: w.slice(), lambda1, lambda2, sweep: 0, feature: -1, objective: Number(objective(X, y, w, lambda1, lambda2).toFixed(6)) },
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
                        partial += (X[i]?.[k] ?? 0) * (w[k] ?? 0);
                    }
                }
                rho += xij * ((y[i] ?? 0) - partial);
                z += xij * xij;
            }
            const denominator = z + lambda2;
            w[j] = denominator > 0 ? softThreshold(rho, lambda1) / denominator : 0;
            const last = sweep === sweeps - 1 && j === d - 1;
            yield {
                stepNumber: step,
                entities: bars(w, j),
                edges: [],
                description: `Sweep ${sweep + 1}, feature ${j}: correlation ${rho.toFixed(3)}, denominator ${denominator.toFixed(3)}, new coefficient ${(w[j] ?? 0).toFixed(3)}.`,
                codeLineNumber: last ? 6 : 5,
                layout: "array",
                meta: {
                    w: w.map((v) => Number(v.toFixed(6))),
                    lambda1,
                    lambda2,
                    sweep: sweep + 1,
                    feature: j,
                    rho: Number(rho.toFixed(6)),
                    denominator: Number(denominator.toFixed(6)),
                    objective: Number(objective(X, y, w, lambda1, lambda2).toFixed(6)),
                },
            };
            step += 1;
        }
    }
}

/** The elastic net module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Elastic net is a linear model that pays two penalties for large coefficients. The absolute-value penalty can zero features out, which is useful for selection, while the squared penalty keeps correlated features from playing favorites. Coordinate descent fits one coefficient at a time to its best value given all the others: shrink the correlation with the residual by the L1 amount, then divide by the feature energy plus the L2 amount.",
        invariants: [
            "Each update forms the residual with the current feature removed.",
            "A coefficient is the soft-thresholded correlation divided by feature energy plus lambda2.",
            "The combined objective never increases after a coordinate update.",
        ],
        correctness:
            "Holding other coefficients fixed, the objective in one coefficient is a convex quadratic plus an absolute value. Its unique minimizer is the soft-thresholded partial correlation divided by the feature energy plus lambda2, exactly the update used. Cycling coordinates therefore descends a convex function and converges to a global elastic net solution; with an identity design the update equals soft threshold of y_j divided by one plus lambda2.",
        complexityRationale:
            "Each coordinate update scans n samples and d coefficients to rebuild the partial prediction, costing O(n d). With d coefficients per sweep and a fixed number of sweeps the total is O(sweeps times d squared times n), and only the d weights are stored.",
        uses: [
            "Sparse regression with groups of correlated predictors",
            "Genomics and finance models needing selection and shrinkage",
            "A stable alternative to pure lasso when features are collinear",
        ],
        references: [
            "Zou and Hastie, Regularization and Variable Selection via the Elastic Net, 2005",
            "Friedman et al., Regularization Paths for Generalized Linear Models, 2010",
        ],
        workedExample:
            "With an identity design and one target value y = 2, lambda1 = 0.3 and lambda2 = 0.5, the correlation is 2 and the denominator is 1.5, so the fitted coefficient is (2 minus 0.3) over 1.5, about 1.13. A target of 0.2 is soft thresholded to zero because it is smaller than lambda1, showing the selection effect.",
    },
    id: "elastic-net",
    name: "Elastic Net Regression",
    category: "ml-ai",
    complexity: { time: "O(sweeps * d^2 * n)", space: "O(d)" },
    defaultInput: { X: [[1, 0], [0, 1], [1, 1], [2, 1]], y: [1, 2, 3, 5], lambda1: 0.3, lambda2: 0.5, sweeps: 6 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize all coefficients to zero",
        "repeat for a fixed number of sweeps",
        "for each feature j compute correlation rho with the residual",
        "compute feature energy z over the samples",
        "set weight j to soft threshold of rho by lambda1 divided by z plus lambda2",
        "record the combined L1 plus L2 objective",
        "done: report the fitted coefficients",
    ],
};

export default module;
