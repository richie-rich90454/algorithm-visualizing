/**
 * randomized-kaczmarz.ts - Randomized Kaczmarz Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Kaczmarz method solves a linear system A x = b one row at a time. Each
 * step projects the current estimate onto the hyperplane defined by the chosen
 * row, moving it in the direction of that row's normal. The randomized variant
 * picks a row with probability proportional to the squared norm of the row,
 * which yields an expected linear convergence rate that depends only on the
 * condition number of A, not on the number of rows. No matrix factorization is
 * needed, only row inner products.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n) for n columns, using precomputed row norms
 *   Space: O(m * n + m) for A and the row norms
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current solution estimate, one per column of A.
 *   - The bar corresponding to the updated component is highlighted yellow.
 *   - The final frame reports the estimate and the residual norm ||A x - b||.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface KaczmarzInput {
    A?: number[][];
    b?: number[];
    iterations?: number;
    seed?: number;
    x0?: number[];
}

/** Deterministic mulberry32 pseudo-random generator. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function dot(a: number[], x: number[]): number {
    return a.reduce((sum, v, j) => sum + v * (x[j] ?? 0), 0);
}

function makeBars(x: number[], highlight: number, done: boolean): VisualEntity[] {
    return x.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: `x${i}: ${value.toFixed(4)}`,
        value,
        state: done ? "sorted" as EntityState : i === highlight ? "comparing" as EntityState : "idle" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value },
    }));
}

/** The randomized Kaczmarz generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as KaczmarzInput | null) ?? {};
    const A: number[][] = Array.isArray(task.A) && task.A.length > 0
        ? task.A
        : [
              [2, 1, 0],
              [1, 3, 1],
              [0, 1, 2],
          ];
    const m = A.length;
    const n = A[0]?.length ?? 1;
    const b: number[] = Array.isArray(task.b) && task.b.length === m ? task.b : [4, 6, 0];
    const iterations = Math.max(1, Math.min(500, Math.floor(task.iterations ?? 30)));
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 1;
    const rowNorms = A.map((row) => dot(row, row));
    const valid = rowNorms.map((norm, i) => (norm > 1e-15 && Number.isFinite(b[i] ?? 0) ? norm : 0));
    const total = valid.reduce((sum, v) => sum + v, 0);
    const rand = mulberry32(seed);
    let x: number[] = Array.isArray(task.x0) && task.x0.length === n ? [...task.x0] : Array.from({ length: n }, () => 0);
    let step = 0;

    const residual = (vec: number[]): number => {
        let sum = 0;
        for (let i = 0; i < m; i += 1) {
            const r = dot(A[i] ?? [], vec) - (b[i] ?? 0);
            sum += r * r;
        }
        return Math.sqrt(sum);
    };
    const meta = (iteration: number, chosen: number, done: boolean) => ({
        m,
        n,
        iterations,
        seed,
        iteration,
        chosenRow: chosen,
        x: [...x],
        residual: residual(x),
        done,
    });

    yield {
        stepNumber: step++,
        entities: makeBars(x, -1, false),
        edges: [],
        description: `Solving ${m} equations in ${n} unknowns with randomized row selection weighted by row norms.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, -1, false),
    };

    for (let k = 0; k < iterations; k += 1) {
        let pick = rand() * total;
        let chosen = 0;
        for (let i = 0; i < m; i += 1) {
            pick -= valid[i] ?? 0;
            if (pick <= 0) {
                chosen = i;
                break;
            }
        }
        const row = A[chosen]!;
        const norm = rowNorms[chosen] ?? 0;
        const correction = norm > 1e-15 ? ((b[chosen] ?? 0) - dot(row, x)) / norm : 0;
        const changed = row.findIndex((v, j) => Math.abs(v * correction) > 1e-12);
        x = x.map((xj, j) => xj + correction * (row[j] ?? 0));
        yield {
            stepNumber: step++,
            entities: makeBars(x, changed, false),
            edges: [],
            description: `Step ${k + 1}: projected onto row ${chosen} with correction ${correction.toFixed(4)}; residual ${residual(x).toExponential(2)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: meta(k + 1, chosen, false),
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, -1, true),
        edges: [],
        description: `After ${iterations} projections the estimate is [${x.map((v) => v.toFixed(4)).join(", ")}] with residual ${residual(x).toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: meta(iterations, -1, true),
    };
}

/** The randomized Kaczmarz module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of each equation in a linear system as a hyperplane. The Kaczmarz method starts anywhere and repeatedly drops a perpendicular onto one of those hyperplanes, so the chosen equation becomes exactly satisfied. Choosing the hyperplane at random, with rows weighted by their squared lengths, avoids getting stuck with a bad fixed order and gives a clean average convergence guarantee.",
        invariants: [
            "After a projection onto row i, that row's equation is satisfied exactly.",
            "Row i is chosen with probability proportional to the squared norm of row i.",
            "The residual norm never increases after a projection onto a consistent system.",
        ],
        correctness:
            "Projecting x onto the hyperplane a_i dot x = b_i subtracts the component of the error along a_i, which makes a_i dot x equal b_i exactly. For a consistent system the true solution already satisfies every hyperplane, so each projection removes the error component parallel to the chosen row and leaves the orthogonal component unchanged; the expected squared error therefore shrinks by a factor bounded by one minus one over the squared condition number. Repeating enough projections drives the iterate to the solution in expectation.",
        complexityRationale:
            "Precomputing the row norms costs O(m n). Each iteration draws one number, finds a row by a linear scan of cumulative weights, and updates n components, so it costs O(m + n) which is O(n) when rows are few; the stated bound assumes precomputed selection. Memory holds A and its m row norms, O(m n + m).",
        uses: [
            "Solving large overdetermined systems in tomography and image reconstruction",
            "Distributed and streaming linear solvers that touch one equation at a time",
            "Row-action methods in signal processing and machine learning",
        ],
        references: [
            "Kaczmarz, Angenaherte Losung von Systemen linearer Gleichungen, 1937",
            "Strohmer and Vershynin, A Randomized Kaczmarz Solver for Noisy Linear Systems, 2009",
        ],
        workedExample:
            "For the system (2x + y = 4, x + 3y + z = 6, y + 2z = 0) the solution is (1, 2, -1). Starting from zero, a projection onto the first row moves along (2, 1, 0) to (1.6, 0.8, 0), which satisfies 2x + y = 4 exactly. Randomized row choices continue shrinking the remaining error until the estimate approaches (1, 2, -1).",
    },
    id: "randomized-kaczmarz",
    name: "Randomized Kaczmarz Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n)", space: "O(m * n + m)" },
    defaultInput: {
        A: [
            [2, 1, 0],
            [1, 3, 1],
            [0, 1, 2],
        ],
        b: [4, 6, 0],
        iterations: 30,
        seed: 1,
        x0: [0, 0, 0],
    },
    visualType: "array",
    run,
    pseudocode: [
        "precompute each row's squared norm and the selection weights",
        "initialize the solution estimate x",
        "for each iteration draw a row with probability proportional to its weight",
        "compute the correction from the residual of the chosen equation",
        "add the correction times the row vector to x",
        "record the residual norm of the full system",
        "repeat until the iteration budget is spent",
        "done: report the final estimate and residual",
    ],
};

export default module;
