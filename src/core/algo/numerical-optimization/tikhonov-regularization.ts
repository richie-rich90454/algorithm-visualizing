/**
 * tikhonov-regularization.ts - Tikhonov (Ridge) Regularization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Tikhonov regularization stabilizes an ill-posed least-squares problem by
 * adding a penalty on the size of the solution. Instead of minimizing only
 * ||Ax - b||^2, it minimizes ||Ax - b||^2 + lambda * ||x||^2. Setting the
 * gradient to zero gives the normal equations (A^T A + lambda I) x = A^T b,
 * which are a small, well-conditioned linear system. The parameter lambda
 * trades data fit against solution norm: lambda = 0 is ordinary least squares,
 * and larger lambda shrinks the coefficients toward zero.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m*n^2 + n^3) to form A^T A and solve with Gaussian elimination
 *   Space: O(n^2) for the normal matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each component of x is a bar; height encodes the coefficient.
 *   - Bars shrink visibly as lambda grows, showing the regularization path.
 *   - meta carries lambda, the solution, its norm, and the residual.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Solve a square linear system by Gaussian elimination with partial pivoting. */
export function solveLinear(matrix: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const a = matrix.map((row, i) => [...row, rhs[i] as number]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(a[r]?.[col] as number) > Math.abs(a[pivot]?.[col] as number)) {
                pivot = r;
            }
        }
        const swap = a[col] as number[];
        a[col] = a[pivot] as number[];
        a[pivot] = swap;
        const pivotValue = a[col]?.[col] as number;
        if (Math.abs(pivotValue) < 1e-15) {
            return Array.from({ length: n }, () => 0);
        }
        for (let c = col; c <= n; c += 1) {
            a[col]![c] = (a[col]?.[c] as number) / pivotValue;
        }
        for (let r = 0; r < n; r += 1) {
            if (r === col) {
                continue;
            }
            const factor = a[r]?.[col] as number;
            if (factor === 0) {
                continue;
            }
            for (let c = col; c <= n; c += 1) {
                a[r]![c] = (a[r]?.[c] as number) - factor * (a[col]?.[c] as number);
            }
        }
    }
    return a.map((row) => row[n] as number);
}

/** Solve the Tikhonov-regularized least-squares problem. */
export function tikhonov(matrix: number[][], b: number[], lambda: number): number[] {
    const m = matrix.length;
    const n = matrix[0]?.length ?? 0;
    const normal: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    const rhs = Array.from({ length: n }, () => 0);
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let sum = 0;
            for (let r = 0; r < m; r += 1) {
                sum += (matrix[r]?.[i] as number) * (matrix[r]?.[j] as number);
            }
            normal[i]![j] = sum + (i === j ? lambda : 0);
        }
        let sum = 0;
        for (let r = 0; r < m; r += 1) {
            sum += (matrix[r]?.[i] as number) * (b[r] ?? 0);
        }
        rhs[i] = sum;
    }
    return solveLinear(normal, rhs);
}

/** Residual norm of Ax - b. */
export function residualNorm(matrix: number[][], b: number[], x: number[]): number {
    let sum = 0;
    for (let i = 0; i < matrix.length; i += 1) {
        const row = matrix[i] ?? [];
        let dot = 0;
        for (let j = 0; j < x.length; j += 1) {
            dot += (row[j] ?? 0) * (x[j] as number);
        }
        const difference = dot - (b[i] ?? 0);
        sum += difference * difference;
    }
    return Math.sqrt(sum);
}

/** Objective value ||Ax-b||^2 + lambda ||x||^2. */
export function objectiveValue(matrix: number[][], b: number[], x: number[], lambda: number): number {
    const residual = residualNorm(matrix, b, x);
    const normSquared = x.reduce((sum, value) => sum + value * value, 0);
    return residual * residual + lambda * normSquared;
}

/** Build bar entities for a coefficient vector. */
function makeBars(x: number[], active: boolean): VisualEntity[] {
    return x.map((value, index) => ({
        id: `x-${index}`,
        type: "bar" as const,
        label: `x${index}=${value.toFixed(3)}`,
        value,
        state: active ? "comparing" : Math.abs(value) > 1e-6 ? "sorted" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** The Tikhonov regularization generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; b?: number[]; lambdas?: number[] } | null) ?? {};
    const matrix: number[][] = Array.isArray(task.matrix) && task.matrix.length > 0
        ? task.matrix.map((row) => [...row])
        : [[1, 1], [1, 1.0001], [1, 0.9999]];
    const b: number[] = Array.isArray(task.b) && task.b.length > 0 ? [...task.b] : [2, 2.0001, 1.9999];
    const lambdas: number[] = Array.isArray(task.lambdas) && task.lambdas.length > 0
        ? [...task.lambdas]
        : [0, 0.001, 0.01, 0.1, 1];
    const n = matrix[0]?.length ?? 0;

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(Array.from({ length: n }, () => 0), false),
        edges: [],
        description: `Ridge regularization on a ${matrix.length} by ${n} system; sweeping ${lambdas.length} lambda value(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: matrix.length, cols: n, lambda: lambdas[0] ?? 0, norm: 0, residual: residualNorm(matrix, b, Array(n).fill(0)), x: Array(n).fill(0) },
    };

    let previousNorm = Infinity;
    for (const lambda of lambdas) {
        const x = tikhonov(matrix, b, lambda);
        const norm = Math.sqrt(x.reduce((sum, value) => sum + value * value, 0));
        const residual = residualNorm(matrix, b, x);
        const objective = objectiveValue(matrix, b, x, lambda);
        yield {
            stepNumber: step++,
            entities: makeBars(x, true),
            edges: [],
            description: `lambda ${lambda}: solution (${x.map((value) => value.toFixed(4)).join(", ")}), norm ${norm.toFixed(4)}, residual ${residual.toExponential(2)}${norm < previousNorm ? "; coefficients shrank" : ""}.`,
            codeLineNumber: lambda === 0 ? 2 : 4,
            layout: "array",
            meta: { rows: matrix.length, cols: n, lambda, norm, residual, objective, x, shrank: norm < previousNorm },
        };
        previousNorm = norm;
    }

    const finalLambda = lambdas[lambdas.length - 1] as number;
    const finalX = tikhonov(matrix, b, finalLambda);
    yield {
        stepNumber: step,
        entities: makeBars(finalX, false),
        edges: [],
        description: `At lambda ${finalLambda}, the penalty trades a ${residualNorm(matrix, b, finalX).toExponential(2)} residual for a coefficient norm of ${Math.sqrt(finalX.reduce((sum, value) => sum + value * value, 0)).toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            rows: matrix.length,
            cols: n,
            lambda: finalLambda,
            norm: Math.sqrt(finalX.reduce((sum, value) => sum + value * value, 0)),
            residual: residualNorm(matrix, b, finalX),
            x: finalX,
            lambdas,
            note: "ridge penalty lambda times the squared norm; lambda zero is ordinary least squares",
        },
    };
}

/** The Tikhonov regularization module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "When a least-squares problem is ill-conditioned, the data may be almost unable to distinguish between very different solutions, so ordinary least squares produces huge, unstable coefficients. Tikhonov regularization adds a price for large coefficients to the objective. Minimizing the combined objective is just solving a slightly modified normal equation, and turning up the penalty smoothly shrinks the answer toward zero.",
        invariants: [
            "For lambda = 0 the solution is the ordinary least-squares solution.",
            "The solution always satisfies (A^T A + lambda I) x = A^T b.",
            "Increasing lambda never increases the coefficient norm for a fixed problem.",
        ],
        correctness:
            "The objective f(x) = ||Ax - b||^2 + lambda ||x||^2 is a convex quadratic. Its gradient is 2(A^T A x - A^T b + lambda x); setting that to zero gives the normal equations solved here. For lambda > 0 the matrix A^T A + lambda I is positive definite even if A^T A is singular, so the solution exists and is unique. Because the added term penalizes large x, increasing lambda trades a larger data residual for a smaller coefficient norm, which is exactly the bias-variance tradeoff of ridge regression.",
        complexityRationale:
            "Forming A^T A takes m*n^2 multiply-adds, and Gaussian elimination on the n by n system takes O(n^3), giving O(m*n^2 + n^3) time. The normal matrix and right-hand side use O(n^2) space.",
        uses: [
            "Ridge regression in statistics and machine learning",
            "Stabilizing inverse problems such as image deblurring and tomography",
            "Regularizing ill-conditioned parameter estimation in engineering",
        ],
        references: [
            "Tikhonov and Arsenin, Solutions of Ill-Posed Problems, 1977",
            "Hoerl and Kennard, Ridge Regression: Biased Estimation for Nonorthogonal Problems, 1970",
        ],
        workedExample:
            "For an almost-rank-deficient matrix with two nearly identical rows, ordinary least squares can return coefficients around 1000 and -999. Adding lambda = 0.1 to the diagonal of A^T A yields coefficients near 1 and 1, a much more stable explanation of the same data at the cost of a tiny residual increase.",
    },
    id: "tikhonov-regularization",
    name: "Tikhonov Regularization",
    category: "numerical-optimization",
    complexity: { time: "O(m*n^2 + n^3)", space: "O(n^2)" },
    defaultInput: { matrix: [[1, 1], [1, 1.0001], [1, 0.9999]], b: [2, 2.0001, 1.9999], lambdas: [0, 0.001, 0.01, 0.1, 1] },
    visualType: "array",
    run,
    pseudocode: [
        "choose the regularization parameter lambda",
        "form the normal matrix A transpose times A",
        "add lambda to each diagonal entry",
        "form the right-hand side A transpose times b",
        "solve the resulting linear system for x",
        "the solution minimizes data fit plus lambda times norm",
        "increase lambda to shrink coefficients toward zero",
        "repeat along a sweep of lambda values",
        "done: report solutions, norms, and residuals",
    ],
};

export default module;
