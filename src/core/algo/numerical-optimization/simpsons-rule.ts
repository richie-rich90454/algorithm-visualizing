/**
 * simpsons-rule.ts - Composite Simpson's Rule
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Composite Simpson's rule approximates a definite integral by fitting a
 * quadratic through each pair of adjacent subintervals. With an even number
 * of subintervals of width h, the weighted sum is h/3 times the endpoints plus
 * four times the odd-indexed samples plus two times the interior even-indexed
 * samples. Simpson's rule is exact for every polynomial of degree three or
 * less and has error proportional to h to the fourth for smooth functions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) function evaluations for n subintervals
 *   Space: O(n) for the sample table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid is a table with columns index, x, f(x), weight, and contribution.
 *   - The row being added to the running sum is yellow.
 *   - The final frame is green and reports the approximation and error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type FunctionName = "x2" | "x3" | "sin" | "cos" | "linear";

const NAMES: FunctionName[] = ["x2", "x3", "sin", "cos", "linear"];

function evaluate(name: FunctionName, x: number): number {
    switch (name) {
        case "x2":
            return x * x;
        case "x3":
            return x * x * x;
        case "sin":
            return Math.sin(x);
        case "cos":
            return Math.cos(x);
        case "linear":
            return 2 * x + 1;
    }
}

/** Closed-form integral for every supported function. */
function exactIntegral(name: FunctionName, a: number, b: number): number {
    switch (name) {
        case "x2":
            return (b * b * b - a * a * a) / 3;
        case "x3":
            return (b ** 4 - a ** 4) / 4;
        case "sin":
            return Math.cos(a) - Math.cos(b);
        case "cos":
            return Math.sin(b) - Math.sin(a);
        case "linear":
            return b * b + b - (a * a + a);
        default:
            return 0;
    }
}

function makeCells(
    xs: number[],
    fs: number[],
    weights: number[],
    active: number,
    finalState: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < xs.length; i += 1) {
        const values = [i, xs[i] ?? 0, fs[i] ?? 0, weights[i] ?? 0, (weights[i] ?? 0) * (fs[i] ?? 0)];
        const labels = [
            String(i),
            (xs[i] ?? 0).toFixed(4),
            (fs[i] ?? 0).toFixed(5),
            String(weights[i] ?? 0),
            ((weights[i] ?? 0) * (fs[i] ?? 0)).toFixed(5),
        ];
        for (let col = 0; col < 5; col += 1) {
            entities.push({
                id: `cell-${i}-${col}`,
                type: "cell",
                label: labels[col] ?? "",
                value: values[col] ?? 0,
                state: finalState ? "sorted" : i === active ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col, index: i, role: col },
            });
        }
    }
    return entities;
}

/** Composite Simpson's rule generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { a?: number; b?: number; n?: number; fn?: string } | null
    ) ?? {};
    const rawA = typeof task.a === "number" && Number.isFinite(task.a) ? task.a : 0;
    const rawB = typeof task.b === "number" && Number.isFinite(task.b) ? task.b : 1;
    const a = Math.min(rawA, rawB);
    const b = Math.max(rawA, rawB);
    const requested = typeof task.n === "number" ? Math.floor(task.n) : 8;
    const n = Math.max(2, Math.min(100, requested % 2 === 0 ? requested : requested + 1));
    const fn = NAMES.includes(task.fn as FunctionName) ? (task.fn as FunctionName) : "x2";
    const h = (b - a) / n;
    const xs: number[] = [];
    const fs: number[] = [];
    const weights: number[] = [];
    for (let i = 0; i <= n; i += 1) {
        const x = a + i * h;
        xs.push(x);
        fs.push(evaluate(fn, x));
        weights.push(i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2);
    }
    const exact = exactIntegral(fn, a, b);
    const meta = (added: number, approximation: number, done: boolean) => ({
        rows: n + 1,
        cols: 5,
        n,
        a,
        b,
        fn,
        h,
        added,
        approximation,
        weights: [...weights],
        exact,
        error: Math.abs(approximation - exact),
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(xs, fs, weights, -1, false),
        edges: [],
        description: `Integrating ${fn} from ${a} to ${b} with ${n} subintervals of width ${h.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, 0, false),
    };

    let running = 0;
    let step = 1;
    for (let i = 0; i <= n; i += 1) {
        running += (weights[i] ?? 0) * (fs[i] ?? 0);
        const partial = (h / 3) * running;
        yield {
            stepNumber: step,
            entities: makeCells(xs, fs, weights, i, false),
            edges: [],
            description: `Add sample ${i} at x = ${(xs[i] ?? 0).toFixed(4)} with weight ${weights[i]} and contribution ${((weights[i] ?? 0) * (fs[i] ?? 0)).toFixed(5)}.`,
            codeLineNumber: i === 0 || i === n ? 2 : 3,
            layout: "grid",
            meta: meta(i + 1, partial, false),
        };
        step += 1;
    }

    const approximation = (h / 3) * running;
    yield {
        stepNumber: step,
        entities: makeCells(xs, fs, weights, -1, true),
        edges: [],
        description: `Simpson estimate ${approximation.toFixed(10)} versus exact ${exact.toFixed(10)} (error ${Math.abs(approximation - exact).toExponential(2)}).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: meta(n + 1, approximation, true),
    };
}

/** The composite Simpson's rule module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of approximating a curve with flat rectangles, fit a parabola through every three consecutive sample points. Odd samples get weight four and interior even samples get weight two because of how the parabolas overlap. The result is far more accurate than the trapezoid rule for the same number of samples, and it integrates any cubic exactly.",
        invariants: [
            "The number of subintervals is even and the sample points are equally spaced by h.",
            "Weights are 1 at the endpoints, 4 at odd indices, and 2 at interior even indices.",
            "Each sample contributes weight times function value to the running weighted sum.",
        ],
        correctness:
            "On one pair of subintervals, interpolate the function by the unique quadratic through the left endpoint, midpoint, and right endpoint, then integrate that quadratic. The integral of the interpolating parabola is h/3 times (f0 + 4 f1 + f2). Summing adjacent pairs and combining shared endpoints gives the composite weights 1, 4, 2, 4, ..., 1. Because Simpson's rule is exact for cubics on each pair, it is exact for every cubic polynomial overall, and the error term is proportional to the fourth derivative times h to the fourth.",
        complexityRationale:
            "The rule evaluates the function once at each of the n+1 sample points, so the time cost is O(n). Storing the sample table with its x values, function values, and weights uses O(n) space.",
        uses: [
            "Numerical integration in physics and engineering simulations",
            "Computing areas and accumulated quantities from sampled data",
            "A baseline quadrature rule in scientific computing libraries",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, Section 4.4",
            "Atkinson, An Introduction to Numerical Analysis, Chapter 5",
        ],
        workedExample:
            "Integrating x squared from 0 to 1 with two subintervals uses x values 0, 0.5, 1 with function values 0, 0.25, 1 and weights 1, 4, 1. The estimate is (0.5/3) times (0 + 4 times 0.25 + 1) = 0.33333, which equals the exact integral 1/3.",
    },
    id: "simpsons-rule",
    name: "Simpson's Rule",
    category: "numerical-optimization",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { a: 0, b: 1, n: 8, fn: "x2" },
    visualType: "grid",
    run,
    pseudocode: [
        "choose an even number of subintervals and set h to the width divided by n",
        "for each sample index compute its x and function value",
        "give endpoints weight one, odd indices four, interior evens two",
        "walk the samples adding weight times function value",
        "after all samples multiply the sum by h over three",
        "compare with the closed form when one is available",
        "done: report the integral estimate and its error",
    ],
};

export default module;
