/**
 * basis-pursuit.ts - Basis Pursuit via ADMM
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Basis pursuit finds the sparsest vector x that satisfies A x = b by
 * minimizing the L1 norm of x subject to that linear constraint. The L1 norm is
 * the convex relaxation of counting nonzero entries, so the solution tends to
 * have many exact zeros and is the foundation of compressed sensing. This
 * module solves the equality-constrained problem with the alternating direction
 * method of multipliers (ADMM): a soft-threshold step minimizes the L1 term, an
 * affine projection enforces A x = b exactly, and a dual update drives the two
 * subproblems toward agreement.
 *
 * The implementation uses a fixed small matrix and exact linear solves with
 * partial pivoting, so the result is deterministic. It assumes A has full row
 * rank; a tiny ridge keeps the inner system solvable near rank deficiency. On
 * larger or noisy data a denoising variant with a data-fidelity term is used in
 * practice, which is outside this teaching model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * (m n + m^3)) for m rows and n columns
 *   Space: O(m n + m^2) for the matrix and the small projection system
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per dictionary coefficient shows its current magnitude.
 *   - The coefficient updated this iteration is yellow, the final support is green.
 *   - The metadata carries the coefficient vector, feasibility residual, and support.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BasisPursuitInput {
    matrix?: number[][];
    b?: number[];
    rho?: number;
    iterations?: number;
}

// A 6 by 12 generic dictionary with a unique two-sparse solution for the demo signal.
const DEFAULT_A = [
    [-0.959195, -0.966904, 0.086312, 0.269808, 0.820059, -0.775077, -0.008221, 0.096698, 0.1922, 0.566901, -0.920291, 0.487602],
    [0.931619, -0.852665, 0.399214, -0.079412, -0.207033, 0.919043, -0.187749, 0.905528, 0.987357, 0.327401, -0.154209, -0.000151],
    [-0.42543, -0.153395, 0.350637, -0.689393, -0.822462, 0.705372, -0.376875, -0.985859, -0.074666, -0.416644, 0.145969, 0.924554],
    [-0.969069, 0.55951, -0.395504, -0.357729, 0.909976, 0.093655, 0.334524, 0.31393, 0.246832, -0.677501, 0.858128, 0.534845],
    [-0.085866, 0.45136, -0.336454, 0.425303, 0.152106, 0.522844, -0.114523, -0.588068, -0.086098, 0.343728, 0.042019, 0.745403],
    [-0.216792, 0.851286, 0.484503, -0.71429, 0.370359, -0.29967, -0.283546, 0.586274, 0.593222, -0.647801, -0.762041, -0.19187],
];

/** Solve a small dense system by Gaussian elimination, with a ridge for near singularity. */
function solve(a: number[][], b: number[]): number[] {
    const n = b.length;
    const aug = a.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(aug[r]![col]!) > Math.abs(aug[pivot]![col]!)) pivot = r;
        }
        if (Math.abs(aug[pivot]![col]!) < 1e-12) aug[pivot]![col] = aug[pivot]![col]! + 1e-10;
        if (pivot !== col) {
            const tmp = aug[col]!;
            aug[col] = aug[pivot]!;
            aug[pivot] = tmp;
        }
        const pv = aug[col]![col]!;
        for (let r = col + 1; r < n; r += 1) {
            const factor = aug[r]![col]! / pv;
            for (let c = col; c <= n; c += 1) aug[r]![c] = aug[r]![c]! - factor * aug[col]![c]!;
        }
    }
    const x = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
        let sum = aug[i]![n]!;
        for (let j = i + 1; j < n; j += 1) sum -= aug[i]![j]! * x[j]!;
        x[i] = sum / aug[i]![i]!;
    }
    return x;
}

function matVec(a: number[][], x: number[]): number[] {
    return a.map((row) => row.reduce((s, v, j) => s + v * (x[j] ?? 0), 0));
}

function transpose(a: number[][]): number[][] {
    if (a.length === 0) return [];
    return a[0]!.map((_, j) => a.map((row) => row[j] ?? 0));
}

function matMul(a: number[][], b: number[][]): number[][] {
    return a.map((row) =>
        b[0]!.map((_, j) => row.reduce((s, v, k) => s + v * (b[k]![j] ?? 0), 0)),
    );
}

/** Soft threshold (shrinkage) operator applied elementwise. */
function softThreshold(x: number[], threshold: number): number[] {
    return x.map((v) => Math.sign(v) * Math.max(0, Math.abs(v) - threshold));
}

function makeBars(x: number[], active: number, done: boolean): VisualEntity[] {
    return x.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Math.abs(value),
        state: (done ? (Math.abs(value) > 1e-3 ? "sorted" : "idle") : i === active ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, coefficient: value },
    }));
}

/** The basis pursuit generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BasisPursuitInput | null) ?? {};
    const A = Array.isArray(task.matrix) && task.matrix.length > 0
        ? task.matrix.map((row) => [...row])
        : DEFAULT_A.map((row) => [...row]);
    const m = A.length;
    const n = A[0]?.length ?? 0;
    const trueX = [2, 0, 0, 0, 0, 0, 0, -1.5, 0, 0, 0, 0];
    const b = Array.isArray(task.b) ? [...task.b] : matVec(A, trueX.slice(0, n));
    const rho = typeof task.rho === "number" && task.rho > 0 ? task.rho : 10;
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.min(600, Math.floor(task.iterations))) : 400;

    const At = transpose(A);
    const AAt = matMul(A, At);
    const threshold = 1 / rho;

    let x = new Array<number>(n).fill(0);
    let z = new Array<number>(n).fill(0);
    let u = new Array<number>(n).fill(0);
    let step = 0;

    const feasibility = (vec: number[]): number => {
        const resid = matVec(A, vec).map((v, i) => v - (b[i] ?? 0));
        return Math.sqrt(resid.reduce((s, r) => s + r * r, 0));
    };

    const frame = (description: string, line: number, active: number, done = false): VisualFrame => {
        const support = x.map((v, i) => (Math.abs(v) > 1e-3 ? i : -1)).filter((i) => i >= 0);
        return {
            stepNumber: step++,
            entities: makeBars(x, active, done),
            edges: [],
            description,
            codeLineNumber: line,
            layout: "array",
            meta: { m, n, rho, iterations, x: [...x], residual: feasibility(x), support, l1: x.reduce((s, v) => s + Math.abs(v), 0) },
        };
    };

    yield frame(`Basis pursuit on a ${m} by ${n} dictionary: find sparse x with A x = b.`, 0, -1);

    for (let iter = 0; iter < iterations; iter += 1) {
        // x-update: minimize L1 plus a quadratic penalty around z - u.
        x = softThreshold(z.map((v, i) => v - (u[i] ?? 0)), threshold);

        // z-update: Euclidean projection of x + u onto the affine set {z : A z = b}.
        const p = x.map((v, i) => v + (u[i] ?? 0));
        const w = solve(AAt, matVec(A, p).map((v, i) => v - (b[i] ?? 0)));
        z = p.map((v, i) => v - At[i]!.reduce((s, aij, j) => s + aij * (w[j] ?? 0), 0));

        // Dual ascent.
        u = u.map((v, i) => v + (x[i] ?? 0) - (z[i] ?? 0));

        if (iter % Math.max(1, Math.floor(iterations / 8)) === 0 || iter === iterations - 1) {
            const maxIdx = x.reduce((best, v, i) => (Math.abs(v) > Math.abs(x[best] ?? 0) ? i : best), 0);
            yield frame(
                `ADMM iteration ${iter + 1}: feasibility residual ${feasibility(x).toExponential(2)}, L1 norm ${x.reduce((s, v) => s + Math.abs(v), 0).toFixed(4)}.`,
                2,
                maxIdx,
            );
        }
    }

    const support = x.map((v, i) => (Math.abs(v) > 1e-3 ? i : -1)).filter((i) => i >= 0);
    yield frame(
        `Converged: ${support.length} nonzero coefficient(s) at indices [${support.join(", ")}] with feasibility residual ${feasibility(x).toExponential(2)}.`,
        5,
        -1,
        true,
    );
}

/** The basis pursuit module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Basis pursuit asks for the sparsest vector that explains the measurements. Minimizing the count of nonzeros is hard, so we minimize the L1 norm instead; geometrically this pushes the solution into the corners of a diamond, where many coordinates are exactly zero. ADMM alternates a simple shrinkage step that promotes sparsity with a projection step that enforces the measurement equations, and the two agree in the limit.",
        invariants: [
            "The soft-threshold step sets small coefficients exactly to zero.",
            "The projection step enforces A z = b at every iteration.",
            "The dual variable accumulates the disagreement between the sparse and feasible solutions.",
        ],
        correctness:
            "The problem min ||x||_1 subject to A x = b is a convex optimization. ADMM splits it into an L1 subproblem with a closed-form soft-threshold solution and a Euclidean projection onto the affine feasible set. With a full-row-rank A the projection is well defined, and standard ADMM convergence for convex objectives with a feasible affine constraint gives convergence to an optimal solution. The L1 objective is the convex envelope of the L0 count on the unit ball, so its minimizer is the sparsest feasible vector under the usual incoherence conditions, and the shrinkage operator creates exact zeros that reveal that support.",
        complexityRationale:
            "Each iteration forms A x and A^T w in O(m n), solves an m by m system in O(m^3), and updates n coefficients, so time is O(iterations * (m n + m^3)). Storing A, its transpose, and the projection system uses O(m n + m^2) space.",
        uses: [
            "Compressed sensing and sparse signal recovery",
            "Sparse Dictionary learning and feature selection",
            "Underdetermined inverse problems in imaging and geophysics",
        ],
        references: [
            "Chen, Donoho, and Saunders, Atomic Decomposition by Basis Pursuit, 1998",
            "Boyd et al., Distributed Optimization and Statistical Learning via ADMM, 2011",
        ],
        workedExample:
            "With a 6 by 12 dictionary and measurements b = A x for a vector x with two nonzeros at indices 0 and 7, basis pursuit returns a solution whose largest coefficients sit at those same indices and whose other entries are zero, while A x still reproduces b exactly.",
    },
    id: "basis-pursuit",
    name: "Basis Pursuit via ADMM",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * (m n + m^3))", space: "O(m n + m^2)" },
    defaultInput: { rho: 10, iterations: 400 },
    visualType: "array",
    run,
    pseudocode: [
        "read the dictionary A, measurements b, and penalty rho",
        "initialize the primal, auxiliary, and dual vectors to zero",
        "precompute A transpose A and its factorization",
        "for each iteration apply soft threshold to z minus u",
        "project x plus u onto the set satisfying A z equals b",
        "update the dual variable by the primal residual",
        "record the feasibility residual and support",
        "done: report the sparse coefficient vector",
    ],
};

export default module;
