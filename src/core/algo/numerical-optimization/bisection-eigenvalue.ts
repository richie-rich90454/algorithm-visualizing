/**
 * bisection-eigenvalue.ts - Sturm Bisection for the Smallest Eigenvalue
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * For a symmetric tridiagonal matrix T the Sturm sequence counts how many
 * eigenvalues lie below any trial value x: factor T - xI without pivoting and
 * count the negative diagonal pivots. That count is monotone in x, so bisection
 * on a bracket that separates the smallest eigenvalue converges to it without
 * ever computing the characteristic polynomial explicitly.
 *
 * The default matrix is the classic discrete Laplacian with diagonal 2 and
 * off-diagonal -1, whose eigenvalues are known in closed form.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * iterations) for a length-n Sturm count per bisection step
 *   Space: O(n) for the pivot vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid shows each bisection step: bracket, midpoint, Sturm count, estimate.
 *   - The row being tested is yellow; completed rows are green.
 *   - The final frame reports the estimate and its error against the closed form.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const COLS = ["step", "lower", "upper", "mid", "count", "estimate"];

/** Count eigenvalues of the n by n Laplacian strictly below x via Sturm pivots. */
function sturmCount(n: number, x: number): number {
    let pivot = 2 - x;
    let count = pivot < 0 ? 1 : 0;
    for (let i = 2; i <= n; i += 1) {
        // A zero pivot is singular; nudging keeps the sign count well defined.
        const safe = Math.abs(pivot) < 1e-15 ? (pivot < 0 ? -1e-15 : 1e-15) : pivot;
        pivot = 2 - x - 1 / safe;
        if (pivot < 0) count += 1;
    }
    return count;
}

/** Closed-form smallest eigenvalue of the Laplacian: 2 - 2 cos(pi/(n+1)). */
function exactSmallest(n: number): number {
    return 2 - 2 * Math.cos(Math.PI / (n + 1));
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
                label: c === 0 || c === 4 ? String(value) : value.toFixed(6),
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

/** Sturm bisection generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; iterations?: number } | null) ?? {};
    const n = typeof task.n === "number" && Number.isFinite(task.n)
        ? Math.max(2, Math.min(20, Math.floor(task.n)))
        : 8;
    const iterations = typeof task.iterations === "number" && Number.isFinite(task.iterations)
        ? Math.max(1, Math.min(80, Math.floor(task.iterations)))
        : 30;

    // Gershgorin bracket [0, 4] contains every eigenvalue of the Laplacian.
    let lower = 0;
    let upper = 4;
    const rows: number[][] = [];
    let estimate = upper;
    let lastMid = 0;
    let lastCount = 0;

    const meta = (step: number, done: boolean) => ({
        rows: rows.length,
        cols: COLS.length,
        n,
        iterations,
        lower,
        upper,
        mid: lastMid,
        count: lastCount,
        estimate,
        exact: exactSmallest(n),
        error: Math.abs(estimate - exactSmallest(n)),
        done,
        step,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, false),
        edges: [],
        description: `Bisect the bracket [0, 4] for the smallest eigenvalue of the ${n} by ${n} Laplacian.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(step, false),
    };
    step += 1;

    for (let i = 0; i < iterations; i += 1) {
        const mid = (lower + upper) / 2;
        const count = sturmCount(n, mid);
        lastMid = mid;
        lastCount = count;
        if (count >= 1) upper = mid;
        else lower = mid;
        estimate = upper;
        rows.push([i + 1, lower, upper, mid, count, estimate]);
        yield {
            stepNumber: step,
            entities: makeCells(rows, i, false),
            edges: [],
            description: `Step ${i + 1}: midpoint ${mid.toFixed(6)} has ${count} eigenvalue(s) below it; tighten the bracket.`,
            codeLineNumber: count >= 1 ? 4 : 3,
            layout: "grid",
            meta: meta(step, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, true),
        edges: [],
        description: `Smallest eigenvalue estimated as ${estimate.toFixed(10)}; exact ${exactSmallest(n).toFixed(10)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: meta(step, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A symmetric tridiagonal matrix has a Sturm sequence whose sign changes tell you exactly how many eigenvalues sit below any trial number. That count jumps from zero to one precisely at the smallest eigenvalue. Bisect the interval where the count changes and you squeeze the eigenvalue arbitrarily tightly without ever expanding a degree-n determinant.",
        invariants: [
            "The Sturm count is monotone: it never decreases as the trial value increases.",
            "The lower bracket always has count zero and the upper bracket has count at least one.",
            "Each bisection step halves the bracket width while preserving those bracket properties.",
        ],
        correctness:
            "Factoring T - xI by LDL without pivoting produces pivots d_i whose signs follow the Sturm recurrence d_i = (a_i - x) - b_{i-1}^2 / d_{i-1}. Sylvester's law of inertia makes the number of negative pivots equal the number of eigenvalues below x. Since that count is zero below the smallest eigenvalue and positive above it, repeatedly bisecting the bracket that straddles the first jump converges, by the intermediate value argument, to the smallest eigenvalue. The closed form for the Laplacian confirms the numerical answer.",
        complexityRationale:
            "Each Sturm count walks the n diagonal entries once, so one bisection step costs O(n). With a fixed iteration count the total time is O(n times iterations) and only a constant number of pivot variables plus the display rows are stored, O(n) space.",
        uses: [
            "Computing a few extreme eigenvalues of large sparse symmetric matrices",
            "Symmetric tridiagonal eigenproblems from finite-difference discretizations",
            "Bracketing spectra inside dense eigensolvers as a robustness step",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, chapter on the symmetric eigenvalue problem",
            "Trefethen and Bau, Numerical Linear Algebra, lecture on tridiagonal methods",
        ],
        workedExample:
            "For the 3 by 3 Laplacian the exact smallest eigenvalue is 2 minus 2 cos(pi/4), about 0.5858. Starting from [0, 4], the midpoint 2 has three eigenvalues below it, so the bracket becomes [0, 2]; the midpoint 1 has one below it, so it becomes [0, 1]; continuing converges to 0.5858.",
    },
    id: "bisection-eigenvalue",
    name: "Sturm Bisection Eigenvalue",
    category: "numerical-optimization",
    complexity: { time: "O(n * iterations)", space: "O(n)" },
    defaultInput: { n: 8, iterations: 30 },
    visualType: "grid",
    run,
    pseudocode: [
        "set the Gershgorin bracket [lower, upper] around the spectrum",
        "repeat for a fixed number of bisection steps",
        "let mid be the midpoint of the current bracket",
        "compute the Sturm count of eigenvalues below mid",
        "if the count is at least one set upper to mid",
        "otherwise set lower to mid",
        "done: report the bracket upper end as the smallest eigenvalue",
    ],
};

export default module;
