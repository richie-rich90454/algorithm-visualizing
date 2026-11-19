/**
 * agm-arithmetic-geometric-mean.ts - Arithmetic-Geometric Mean.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The arithmetic-geometric mean of two positive numbers is the common limit
 * of two sequences: a(n+1) is the arithmetic mean of a(n) and b(n), while
 * b(n+1) is their geometric mean. The two sequences trap one another and
 * converge quadratically. The AGM underpins fast algorithms for pi, elliptic
 * integrals, and high-precision elementary functions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) iterations for k digits of accuracy (quadratic convergence)
 *   Space: O(1) for the two running values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid table shows the iteration count, both means, and their gap.
 *   - The current iteration's arithmetic mean is highlighted.
 *   - The final frame reports the common limit and the iteration count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AgmInput {
    a?: number;
    b?: number;
    tolerance?: number;
    maxIterations?: number;
}

function table(a: number, b: number, iteration: number, active: boolean, done: boolean): VisualEntity[] {
    const gap = Math.abs(a - b);
    const rows: Array<{ field: string; value: number }> = [
        { field: "iteration", value: iteration },
        { field: "arithmetic a", value: a },
        { field: "geometric b", value: b },
        { field: "gap", value: gap },
    ];
    return rows.map((row, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: `${row.field} = ${row.value.toPrecision(10)}`,
        value: row.value,
        state: (done ? "sorted" : active && index === 1 ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: index, col: 0, field: row.field },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AgmInput | null) ?? {};
    const a0 = typeof task.a === "number" && task.a > 0 ? task.a : 1;
    const b0 = typeof task.b === "number" && task.b > 0 ? task.b : 1 / Math.sqrt(2);
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-14;
    const maxIterations =
        typeof task.maxIterations === "number" && task.maxIterations >= 1
            ? Math.trunc(task.maxIterations)
            : 40;

    let a = a0;
    let b = b0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: table(a, b, 0, false, false),
        edges: [],
        description: `Start the AGM iteration with a = ${a0.toPrecision(8)} and b = ${b0.toPrecision(8)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 4, cols: 1, iteration: 0, a, b, gap: Math.abs(a - b) },
    };
    step += 1;

    let iterations = 0;
    for (let k = 1; k <= maxIterations; k += 1) {
        const nextA = (a + b) / 2;
        const nextB = Math.sqrt(a * b);
        a = nextA;
        b = nextB;
        iterations = k;
        const gap = Math.abs(a - b);
        yield {
            stepNumber: step,
            entities: table(a, b, k, true, false),
            edges: [],
            description: `Iteration ${k}: arithmetic mean ${a.toPrecision(10)}, geometric mean ${b.toPrecision(10)}, gap ${gap.toExponential(2)}.`,
            codeLineNumber: gap <= tolerance ? 4 : 3,
            layout: "grid",
            meta: { rows: 4, cols: 1, iteration: k, a, b, gap },
        };
        step += 1;
        if (gap <= tolerance) {
            break;
        }
    }

    const result = (a + b) / 2;
    yield {
        stepNumber: step,
        entities: table(a, b, iterations, false, true),
        edges: [],
        description: `Converged after ${iterations} iteration(s): AGM = ${result.toPrecision(12)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 4, cols: 1, result, iterations, converged: Math.abs(a - b) <= tolerance },
    };
}

const module: AlgorithmModule = {
    id: "agm-arithmetic-geometric-mean",
    name: "Arithmetic-Geometric Mean",
    category: "math",
    complexity: { time: "O(k)", space: "O(1)" },
    defaultInput: { a: 1, b: 0.7071067811865476, tolerance: 1e-14, maxIterations: 40 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with a0 = a and b0 = b, both positive",
        "repeat for k = 1, 2, 3, ...",
        "set a <- (a + b) / 2 (the arithmetic mean)",
        "set b <- sqrt(a * b) (the geometric mean)",
        "stop when the gap |a - b| is below the tolerance",
        "return the common limit (a + b) / 2",
    ],
    education: {
        intuition:
            "Replace a pair of numbers by their arithmetic and geometric means, then repeat. The larger number always drops and the smaller one always rises, so they squeeze toward a shared value. Because the gap shrinks roughly by squaring each time, only a handful of iterations give many correct digits.",
        invariants: [
            "For positive inputs the arithmetic mean is at least the geometric mean.",
            "The sequence a is nonincreasing and the sequence b is nondecreasing.",
            "The true AGM always lies between b(n) and a(n) at every iteration.",
        ],
        correctness:
            "The inequality a(n+1) >= b(n+1) holds by the arithmetic-geometric mean inequality, and a(n+1) <= a(n) while b(n+1) >= b(n), so both sequences are monotone and bounded and therefore converge. Their limits satisfy L = (L + M)/2 and M = sqrt(L M), which forces L = M; that common value is the AGM.",
        complexityRationale:
            "The error is squared at each step once the values are close, so the number of correct digits doubles per iteration and k iterations suffice for k digits with constant-cost arithmetic. Only the two running values are stored, giving O(1) space.",
        uses: [
            "Computing pi with the Brent-Salamin and Chudnovsky-related AGM methods",
            "Evaluating complete elliptic integrals in physics and engineering",
            "High-precision implementations of logarithms and trigonometric functions",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 2, Section 4.5.2",
            "Borwein and Borwein, Pi and the AGM: A Study in Analytic Number Theory",
        ],
        workedExample:
            "Starting from a = 1 and b = 0.70710678, one step gives a = 0.85355339 and b = 0.84089642. The next step gives 0.84722490 and 0.84720127, already agreeing to four decimals; the limit is about 0.84721308.",
    },
};

export default module;
