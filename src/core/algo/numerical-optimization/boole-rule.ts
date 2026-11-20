/**
 * boole-rule.ts - Composite Boole's Rule
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Boole's rule is the closed Newton-Cotes formula with five equally spaced
 * nodes on a panel of four subintervals. On one panel of width h it is
 * 2h/45 times (7 f0 + 32 f1 + 12 f2 + 32 f3 + 7 f4). The composite form adds
 * panels together, so interior panel boundaries receive weight 14. Boole's
 * rule is exact for every polynomial of degree five or less and its error is
 * proportional to h to the seventh power for smooth functions.
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
 *   - The grid is a table with columns index, x, f(x), weight, contribution.
 *   - The sample currently added to the running sum is yellow.
 *   - The final frame is green and reports the estimate and its error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type FunctionName = "x2" | "x4" | "x5" | "sin" | "cos" | "linear";

const NAMES: FunctionName[] = ["x2", "x4", "x5", "sin", "cos", "linear"];

function evaluate(name: FunctionName, x: number): number {
    switch (name) {
        case "x2":
            return x * x;
        case "x4":
            return x ** 4;
        case "x5":
            return x ** 5;
        case "sin":
            return Math.sin(x);
        case "cos":
            return Math.cos(x);
        case "linear":
            return 2 * x + 1;
    }
}

function exactIntegral(name: FunctionName, a: number, b: number): number {
    switch (name) {
        case "x2":
            return (b ** 3 - a ** 3) / 3;
        case "x4":
            return (b ** 5 - a ** 5) / 5;
        case "x5":
            return (b ** 6 - a ** 6) / 6;
        case "sin":
            return Math.cos(a) - Math.cos(b);
        case "cos":
            return Math.sin(b) - Math.sin(a);
        case "linear":
            return b * b + b - (a * a + a);
    }
}

/** Composite Boole weight for sample index i, endpoints included. */
function weightAt(i: number, n: number): number {
    if (i === 0 || i === n) return 7;
    if (i % 4 === 0) return 14;
    if (i % 4 === 2) return 12;
    return 32;
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number; n?: number; fn?: string } | null) ?? {};
    const rawA = typeof task.a === "number" && Number.isFinite(task.a) ? task.a : 0;
    const rawB = typeof task.b === "number" && Number.isFinite(task.b) ? task.b : 1;
    const a = Math.min(rawA, rawB);
    const b = Math.max(rawA, rawB);
    const requested = typeof task.n === "number" && Number.isFinite(task.n) ? Math.floor(task.n) : 8;
    const panels = Math.max(1, Math.min(50, Math.ceil(requested / 4)));
    const n = panels * 4;
    const fn = NAMES.includes(task.fn as FunctionName) ? (task.fn as FunctionName) : "x2";
    const h = (b - a) / n;
    const xs: number[] = [];
    const fs: number[] = [];
    const weights: number[] = [];
    for (let i = 0; i <= n; i += 1) {
        const x = a + i * h;
        xs.push(x);
        fs.push(evaluate(fn, x));
        weights.push(weightAt(i, n));
    }
    const exact = exactIntegral(fn, a, b);
    const meta = (added: number, approximation: number, done: boolean) => ({
        rows: n + 1,
        cols: 5,
        n,
        panels,
        a,
        b,
        fn,
        h,
        added,
        weights: [...weights],
        approximation,
        exact,
        error: Math.abs(approximation - exact),
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(xs, fs, weights, -1, false),
        edges: [],
        description: `Integrating ${fn} from ${a} to ${b} with ${panels} panel(s) of four subintervals, width ${h.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, 0, false),
    };

    let running = 0;
    let step = 1;
    for (let i = 0; i <= n; i += 1) {
        running += (weights[i] ?? 0) * (fs[i] ?? 0);
        const partial = ((2 * h) / 45) * running;
        yield {
            stepNumber: step,
            entities: makeCells(xs, fs, weights, i, false),
            edges: [],
            description: `Add sample ${i} at x = ${(xs[i] ?? 0).toFixed(4)} with weight ${weights[i]} and contribution ${((weights[i] ?? 0) * (fs[i] ?? 0)).toFixed(5)}.`,
            codeLineNumber: i === 0 || i === n ? 2 : i % 4 === 0 ? 3 : 4,
            layout: "grid",
            meta: meta(i + 1, partial, false),
        };
        step += 1;
    }

    const approximation = ((2 * h) / 45) * running;
    yield {
        stepNumber: step,
        entities: makeCells(xs, fs, weights, -1, true),
        edges: [],
        description: `Boole estimate ${approximation.toFixed(10)} versus exact ${exact.toFixed(10)} (error ${Math.abs(approximation - exact).toExponential(2)}).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: meta(n + 1, approximation, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Fit a single quartic polynomial through five equally spaced samples and integrate that polynomial exactly. Doing this panel by panel gives high accuracy with very few function evaluations: the odd samples within a panel count for 32, the midpoint counts for 12, and neighboring panels share an endpoint that ends up with weight 14.",
        invariants: [
            "The subinterval count is a multiple of four and every sample is spaced by h.",
            "Weights are 7 at the ends, 14 at interior panel borders, 12 at panel midpoints, and 32 elsewhere.",
            "The running weighted sum is scaled by 2h over 45 only after every sample has been added.",
        ],
        correctness:
            "On one panel, the unique degree-four interpolant through the five nodes has the integral 2h/45 times (7f0 + 32f1 + 12f2 + 32f3 + 7f4), which follows from integrating the Lagrange basis polynomials. Because the interpolant matches any polynomial of degree at most five at five distinct nodes, the difference is a polynomial of degree at most five with five roots, hence identical, so the rule is exact through degree five. Summing panels and collecting shared endpoints gives the composite weights 7, 32, 12, 32, 14, and so on.",
        complexityRationale:
            "The rule evaluates the function once at each of the n+1 nodes, so time is O(n). The sample table stores x values, function values, and weights for each node, which is O(n) space.",
        uses: [
            "High-order numerical integration in scientific computing",
            "Computing areas from uniformly sampled measurements",
            "A comparison baseline against lower-order Newton-Cotes rules",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, section on Newton-Cotes formulas",
            "Atkinson, An Introduction to Numerical Analysis, chapter on quadrature",
        ],
        workedExample:
            "Integrating x to the fourth from 0 to 1 with four subintervals uses samples 0, 0.25, 0.5, 0.75, 1 and weights 7, 32, 12, 32, 7. The weighted sum is 18 and 2h over 45 is 1/90, so the estimate is 18/90 = 0.2, exactly the integral of x to the fourth over that interval.",
    },
    id: "boole-rule",
    name: "Boole's Rule",
    category: "numerical-optimization",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { a: 0, b: 1, n: 8, fn: "x2" },
    visualType: "grid",
    run,
    pseudocode: [
        "round the subinterval count up to a multiple of four and set h",
        "for each sample index compute its x and function value",
        "give endpoints weight seven and interior panel borders fourteen",
        "give panel midpoints weight twelve and remaining samples thirty-two",
        "walk the samples adding weight times function value",
        "after all samples multiply the sum by two h over forty-five",
        "done: report the integral estimate and its error",
    ],
};

export default module;
