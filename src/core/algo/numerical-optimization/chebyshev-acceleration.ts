/**
 * chebyshev-acceleration.ts - Chebyshev Semi-Iterative Linear Solver
 *
 * Accelerates Richardson iteration for a symmetric positive definite system
 * Ax = b whose eigenvalues lie in a known interval [a, b]. Instead of a fixed
 * relaxation factor, a fixed number of steps uses distinct factors derived
 * from the zeros of a Chebyshev polynomial. Those factors minimize the worst
 * case error over the whole eigenvalue interval after the chosen step count.
 *
 * Limits of the demo: A is a small dense symmetric positive definite matrix
 * supplied explicitly, the eigenvalue bounds are supplied or defaulted, and
 * the step count is fixed in advance. There is no preconditioner, no
 * restart, and no nonsymmetric support.
 *
 * Time: O(steps * n^2) for dense matrix-vector products. Space: O(n).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Chebyshev-Richardson relaxation factors for eigenvalues in [a, b]. */
export function chebyshevFactors(a: number, b: number, steps: number): number[] {
    const count = Math.max(1, Math.floor(steps));
    return Array.from({ length: count }, (_, k) => {
        const angle = ((2 * k + 1) * Math.PI) / (2 * count);
        return 2 / (b + a - (b - a) * Math.cos(angle));
    });
}

/** Matrix-vector product for a dense square matrix. */
function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, j) => sum + value * (vector[j] as number), 0));
}

/** Exact dense solve used to report the reference residual. */
export function exactSolve(matrix: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const A = matrix.map((row, i) => [...row, rhs[i] as number]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs((A[row] as number[])[col] as number) > Math.abs((A[pivot] as number[])[col] as number)) {
                pivot = row;
            }
        }
        [A[col], A[pivot]] = [A[pivot] as number[], A[col] as number[]];
        const pv = (A[col] as number[])[col] as number;
        for (let j = col; j <= n; j += 1) {
            (A[col] as number[])[j] = (A[col] as number[])[j] as number / pv;
        }
        for (let row = 0; row < n; row += 1) {
            if (row === col) {
                continue;
            }
            const factor = (A[row] as number[])[col] as number;
            for (let j = col; j <= n; j += 1) {
                (A[row] as number[])[j] = (A[row] as number[])[j] as number - factor * ((A[col] as number[])[j] as number);
            }
        }
    }
    return A.map((row) => (row[n] as number));
}

function norm(values: number[]): number {
    return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

function makeBars(vector: number[], residual: number, active: number): VisualEntity[] {
    return [...vector, residual].map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: index < vector.length ? `x${index}=${value.toFixed(5)}` : `residual=${value.toExponential(2)}`,
        value,
        state: index === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index < vector.length ? "unknown" : "residual" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        matrix?: number[][];
        rhs?: number[];
        lower?: number;
        upper?: number;
        steps?: number;
    } | null) ?? {};
    const matrix = Array.isArray(task.matrix) && task.matrix.length > 0
        ? task.matrix.map((row) => row.map(Number))
        : [[4, 1], [1, 3]];
    const rhs = Array.isArray(task.rhs) && task.rhs.length === matrix.length
        ? task.rhs.map(Number)
        : [1, 2];
    const steps = Math.min(40, Math.max(1, Math.floor(Number(task.steps ?? 16)) || 16));
    const reference = exactSolve(matrix, rhs);
    const a = typeof task.lower === "number" ? task.lower : 2;
    const b = typeof task.upper === "number" ? task.upper : 5;
    const factors = chebyshevFactors(a, b, steps);
    const n = rhs.length;
    let x = new Array<number>(n).fill(0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(x, norm(rhs), -1),
        edges: [],
        description: `Solve a ${n} by ${n} positive definite system with ${steps} Chebyshev-Richardson steps over [${a}, ${b}].`,
        codeLineNumber: 0,
        layout: "array",
        meta: { factors: [...factors], residuals: [norm(rhs)], x: [...x], steps, interval: [a, b] },
    };
    step += 1;

    const residuals: number[] = [norm(rhs)];
    for (let k = 0; k < steps; k += 1) {
        const Ax = matVec(matrix, x);
        const r = rhs.map((value, i) => value - (Ax[i] as number));
        const omega = factors[k] as number;
        x = x.map((value, i) => value + omega * (r[i] as number));
        const residual = norm(rhs.map((value, i) => value - (matVec(matrix, x)[i] as number)));
        residuals.push(residual);
        yield {
            stepNumber: step,
            entities: makeBars(x, residual, k),
            edges: [],
            description: `Step ${k + 1}: relaxation factor ${omega.toFixed(6)}, residual norm ${residual.toExponential(3)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                factors: [...factors],
                residuals: [...residuals],
                x: [...x],
                omega,
                iteration: k + 1,
                errorToExact: norm(x.map((value, i) => value - (reference[i] as number))),
            },
        };
        step += 1;
    }

    const finalResidual = residuals[residuals.length - 1] as number;
    yield {
        stepNumber: step,
        entities: makeBars(x, finalResidual, -1),
        edges: [],
        description: `After ${steps} steps the residual is ${finalResidual.toExponential(3)} versus ${(norm(rhs)).toExponential(3)} initially.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            factors: [...factors],
            residuals: [...residuals],
            x: [...x],
            reference: [...reference],
            finalResidual,
            initialResidual: residuals[0] as number,
            converged: finalResidual < 1e-8,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain Richardson iteration repeatedly subtracts a fixed multiple of the residual. If the matrix has a wide spread of eigenvalues, no single factor works well for all of them. Chebyshev acceleration uses a different carefully chosen factor at every step; together they apply a Chebyshev polynomial that is tiny across the entire eigenvalue interval, so every error component is damped.",
        invariants: [
            "The error after k steps is a degree-k polynomial in A applied to the initial error.",
            "The relaxation factors are the reciprocal of affine-mapped Chebyshev zeros.",
            "The iterates converge whenever the spectral radius of I - omega A is below one for every factor.",
        ],
        correctness:
            "For eigenvalues in [a, b] the error polynomial of Chebyshev-Richardson is T_k((b+a-2 lambda)/(b-a)) divided by T_k((b+a)/(b-a)). Chebyshev polynomials have magnitude at most one on [-1, 1] and grow fastest outside it, which makes the denominator as large as possible and the error on the whole spectrum as small as possible among all degree-k methods with the same starting value. Hence the residual decreases geometrically at a rate governed by the condition number.",
        complexityRationale:
            "Each step forms one dense matrix-vector product and vector updates, costing O(n^2) for an n by n matrix, so the total is O(steps * n^2). Only the current iterate, residual and factor list are stored, giving O(n + steps) space.",
        uses: [
            "Accelerating fixed-point iterations in finite element solvers",
            "Smoothing error modes inside multigrid methods",
            "Solving large sparse symmetric systems when a good eigenvalue bound is known",
        ],
        references: [
            "Saad, Iterative Methods for Sparse Linear Systems, 2nd edition",
            "Axelsson, Iterative Solution Methods, 1994",
        ],
        workedExample:
            "For the matrix [[4,1],[1,3]] with eigenvalues about 2.382 and 4.618, the interval [2,5] and eight steps, the relaxation factors range roughly from 0.23 to 0.44. Starting at zero the residual falls from 2.236 to below 1e-7, and the iterates approach the exact solution (1/11, 7/11).",
    },
    id: "chebyshev-acceleration",
    name: "Chebyshev Acceleration",
    category: "numerical-optimization",
    complexity: { time: "O(steps * n^2)", space: "O(n + steps)" },
    defaultInput: { matrix: [[4, 1], [1, 3]], rhs: [1, 2], lower: 2, upper: 5, steps: 16 },
    visualType: "array",
    run,
    pseudocode: [
        "read the matrix, right-hand side and eigenvalue interval",
        "compute one relaxation factor per planned step",
        "start from the zero iterate",
        "for each step form the residual b minus A x",
        "update x by adding the current factor times the residual",
        "record the new residual norm",
        "after the last step compare with the exact solve",
        "done: report factors, iterates and final residual",
    ],
};

export default module;
