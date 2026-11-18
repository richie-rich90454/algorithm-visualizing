/**
 * conjugate-gradient.ts - Conjugate Gradient for Symmetric Positive Definite Systems
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The conjugate gradient method solves A x = b for a symmetric positive
 * definite matrix A. Instead of inverting A, it builds a sequence of search
 * directions that are conjugate with respect to A, so each step makes optimal
 * progress in a new direction and previously solved directions are not
 * disturbed. For an n by n system it converges in at most n steps in exact
 * arithmetic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) for a dense matrix-vector product
 *   Space: O(n) for the vectors, beyond the matrix itself
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current solution estimate is shown as bars, one per component.
 *   - The most recently updated estimate is yellow; the final one is green.
 *   - The metadata reports the residual norm and iteration count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Multiply a square matrix by a vector. */
function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0));
}

/** Dot product of two vectors. */
function dot(left: number[], right: number[]): number {
    return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

/** Build solution bars for the current iterate. */
function makeBars(vector: number[], state: EntityState): VisualEntity[] {
    return vector.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The conjugate gradient generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { A?: number[][]; b?: number[]; iterations?: number; tolerance?: number } | null) ?? {};
    const A: number[][] =
        Array.isArray(task.A) && task.A.length > 0
            ? task.A.map((row) => (Array.isArray(row) ? [...row] : []))
            : [
                  [4, 1],
                  [1, 3],
              ];
    const b: number[] = Array.isArray(task.b) && task.b.length === A.length ? [...task.b] : [1, 2];
    const iterations =
        typeof task.iterations === "number" && task.iterations >= 1
            ? Math.floor(task.iterations)
            : Math.max(A.length, 10);
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-10;

    const n = A.length;
    let x: number[] = Array.from({ length: n }, () => 0);
    let r: number[] = [...b];
    let p: number[] = [...r];
    let rsold = dot(r, r);
    let converged = false;
    let used = 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(x, "idle"),
        edges: [],
        description: `Solving a ${n} by ${n} symmetric positive definite system with conjugate gradient.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, residual: Math.sqrt(rsold), converged: false, solution: [...x] },
    };
    step += 1;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const Ap = matVec(A, p);
        const denominator = dot(p, Ap);
        if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-18 || rsold < tolerance * tolerance) {
            converged = rsold < tolerance * tolerance;
            break;
        }
        const alpha = rsold / denominator;
        x = x.map((value, index) => value + alpha * (p[index] ?? 0));
        r = r.map((value, index) => value - alpha * (Ap[index] ?? 0));
        const rsnew = dot(r, r);
        used = iteration + 1;
        converged = Math.sqrt(rsnew) < tolerance;
        yield {
            stepNumber: step,
            entities: makeBars(x, converged ? "sorted" : "comparing"),
            edges: [],
            description: `Iteration ${used}: moved along the new conjugate direction; residual norm is ${Math.sqrt(rsnew).toExponential(2)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { iteration: used, residual: Math.sqrt(rsnew), converged, solution: [...x] },
        };
        step += 1;
        if (converged) {
            break;
        }
        const beta = rsnew / rsold;
        p = r.map((value, index) => value + beta * (p[index] ?? 0));
        rsold = rsnew;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, "sorted"),
        edges: [],
        description: converged
            ? `Converged in ${used} iteration(s); residual ${Math.sqrt(dot(r, r)).toExponential(2)}.`
            : `Stopped after ${used} iteration(s) without reaching the tolerance.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { iteration: used, residual: Math.sqrt(dot(r, r)), converged, solution: [...x] },
    };
}

/** The conjugate gradient module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Solving A x = b directly is expensive for large systems. Conjugate gradient walks toward the answer using search directions that are orthogonal in the geometry defined by A, so a step never spoils the progress made by earlier steps. It only needs matrix-vector products, which makes it ideal for sparse systems.",
        invariants: [
            "The residual at each step is orthogonal to all previous residuals.",
            "Each new search direction is A-conjugate to the previous directions.",
            "The energy norm of the error decreases at every iteration.",
        ],
        correctness:
            "Choosing the step length alpha to minimize the quadratic energy along the current direction makes the new residual orthogonal to that direction. The beta update then produces a direction A-conjugate to all earlier ones, so the method is equivalent to Gram-Schmidt on the Krylov subspace. After at most n steps the subspace spans the whole space, giving the exact solution in exact arithmetic.",
        complexityRationale:
            "Each iteration performs one dense matrix-vector product at O(n^2), plus O(n) vector operations. Only a few length-n vectors are stored, giving O(n) extra space beyond the matrix.",
        uses: [
            "Solving sparse linear systems from finite element simulations",
            "Iterative solvers in physics and engineering codes",
            "Large-scale optimization and machine learning subproblems",
        ],
        references: [
            "Hestenes and Stiefel, Methods of Conjugate Gradients for Solving Linear Systems, 1952",
            "Saad, Iterative Methods for Sparse Linear Systems, Chapter 6",
        ],
        workedExample:
            "For A = [[4,1],[1,3]] and b = [1,2], the initial residual equals b. The first conjugate step already gets close to x = (1/11, 7/11), and a second step reaches the solution to machine precision because the space has dimension two.",
    },
    id: "conjugate-gradient",
    name: "Conjugate Gradient",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^2)", space: "O(n)" },
    defaultInput: {
        A: [
            [4, 1],
            [1, 3],
        ],
        b: [1, 2],
        iterations: 10,
        tolerance: 1e-10,
    },
    visualType: "array",
    run,
    pseudocode: [
        "start with x zero, residual r equal to b, and direction p equal to r",
        "for each allowed iteration",
        "compute the matrix-vector product A times p",
        "set alpha to r dot r over p dot A p",
        "update the solution x and the residual r",
        "stop when the residual norm is below tolerance",
        "set beta to the new r dot r over the old r dot r",
        "refresh the direction p and continue",
        "done: report the solution estimate and residual",
    ],
};

export default module;
