/**
 * trapezoidal-rule.ts - Composite Trapezoidal Rule
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The composite trapezoidal rule approximates a definite integral by splitting
 * the interval into n subintervals of width h and summing the areas of the
 * trapezoids whose tops join consecutive sample points. The endpoints carry
 * weight one and every interior point weight two, so the estimate is h times
 * (half the first and last values plus the sum of the interior values). The
 * rule is exact for any linear function and its error is proportional to h^2.
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
 *   - The row being added to the running sum is yellow.
 *   - The final frame is green and reports the estimate and its error.
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

/** Composite trapezoidal rule generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number; n?: number; fn?: string } | null) ?? {};
    const rawA = typeof task.a === "number" && Number.isFinite(task.a) ? task.a : 0;
    const rawB = typeof task.b === "number" && Number.isFinite(task.b) ? task.b : 1;
    const a = Math.min(rawA, rawB);
    const b = Math.max(rawA, rawB);
    const requested = typeof task.n === "number" ? Math.floor(task.n) : 8;
    const n = Math.max(1, Math.min(1000, requested));
    const fn = NAMES.includes(task.fn as FunctionName) ? (task.fn as FunctionName) : "x2";
    const h = (b - a) / n;
    const xs: number[] = [];
    const fs: number[] = [];
    const weights: number[] = [];
    for (let i = 0; i <= n; i += 1) {
        xs.push(a + i * h);
        fs.push(evaluate(fn, a + i * h));
        weights.push(i === 0 || i === n ? 0.5 : 1);
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
        description: `Integrating ${fn} from ${a} to ${b} with ${n} trapezoid(s) of width ${h.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, 0, false),
    };

    let running = 0;
    let step = 1;
    for (let i = 0; i <= n; i += 1) {
        running += (weights[i] ?? 0) * (fs[i] ?? 0);
        const partial = h * running;
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

    const approximation = h * running;
    yield {
        stepNumber: step,
        entities: makeCells(xs, fs, weights, -1, true),
        edges: [],
        description: `Trapezoid estimate ${approximation.toFixed(10)} versus exact ${exact.toFixed(10)} (error ${Math.abs(approximation - exact).toExponential(2)}).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: meta(n + 1, approximation, true),
    };
}

/** The composite trapezoidal rule module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Approximate the area under a curve by replacing each slice with a straight line between its two endpoints, forming a trapezoid. The two endpoint samples get half weight because each is shared by only one trapezoid, while interior samples get full weight because each is the shared top corner of two neighboring trapezoids. More slices mean shorter straight lines and a closer fit.",
        invariants: [
            "The n subintervals have equal width h equal to the interval length divided by n.",
            "Endpoint weights are one half and every interior weight is one.",
            "Each sample contributes its weight times the function value to the running area sum.",
        ],
        correctness:
            "On a single subinterval, the area of the trapezoid with heights f(a) and f(b) and width h is h times (f(a) plus f(b)) over two, which is exactly the integral when f is linear. Summing over all subintervals gives h times half the endpoints plus the interiors, matching the weighted formula. Because a linear function is integrated exactly on each slice, the composite rule is exact for every linear function, and the error term for smooth functions is proportional to h squared.",
        complexityRationale:
            "The rule evaluates the function once at each of the n+1 sample points, so the time cost is O(n). Storing the x values, function values and weights uses O(n) space.",
        uses: [
            "Numerical integration when only sampled data is available",
            "Estimating areas and accumulated quantities in engineering",
            "A simple baseline quadrature rule in scientific software",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, Section 4.2",
            "Atkinson, An Introduction to Numerical Analysis, Chapter 5",
        ],
        workedExample:
            "Integrating x squared from 0 to 1 with four subintervals uses h equal to 0.25 and sample values 0, 0.0625, 0.25, 0.5625, 1 with weights 0.5, 1, 1, 1, 0.5. The weighted sum is 0.5 times 0 plus 0.0625 plus 0.25 plus 0.5625 plus 0.5 times 1, which is 1.375; multiplying by 0.25 gives 0.34375, close to the exact value 0.33333.",
    },
    id: "trapezoidal-rule",
    name: "Trapezoidal Rule",
    category: "numerical-optimization",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { a: 0, b: 1, n: 8, fn: "x2" },
    visualType: "grid",
    run,
    pseudocode: [
        "choose n subintervals and set h to the interval width divided by n",
        "mark endpoint samples with weight one half and interiors with one",
        "evaluate the function at each of the n plus one sample points",
        "walk the samples adding weight times function value",
        "after all samples multiply the running sum by h",
        "compare with the closed form when one is available",
        "done: report the integral estimate and its error",
    ],
};

export default module;
