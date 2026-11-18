/**
 * preconditioned-conjugate-gradient.ts - Preconditioned Conjugate Gradient
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Preconditioned conjugate gradient solves A x = b for a symmetric positive
 * definite matrix A by changing the geometry with a positive definite
 * preconditioner M. Instead of using the raw residual as the search direction,
 * it solves M z = r and builds directions from z, which clusters the eigenvalues
 * of M inverse A and cuts the iteration count when M approximates A. With the
 * Jacobi preconditioner M equal to the diagonal of A this costs only one extra
 * division per component.
 *
 * The model solves a small dense SPD system with a diagonal preconditioner.
 * It assumes A and M are positive definite and does not implement a flexible
 * or nonlinear preconditioner, so it is a faithful but limited teaching model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) for a dense matrix-vector product
 *   Space: O(n) for the vectors beyond the matrix and preconditioner
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per component shows the current solution estimate.
 *   - Intermediate iterates are yellow; the converged solution is green.
 *   - meta carries the iterate, residual norm, and iteration count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0));
}

function dot(left: number[], right: number[]): number {
    return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

/** Build solution bars for the current iterate. */
function makeBars(vector: number[], state: EntityState): VisualEntity[] {
    return vector.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `x${index}=${value.toFixed(4)}`,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The preconditioned conjugate gradient generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { A?: number[][]; b?: number[]; MInv?: number[]; iterations?: number; tolerance?: number }
        | null
    ) ?? {};
    const A: number[][] =
        Array.isArray(task.A) && task.A.length > 0
            ? task.A.map((row) => (Array.isArray(row) ? [...row] : []))
            : [
                  [4, 1],
                  [1, 3],
              ];
    const n = A.length;
    const b: number[] = Array.isArray(task.b) && task.b.length === n ? [...task.b] : [1, 2];
    const mInv: number[] =
        Array.isArray(task.MInv) && task.MInv.length === n
            ? task.MInv.map((value) => (Number(value) > 0 ? Number(value) : 1))
            : A.map((row, index) => 1 / (row[index] ?? 1));
    const iterations = Math.min(1000, Math.max(1, Math.floor(Number(task.iterations ?? 40)) || 40));
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-10;

    const applyM = (vector: number[]) => vector.map((value, index) => value * (mInv[index] ?? 1));
    let x: number[] = Array.from({ length: n }, () => 0);
    let r: number[] = [...b];
    let z: number[] = applyM(r);
    let p: number[] = [...z];
    let rz = dot(r, z);
    let converged = Math.sqrt(dot(r, r)) < tolerance;
    let used = 0;

    const meta = (done: boolean) => ({
        n,
        iteration: used,
        x: [...x],
        residual: Math.sqrt(dot(r, r)),
        mInv: [...mInv],
        converged: done,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(x, converged ? "sorted" : "idle"),
        edges: [],
        description: `Solving a ${n} by ${n} SPD system with a diagonal preconditioner; apply M inverse by componentwise division.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(converged),
    };
    let step = 1;

    for (let k = 0; k < iterations && !converged; k += 1) {
        const Ap = matVec(A, p);
        const denominator = dot(p, Ap);
        if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-18) {
            break;
        }
        const alpha = rz / denominator;
        x = x.map((value, index) => value + alpha * (p[index] ?? 0));
        const rNew = r.map((value, index) => value - alpha * (Ap[index] ?? 0));
        r = rNew;
        used = k + 1;
        converged = Math.sqrt(dot(r, r)) < tolerance;
        yield {
            stepNumber: step,
            entities: makeBars(x, converged ? "sorted" : "comparing"),
            edges: [],
            description: `Iteration ${used}: step alpha ${alpha.toFixed(6)}, residual norm ${Math.sqrt(dot(r, r)).toExponential(2)}.`,
            codeLineNumber: converged ? 7 : 3,
            layout: "array",
            meta: meta(converged),
        };
        step += 1;
        if (converged) {
            break;
        }
        const zNew = applyM(r);
        const rzNew = dot(r, zNew);
        const beta = rzNew / rz;
        p = zNew.map((value, index) => value + beta * (p[index] ?? 0));
        z = zNew;
        rz = rzNew;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, "sorted"),
        edges: [],
        description: converged
            ? `Converged in ${used} iteration(s); residual norm ${Math.sqrt(dot(r, r)).toExponential(2)}.`
            : `Stopped after ${used} iteration(s) without reaching the tolerance.`,
        codeLineNumber: 8,
        layout: "array",
        meta: meta(converged),
    };
}

/** The preconditioned conjugate gradient module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Conjugate gradient can stall when a system is ill conditioned, meaning its levels of curvature differ greatly. A preconditioner reshapes the problem so those curvatures look more alike. Each step applies the inverse preconditioner to the residual before forming the search direction; a good preconditioner makes the method converge in far fewer iterations while each iteration costs about the same.",
        invariants: [
            "The preconditioner is symmetric positive definite, so applying its inverse preserves the descent property.",
            "Consecutive search directions are conjugate with respect to A in the preconditioned geometry.",
            "The residual at each step is orthogonal to all previous search directions.",
        ],
        correctness:
            "Preconditioned conjugate gradient is ordinary conjugate gradient applied to the symmetrically transformed system M to the power of minus half times A times M to the power of minus half, whose condition number is improved. All conjugate-gradient proofs carry over, so the iterates are optimal in the energy norm over the expanding preconditioned Krylov subspace and reach the exact solution in at most n steps in exact arithmetic, typically much sooner with a good M.",
        complexityRationale:
            "Each iteration needs one dense matrix-vector product at O(n^2), one preconditioner application at O(n) for a diagonal M, and O(n) vector work. Beyond the matrix and preconditioner, only a handful of length-n vectors are stored, giving O(n) extra space.",
        uses: [
            "Large sparse finite element and fluid dynamics solvers",
            "Machine learning subproblems with ill-conditioned Hessians",
            "Any iterative linear solve where a cheap approximate inverse is known",
        ],
        references: [
            "Saad, Iterative Methods for Sparse Linear Systems, Chapter 9",
            "Barrett et al., Templates for the Solution of Linear Systems: Building Blocks for Iterative Methods, 1994",
        ],
        workedExample:
            "For A = [[4,1],[1,3]] and b = [1,2], the Jacobi preconditioner uses M inverse equal to diag(0.25, 0.3333). The first preconditioned residual is (0.25, 0.6667), which already points closer to the exact solution (1/11, 7/11) than the raw residual does, and the second iteration reaches it to machine precision.",
    },
    id: "preconditioned-conjugate-gradient",
    name: "Preconditioned Conjugate Gradient",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^2)", space: "O(n)" },
    defaultInput: {
        A: [
            [4, 1],
            [1, 3],
        ],
        b: [1, 2],
        MInv: [0.25, 1 / 3],
        iterations: 40,
        tolerance: 1e-10,
    },
    visualType: "array",
    run,
    pseudocode: [
        "start with x zero, residual r equal to b, and preconditioned z equal to M inverse times r",
        "set the first search direction p equal to z",
        "for each allowed iteration compute A times p",
        "set alpha to r dot z over p dot A p",
        "update the solution x and the residual r",
        "stop when the residual norm is below tolerance",
        "compute the new preconditioned residual z and beta from r dot z",
        "refresh the direction p as z plus beta times p",
        "done: report the solution and residual",
    ],
};

export default module;
