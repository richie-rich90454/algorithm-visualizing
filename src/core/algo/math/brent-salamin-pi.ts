/**
 * brent-salamin-pi.ts - Brent-Salamin Pi Algorithm.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Brent-Salamin algorithm (also called the Gauss-Legendre algorithm)
 * computes pi by iterating the arithmetic-geometric mean of 1 and 1/sqrt(2).
 * Four quantities a, b, t and p are updated; the estimate (a+b)^2/(4t)
 * doubles its correct digit count at every step.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) iterations for k digits of precision (quadratic convergence)
 *   Space: O(k) for the displayed iteration table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row of the grid is one iteration, with cells for a, b, t, p and pi.
 *   - The newest row is highlighted; the final row is green.
 *   - The final frame reports the pi estimate and the absolute error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BrentSalaminInput {
    iterations?: number;
}

interface Row {
    iteration: number;
    a: number;
    b: number;
    t: number;
    p: number;
    pi: number;
}

const FIELDS: Array<{ key: keyof Omit<Row, "iteration">; name: string }> = [
    { key: "a", name: "a" },
    { key: "b", name: "b" },
    { key: "t", name: "t" },
    { key: "p", name: "p" },
    { key: "pi", name: "pi" },
];

function fmt(value: number): string {
    return Number.isFinite(value) ? value.toPrecision(9) : String(value);
}

/** Build a growing grid that shows every iteration seen so far. */
function makeEntities(rows: Row[], done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (const row of rows) {
        FIELDS.forEach((field, col) => {
            const value = row[field.key];
            entities.push({
                id: `cell-${row.iteration}-${col}`,
                type: "cell" as const,
                label: `${field.name}=${fmt(value)}`,
                value,
                state: (done ? "sorted" : row === rows[rows.length - 1] ? "highlight" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: row.iteration, col },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BrentSalaminInput | null) ?? {};
    const iterations = typeof task.iterations === "number" && task.iterations >= 0
        ? Math.trunc(task.iterations)
        : 6;

    let a = 1;
    let b = 1 / Math.SQRT2;
    let t = 0.25;
    let p = 1;
    const rows: Row[] = [];

    const record = (iteration: number): Row => ({
        iteration,
        a,
        b,
        t,
        p,
        pi: (a + b) * (a + b) / (4 * t),
    });

    rows.push(record(0));
    yield {
        stepNumber: 0,
        entities: makeEntities(rows, false),
        edges: [],
        description: `Initialized a=1, b=1/sqrt(2), t=1/4, p=1 for the Brent-Salamin pi computation.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: FIELDS.length, iteration: 0, pi: rows[0]?.pi ?? 0 },
    };

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const nextA = (a + b) / 2;
        const nextB = Math.sqrt(a * b);
        const nextT = t - p * (a - nextA) * (a - nextA);
        const nextP = 2 * p;
        a = nextA;
        b = nextB;
        t = nextT;
        p = nextP;
        rows.push(record(iteration));
        const current = rows[rows.length - 1];
        yield {
            stepNumber: iteration,
            entities: makeEntities(rows, false),
            edges: [],
            description: `Iteration ${iteration}: the arithmetic-geometric mean gives pi about ${fmt(current?.pi ?? 0)}.`,
            codeLineNumber: iteration % 2 === 0 ? 4 : 2,
            layout: "grid",
            meta: {
                rows: rows.length,
                cols: FIELDS.length,
                iteration,
                pi: current?.pi ?? 0,
                error: Math.abs((current?.pi ?? 0) - Math.PI),
            },
        };
    }

    const finalPi = rows[rows.length - 1]?.pi ?? 0;
    yield {
        stepNumber: iterations + 1,
        entities: makeEntities(rows, true),
        edges: [],
        description: `Done after ${iterations} iteration(s): pi is about ${fmt(finalPi)} with error ${fmt(Math.abs(finalPi - Math.PI))}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: rows.length,
            cols: FIELDS.length,
            iteration: iterations,
            pi: finalPi,
            error: Math.abs(finalPi - Math.PI),
        },
    };
}

const module: AlgorithmModule = {
    id: "brent-salamin-pi",
    name: "Brent-Salamin Pi Algorithm",
    category: "math",
    complexity: { time: "O(M(k) log k)", space: "O(k)" },
    defaultInput: { iterations: 6 },
    visualType: "grid",
    run,
    pseudocode: [
        "set a to 1, b to 1/sqrt(2), t to 1/4 and p to 1",
        "repeat for the requested number of iterations",
        "replace a by the arithmetic mean (a+b)/2",
        "replace b by the geometric mean sqrt(a*b)",
        "replace t by t - p times (old a - new a) squared, and p by 2p",
        "estimate pi as (a+b) squared divided by 4t",
        "done: report the final pi estimate",
    ],
    education: {
        intuition:
            "The arithmetic-geometric mean converges extremely quickly. Brent and Salamin noticed that the same iteration also produces pi: track the means a and b, an auxiliary sum t that collects the squared differences, and a doubler p. Combining them yields pi with a number of correct digits that roughly doubles at each step.",
        invariants: [
            "a stays greater than or equal to b and both converge to the same limit.",
            "t accumulates the scaled squared differences (old a minus new a).",
            "p equals 2 raised to the iteration count.",
            "The quantity (a+b)^2/(4t) is a monotonically improving estimate of pi.",
        ],
        correctness:
            "The AGM iteration is known to converge quadratically, and Gauss's relation links the AGM of 1 and 1/sqrt(2) to the complete elliptic integral K, which evaluates to pi/(2 sqrt(2 t)). Substituting the updates for a, b and t preserves that identity, so (a+b)^2/(4t) equals pi in the limit; the error falls roughly as the square of the previous error.",
        complexityRationale:
            "Each iteration performs a handful of arithmetic operations, so k correct digits need only O(log k) iterations; with high-precision multiplication of cost M(k) the total is O(M(k) log k). Displaying the iteration table stores O(k) rows, giving O(k) space.",
        uses: [
            "Computing pi to millions of digits in arbitrary-precision libraries",
            "Demonstrating quadratic convergence of the arithmetic-geometric mean",
            "Benchmarking high-precision arithmetic implementations",
        ],
        references: [
            "Borwein and Borwein, Pi and the AGM: A Study in Analytic Number Theory",
            "Brent, Fast Multiple-Precision Evaluation of Elementary Functions, 1976",
        ],
        workedExample:
            "Starting from a=1, b=0.707106781, t=0.25, p=1 gives pi about 3.140579 in the first step. One more iteration gives 3.141592646, already accurate to eight decimal places.",
    },
};

export default module;
