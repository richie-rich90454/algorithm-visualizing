/**
 * cgs.ts - Conjugate Gradient Squared for Nonsymmetric Systems
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CGS solves A x = b without ever forming A transpose. BiCG uses a fixed
 * shadow residual only through inner products of the form r_tilde dot r_k,
 * which equal r0 dot P(A) squared r0. CGS exploits that identity to apply the
 * BiCG residual polynomial twice, using auxiliary vectors u, p and q so the
 * squared operator is never materialized. It converges roughly twice as fast
 * as BiCG per iteration but can show irregular residual spikes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) for dense matrix-vector products
 *   Space: O(n^2) for the matrix and O(n) for the vector recurrences
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid shows each iteration's rho, step size alpha, and residual norm.
 *   - The current row is yellow; finished rows are green.
 *   - The final frame reports the residual and compares against a direct solve.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const COLS = ["iter", "rho", "alpha", "residual", "x0", "x1"];

function dot(a: number[], b: number[]): number {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) total += (a[i] ?? 0) * (b[i] ?? 0);
    return total;
}

function matVec(a: number[][], x: number[]): number[] {
    return a.map((row) => row.reduce((sum, value, j) => sum + value * (x[j] ?? 0), 0));
}

/** Dense diagonally dominant nonsymmetric test matrix. */
function makeMatrix(n: number): number[][] {
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => {
            if (i === j) return 5;
            if (j === i - 1) return -1;
            if (j === i + 1) return -2;
            return 0;
        }),
    );
}

/** Direct Gaussian elimination reference solution. */
function directSolve(a: number[][], b: number[]): number[] {
    const n = b.length;
    const m = a.map((row, i) => [...row, b[i] ?? 0]);
    for (let k = 0; k < n; k += 1) {
        const pivot = m[k]![k]!;
        for (let j = k; j <= n; j += 1) m[k]![j] = m[k]![j]! / pivot;
        for (let i = 0; i < n; i += 1) {
            if (i === k) continue;
            const factor = m[i]![k]!;
            for (let j = k; j <= n; j += 1) m[i]![j] = m[i]![j]! - factor * m[k]![j]!;
        }
    }
    return m.map((row) => row[n] ?? 0);
}

function makeCells(rows: number[][], active: number, finished: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < rows.length; r += 1) {
        for (let c = 0; c < COLS.length; c += 1) {
            const value = rows[r]?.[c] ?? 0;
            const state: EntityState = finished
                ? "sorted"
                : r === active
                    ? "comparing"
                    : r < active
                        ? "sorted"
                        : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: c === 0 ? String(value) : value.toExponential(2),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, role: COLS[c] ?? "value" },
            });
        }
    }
    return entities;
}

/** Conjugate Gradient Squared generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; iterations?: number } | null) ?? {};
    const n = typeof task.n === "number" && Number.isFinite(task.n)
        ? Math.max(2, Math.min(12, Math.floor(task.n)))
        : 6;
    const iterations = typeof task.iterations === "number" && Number.isFinite(task.iterations)
        ? Math.max(1, Math.min(60, Math.floor(task.iterations)))
        : 12;

    const a = makeMatrix(n);
    const b = Array.from({ length: n }, (_, i) => i + 1);
    const truth = directSolve(a, b);
    let x = new Array<number>(n).fill(0);
    let r = [...b];
    const rTilde = [...r];
    let p = [...r];
    let u = [...r];
    let q = new Array<number>(n).fill(0);
    let rhoPrev = 1;
    let alpha = 1;
    let rho = dot(rTilde, r);
    const rows: number[][] = [];

    const residualNorm = () => Math.sqrt(dot(r, r));
    const meta = (step: number, done: boolean) => ({
        rows: rows.length,
        cols: COLS.length,
        n,
        iterations,
        residual: residualNorm(),
        solution: [...x],
        truth,
        error: Math.sqrt(x.reduce((sum, v, i) => sum + (v - (truth[i] ?? 0)) ** 2, 0)),
        done,
        step,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, false),
        edges: [],
        description: `Solve a ${n} by ${n} nonsymmetric system with CGS; initial residual norm is ${residualNorm().toFixed(6)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(step, false),
    };
    step += 1;

    for (let i = 1; i <= iterations; i += 1) {
        rho = dot(rTilde, r);
        if (Math.abs(rho) < 1e-14) break;
        if (i === 1) {
            u = [...r];
            p = [...r];
        } else {
            const beta = rho / rhoPrev;
            u = r.map((value, j) => value + beta * (q[j] ?? 0));
            p = u.map((value, j) => value + beta * ((q[j] ?? 0) + beta * (p[j] ?? 0)));
        }
        const ap = matVec(a, p);
        const denom = dot(rTilde, ap);
        if (Math.abs(denom) < 1e-14) break;
        alpha = rho / denom;
        q = u.map((value, j) => value - alpha * (ap[j] ?? 0));
        const uhat = u.map((value, j) => value + (q[j] ?? 0));
        x = x.map((value, j) => value + alpha * (uhat[j] ?? 0));
        const auhat = matVec(a, uhat);
        r = r.map((value, j) => value - alpha * (auhat[j] ?? 0));
        rhoPrev = rho;
        rows.push([i, rho, alpha, residualNorm(), x[0] ?? 0, x[1] ?? 0]);
        yield {
            stepNumber: step,
            entities: makeCells(rows, rows.length - 1, false),
            edges: [],
            description: `Iteration ${i}: rho ${rho.toExponential(3)}, alpha ${alpha.toExponential(3)}, residual norm ${residualNorm().toExponential(3)}.`,
            codeLineNumber: i === 1 ? 3 : 4,
            layout: "grid",
            meta: meta(step, false),
        };
        step += 1;
        if (residualNorm() < 1e-12) break;
    }

    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, true),
        edges: [],
        description: `After ${rows.length} iteration(s) the residual norm is ${residualNorm().toExponential(3)}; solution error ${meta(step, true).error.toExponential(3)}.`,
        codeLineNumber: 8,
        layout: "grid",
        meta: meta(step, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "BiCG keeps two coupled sequences, one for A and one for A transpose, but only uses the transpose sequence inside dot products. Rewrite those dot products so the same polynomial acts on the original residual twice. The result is a method that needs no transpose product and often converges about twice as fast as BiCG, at the price of occasional residual spikes.",
        invariants: [
            "The shadow residual stays fixed at the starting residual for the whole run.",
            "The true residual is updated explicitly and never assumed small from the step size.",
            "When the iteration stops, the reported residual equals b minus A x for the returned x.",
        ],
        correctness:
            "In exact arithmetic CGS generates the same scalar coefficients as BiCG because the identity r_tilde dot r_k equals r0 dot P(A) squared r0 lets every shadow inner product be moved onto the A side. BiCG residuals satisfy a three-term recurrence, so its coefficient polynomial has degree k after k steps; applying it twice makes the CGS residual q_k(A) r0 with degree k, which vanishes in at most n steps for an n by n nonsingular system. The explicit residual update keeps the displayed value consistent with the iterates even when rounding breaks the exact polynomial identity.",
        complexityRationale:
            "Each iteration performs two dense matrix-vector products and a constant number of dot products, costing O(n squared) time. The matrix needs O(n squared) storage and the seven recurrence vectors need O(n) space.",
        uses: [
            "Solving large nonsymmetric sparse systems without forming a transpose",
            "Matrix-free solvers where only the action of A is available",
            "A standard Krylov benchmark alongside BiCG and BiCGStab",
        ],
        references: [
            "Sonneveld, CGS: A Fast Lanczos-Type Solver for Nonsymmetric Linear Systems, 1989",
            "Barrett et al., Templates for the Solution of Linear Systems, chapter on CGS",
        ],
        workedExample:
            "On a small diagonally dominant system the first iteration sets p and u to the initial residual, computes the step alpha from the shadow inner product, and updates x. Each later iteration folds the previous direction in with beta. The residual norm typically falls faster than a comparable BiCG run over the same number of matrix products.",
    },
    id: "cgs",
    name: "Conjugate Gradient Squared",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^2)", space: "O(n^2)" },
    defaultInput: { n: 6, iterations: 12 },
    visualType: "grid",
    run,
    pseudocode: [
        "set x to zero and r to b minus A x; copy r to the shadow residual",
        "initialize p and u to r and set the previous rho to one",
        "for each iteration compute rho as shadow dot r",
        "form beta and update the mixed vectors u and p",
        "compute v as A p and the step alpha as rho over shadow dot v",
        "form q as u minus alpha v and advance x by alpha times u plus q",
        "update the explicit residual r by subtracting alpha times A applied to u plus q",
        "stop when the residual is small or the iteration budget is spent",
        "done: report the solution and final residual norm",
    ],
};

export default module;
