/**
 * bicgstab.ts - Biconjugate Gradient Stabilized Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BiCGSTAB solves a nonsymmetric linear system Ax = b by maintaining two
 * residual sequences and using a stabilized recurrence to avoid the irregular
 * convergence of plain biconjugate gradient. Each iteration needs two matrix
 * products and a few dot products, and no transpose product is required. It is
 * exact here as a floating-point iteration on small dense systems.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) for a dense n by n matrix
 *   Space: O(n) for the five Krylov vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current iterate x, one per component.
 *   - The iterate is yellow during the sweep and green when converged.
 *   - Residuals, alpha, beta, and omega are reported in the metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build one bar per component of the iterate. */
function makeBars(x: number[], state: EntityState): VisualEntity[] {
    return x.map((value, index) => ({
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

function dot(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) {
        sum += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return sum;
}

function norm(a: number[]): number {
    return Math.sqrt(dot(a, a));
}

function matVec(a: number[][], x: number[]): number[] {
    return a.map((row) => dot(row, x));
}

/** The BiCGSTAB generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number[][]; b?: number[]; x0?: number[]; maxIter?: number; tol?: number } | null) ?? {};
    const a = Array.isArray(task.a) ? task.a.map((row) => [...row]) : [[4, 1], [1, 3]];
    const b = Array.isArray(task.b) ? [...task.b] : [1, 2];
    const n = b.length;
    const maxIter = typeof task.maxIter === "number" ? Math.max(1, Math.floor(task.maxIter)) : 50;
    const tol = typeof task.tol === "number" && task.tol > 0 ? task.tol : 1e-10;
    let x = Array.isArray(task.x0) && task.x0.length === n ? [...task.x0] : new Array<number>(n).fill(0);

    let r = b.map((value, i) => value - dot(a[i] ?? [], x));
    const rHat = [...r];
    let p = [...r];
    let v = new Array<number>(n).fill(0);
    let rho = 1;
    let alpha = 1;
    let omega = 1;
    let beta = 0;
    const history: number[] = [norm(r)];

    yield {
        stepNumber: 0,
        entities: makeBars(x, "idle"),
        edges: [],
        description: `Solving an ${n} by ${n} system with BiCGSTAB; the initial residual norm is ${history[0]!.toExponential(2)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { solution: [...x], residual: history[0]!, residualHistory: [...history], iteration: 0, alpha: 0, beta: 0, omega: 0, converged: false },
    };
    let step = 1;
    let converged = norm(r) < tol;
    let used = 0;

    for (let iteration = 0; iteration < maxIter && !converged; iteration += 1) {
        const rhoNew = dot(rHat, r);
        if (Math.abs(rhoNew) < 1e-20) {
            break;
        }
        beta = (rhoNew / rho) * (alpha / omega);
        p = r.map((value, i) => value + beta * ((p[i] ?? 0) - omega * (v[i] ?? 0)));
        v = matVec(a, p);
        const vt = dot(rHat, v);
        if (Math.abs(vt) < 1e-20) {
            break;
        }
        alpha = rhoNew / vt;
        const s = r.map((value, i) => value - alpha * (v[i] ?? 0));
        let next = x.map((value, i) => value + alpha * (p[i] ?? 0));
        if (norm(s) < tol) {
            x = next;
            r = s;
            used = iteration + 1;
            history.push(norm(r));
            converged = true;
            yield {
                stepNumber: step,
                entities: makeBars(x, "comparing"),
                edges: [],
                description: `Iteration ${used}: the intermediate residual is small enough to stop after the alpha step.`,
                codeLineNumber: 4,
                layout: "array",
                meta: { solution: [...x], residual: norm(r), residualHistory: [...history], iteration: used, alpha, beta, omega: 0, converged: true },
            };
            step += 1;
            break;
        }
        const as = matVec(a, s);
        const denom = dot(as, as);
        if (Math.abs(denom) < 1e-20) {
            break;
        }
        omega = dot(as, s) / denom;
        next = next.map((value, i) => value + omega * (s[i] ?? 0));
        r = s.map((value, i) => value - omega * (as[i] ?? 0));
        x = next;
        used = iteration + 1;
        history.push(norm(r));
        converged = norm(r) < tol;
        yield {
            stepNumber: step,
            entities: makeBars(x, converged ? "sorted" : "comparing"),
            edges: [],
            description: `Iteration ${used}: alpha = ${alpha.toFixed(6)}, beta = ${beta.toFixed(6)}, omega = ${omega.toFixed(6)}, residual ${norm(r).toExponential(2)}.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { solution: [...x], residual: norm(r), residualHistory: [...history], iteration: used, alpha, beta, omega, converged },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, "sorted"),
        edges: [],
        description: converged
            ? `Converged in ${used} iteration(s) with residual ${norm(r).toExponential(2)}.`
            : `Stopped after ${used} iteration(s); residual ${norm(r).toExponential(2)}.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { solution: [...x], residual: norm(r), residualHistory: [...history], iteration: used, alpha, beta, omega, converged },
    };
}

/** The BiCGSTAB module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "BiCGSTAB keeps two residual vectors and chooses each step length so the new residual is orthogonal to a fixed shadow vector. A second correction, controlled by omega, damps the erratic behavior that plain biconjugate gradient shows on nonsymmetric matrices. Only matrix times vector products are needed, so the transpose is never formed.",
        invariants: [
            "The shadow residual is fixed throughout the iteration.",
            "The residual after a full iteration is b minus A times the current iterate.",
            "A zero rho or a zero denominator signals breakdown and stops the run.",
        ],
        correctness:
            "The recurrence is a Galerkin projection: alpha is chosen so the shadow residual is orthogonal to the update direction, and omega minimizes the norm of the second residual along A times s. For a nonsingular system of dimension n with exact arithmetic the method terminates in at most n full iterations, and each accepted iterate reduces the true residual in practice.",
        complexityRationale:
            "Each iteration computes two matrix-vector products and a constant number of dot products, so a dense n by n matrix costs O(n^2) per iteration and O(iterations * n^2) overall. Five length-n vectors are stored, giving O(n) space beyond the matrix.",
        uses: [
            "Solving large nonsymmetric systems from discretized fluid flow",
            "Semiconductor device simulation and circuit equations",
            "A standard Krylov solver in scientific software libraries",
        ],
        references: [
            "van der Vorst, Bi-CGSTAB: A Fast and Smoothly Converging Variant of Bi-CG, 1992",
            "Barrett et al., Templates for the Solution of Linear Systems, 1994",
        ],
        workedExample:
            "For the system 4x + y = 1 and x + 3y = 2 starting at zero, BiCGSTAB reaches x = 0.0909 and y = 0.6364, the same solution Gaussian elimination gives, with residual below one part in ten billion.",
    },
    id: "bicgstab",
    name: "BiCGSTAB",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^2)", space: "O(n)" },
    defaultInput: { a: [[4, 1], [1, 3]], b: [1, 2], maxIter: 50, tol: 1e-10 },
    visualType: "array",
    run,
    pseudocode: [
        "set the residual to b minus A times the initial guess",
        "copy the residual into a fixed shadow residual",
        "repeat until the residual norm is small",
        "form the search direction from the residual and previous direction",
        "compute the matrix product with the search direction",
        "take the alpha step and form the intermediate residual",
        "compute omega from the intermediate residual and its image",
        "update the solution and the residual",
        "done: report the solution and its residual norm",
    ],
};

export default module;
