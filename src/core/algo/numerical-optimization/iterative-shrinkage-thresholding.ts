/**
 * iterative-shrinkage-thresholding.ts - Iterative Shrinkage-Thresholding (ISTA)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ISTA solves the L1-regularized least-squares problem that promotes sparse
 * solutions. Each iteration takes one gradient step on the smooth data term
 * and then applies the soft-thresholding operator, which shrinks every
 * coordinate toward zero and sets small ones exactly to zero. The step size is
 * chosen from the Frobenius norm of the matrix so the method converges, giving
 * an O(1/k) objective gap and solutions with many zero entries.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * m * n) for an m by n matrix
 *   Space: O(m + n) for the residual and work vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current estimate of the sparse solution vector.
 *   - Exactly zero bars are the coordinates thresholded out of the model.
 *   - meta carries the estimate, objective, and fixed-point residual.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function matVec(a: number[][], x: number[]): number[] {
    return a.map((row) => row.reduce((sum, value, j) => sum + value * (x[j] ?? 0), 0));
}

function matVecT(a: number[][], r: number[]): number[] {
    const n = a[0]?.length ?? 0;
    return Array.from({ length: n }, (_, j) =>
        a.reduce((sum, row, i) => sum + (row[j] ?? 0) * (r[i] ?? 0), 0),
    );
}

function softThreshold(value: number, threshold: number): number {
    if (value > threshold) return value - threshold;
    if (value < -threshold) return value + threshold;
    return 0;
}

function objective(a: number[][], b: number[], x: number[], lambda: number): number {
    const r = matVec(a, x);
    let data = 0;
    for (let i = 0; i < b.length; i += 1) data += ((r[i] ?? 0) - (b[i] ?? 0)) ** 2;
    const sparse = x.reduce((sum, v) => sum + Math.abs(v), 0);
    return 0.5 * data + lambda * sparse;
}

function fixedPointResidual(a: number[][], b: number[], x: number[], step: number, lambda: number): number {
    const grad = matVecT(a, matVec(a, x).map((v, i) => v - (b[i] ?? 0)));
    const mapped = x.map((v, i) => softThreshold(v - step * (grad[i] ?? 0), lambda * step));
    return Math.sqrt(mapped.reduce((sum, v, i) => sum + (v - (x[i] ?? 0)) ** 2, 0));
}

function makeBars(x: number[]): VisualEntity[] {
    return x.map((value, index) => ({
        id: `x-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: value === 0 ? "sorted" : "active",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; b?: number[]; lambda?: number; iterations?: number } | null) ?? {};
    const raw = Array.isArray(task.matrix) ? task.matrix : [];
    const a: number[][] =
        raw.length > 0
            ? raw.map((row) => (Array.isArray(row) ? row.map((v) => Number(v)) : []))
            : [
                  [2, 0],
                  [0, 3],
                  [1, 1],
              ];
    const b: number[] = Array.isArray(task.b) ? task.b.map(Number) : [2, 3, 2];
    const m = a.length;
    const n = a[0]?.length ?? 0;
    const lambda = typeof task.lambda === "number" && task.lambda >= 0 ? task.lambda : 0.1;
    const iterations = Math.min(2000, Math.max(2, Math.floor(Number(task.iterations ?? 400)) || 400));

    let frobeniusSq = 0;
    for (const row of a) for (const value of row) frobeniusSq += value * value;
    const step = frobeniusSq > 0 ? 1 / frobeniusSq : 0;

    let x = Array.from({ length: n }, () => 0);
    const history: number[] = [objective(a, b, x, lambda)];

    yield {
        stepNumber: 0,
        entities: makeBars(x),
        edges: [],
        description: `ISTA on an ${m} by ${n} system with lambda ${lambda}; step size ${step.toFixed(4)} from the Frobenius norm.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { m, n, solution: [...x], objective: history[0], residual: fixedPointResidual(a, b, x, step, lambda), iteration: 0, history: [...history], step },
    };

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const grad = matVecT(a, matVec(a, x).map((v, i) => v - (b[i] ?? 0)));
        x = x.map((v, i) => softThreshold(v - step * (grad[i] ?? 0), lambda * step));
        const f = objective(a, b, x, lambda);
        history.push(f);

        yield {
            stepNumber: iteration,
            entities: makeBars(x),
            edges: [],
            description: `Iteration ${iteration}: objective ${f.toFixed(6)}, ${x.filter((v) => v === 0).length} of ${n} coordinates exactly zero.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { m, n, solution: [...x], objective: f, residual: fixedPointResidual(a, b, x, step, lambda), iteration, history: [...history], step },
        };
    }

    const finalResidual = fixedPointResidual(a, b, x, step, lambda);
    yield {
        stepNumber: iterations + 1,
        entities: makeBars(x),
        edges: [],
        description: `Final sparse estimate with objective ${(history[history.length - 1] ?? 0).toFixed(8)} and fixed-point residual ${finalResidual.toExponential(2)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { m, n, solution: [...x], objective: history[history.length - 1] ?? 0, residual: finalResidual, iteration: iterations, history: [...history], step },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "ISTA solves sparse regression by alternating two simple operations. First it takes a gradient step that reduces the prediction error, then it soft-thresholds each coordinate toward zero. Soft thresholding sets small coefficients exactly to zero, so the iterate becomes progressively sparser. Repeating the pair of steps converges to a solution that balances fit against the number of nonzero coefficients.",
        invariants: [
            "The objective value is non-increasing when the step size is at most the reciprocal smoothness constant.",
            "Soft thresholding maps a coordinate to exactly zero whenever its magnitude is below the threshold.",
            "Any zero coordinate stays zero until a gradient step pushes it past the threshold again.",
        ],
        correctness:
            "The L1 objective splits into a smooth quadratic term and a separable nonsmooth term. The proximal operator of the weighted L1 term is coordinate-wise soft thresholding, so one ISTA step is a proximal gradient step. With a step size no larger than one over the largest eigenvalue of A transpose times A, the majorization inequality guarantees the objective decreases every iteration and the iterates converge to a minimizer; here the Frobenius norm squared upper bounds that eigenvalue, so the chosen step is safe. At a fixed point the optimality condition of the proximal gradient map holds, certifying a minimizer.",
        complexityRationale:
            "Each iteration multiplies by A and by its transpose, costing O(m n), followed by O(n) thresholding. The history stores one scalar per iteration, and the work vectors use O(m + n) space.",
        uses: [
            "Sparse signal recovery and compressed sensing",
            "Feature selection in high-dimensional regression such as the lasso",
            "Image restoration and deconvolution with sparsity priors",
        ],
        references: [
            "Daubechies, Defrise, and De Mol, An Iterative Thresholding Algorithm, 2004",
            "Beck and Teboulle, A Fast Iterative Shrinkage-Thresholding Algorithm, 2009",
        ],
        workedExample:
            "For a simple diagonal system with A = identity, b = [2, 0.05], and lambda = 0.1, the first gradient step gives [something near 2, 0.05], after subtracting the threshold of 0.1 the second coordinate becomes exactly zero, and the first settles near 1.9. The result is sparse: the tiny coefficient has been removed while the large one is only slightly shrunk.",
    },
    id: "iterative-shrinkage-thresholding",
    name: "Iterative Shrinkage-Thresholding (ISTA)",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * m * n)", space: "O(m + n)" },
    defaultInput: {
        matrix: [
            [2, 0],
            [0, 3],
            [1, 1],
        ],
        b: [2, 3, 2],
        lambda: 0.1,
        iterations: 400,
    },
    visualType: "array",
    run,
    pseudocode: [
        "compute a safe step size from the Frobenius norm of A",
        "start the estimate at the zero vector",
        "for each iteration compute the gradient of the data term",
        "take a gradient step and soft-threshold every coordinate",
        "record the objective value for this iterate",
        "stop after the iteration budget and report the sparse estimate",
    ],
};

export default module;
