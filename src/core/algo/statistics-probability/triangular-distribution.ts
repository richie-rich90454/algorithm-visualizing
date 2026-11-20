/**
 * triangular-distribution.ts - Triangular Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The triangular distribution is defined by a lower bound a, an upper bound b,
 * and a mode c between them. Its density rises linearly from a to the mode and
 * falls linearly from the mode to b, forming a triangle. The cumulative curve
 * is the corresponding pair of quadratic pieces. Its mean and variance have
 * simple closed forms.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) to evaluate the grid
 *   Space: O(steps) for the density and cumulative arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the triangular density.
 *   - The bar under evaluation is highlighted; the finished curve is sorted.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(density: number[], current: number, done: boolean): VisualEntity[] {
    return density.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number; c?: number; steps?: number } | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 0;
    const b = typeof task.b === "number" && task.b > a ? task.b : a + 4;
    const c = typeof task.c === "number" && task.c > a && task.c < b ? task.c : a + (b - a) / 4;
    const steps = typeof task.steps === "number" ? Math.max(2, Math.floor(task.steps)) : 16;
    const xs = Array.from({ length: steps + 1 }, (_, i) => a + ((b - a) * i) / steps);
    const mean = (a + b + c) / 3;
    const variance = (a * a + b * b + c * c - a * b - a * c - b * c) / 18;
    const median = c <= (a + b) / 2
        ? a + Math.sqrt(((b - a) * (c - a)) / 2)
        : b - Math.sqrt(((b - a) * (b - c)) / 2);

    const density = (x: number): number => {
        if (x < a || x > b) return 0;
        if (x <= c) return (2 * (x - a)) / ((b - a) * (c - a));
        return (2 * (b - x)) / ((b - a) * (b - c));
    };
    const cumulative = (x: number): number => {
        if (x <= a) return 0;
        if (x >= b) return 1;
        if (x <= c) return (x - a) ** 2 / ((b - a) * (c - a));
        return 1 - (b - x) ** 2 / ((b - a) * (b - c));
    };

    const pdf: number[] = [];
    const cdf: number[] = [];
    const pending = new Array<number>(steps + 1).fill(0);
    yield {
        stepNumber: 0,
        entities: makeBars(pending, -1, false),
        edges: [],
        description: `Evaluating a triangular density on [${a}, ${b}] with mode ${c.toFixed(3)} at ${steps + 1} grid points.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { a, b, c, steps, xs, pdf: [], cdf: [], mean, variance, median, area: 0 },
    };
    let step = 1;
    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i]!;
        const d = density(x);
        const f = cumulative(x);
        pdf.push(d);
        cdf.push(f);
        const display = [...pdf, ...new Array<number>(steps - i).fill(0)];
        const area = pdf.reduce((total, value, k) => total + (k === 0 || k === pdf.length - 1 ? value / 2 : value), 0) * ((b - a) / steps);
        yield {
            stepNumber: step,
            entities: makeBars(display, i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${d.toFixed(5)}, cumulative ${f.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { a, b, c, steps, xs, pdf: [...pdf], cdf: [...cdf], mean, variance, median, area },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeBars(pdf, steps, true),
        edges: [],
        description: `Triangular distribution complete: mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}, median ${median.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { a, b, c, steps, xs, pdf, cdf, mean, variance, median, area: pdf.reduce((total, value, k) => total + (k === 0 || k === pdf.length - 1 ? value / 2 : value), 0) * ((b - a) / steps) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When you know the minimum, maximum, and most likely value but little else, the triangular distribution turns that knowledge into a simple tent-shaped curve. Density climbs linearly to the mode and descends linearly to the maximum. It is a lightweight model for expert estimates and rough simulations.",
        invariants: [
            "The density is zero outside [a, b] and peaks at the mode c.",
            "The cumulative curve is nondecreasing and reaches one at b.",
            "The mean is (a+b+c)/3.",
        ],
        correctness:
            "On [a, c] the density is a line from zero at a to its peak at c, so integrating gives (x-a)^2 divided by (b-a)(c-a). On [c, b] symmetry gives one minus (b-x)^2 divided by (b-a)(b-c). Both pieces reach the same value at c and integrate to one over the full range. Integrating x times the density over the two pieces yields the stated mean and variance, and solving the cumulative equation at one half gives the median.",
        complexityRationale:
            "Each of the steps+1 grid points evaluates a fixed number of arithmetic operations for both curves, so time is O(steps). Storing the x, density, and cumulative arrays uses O(steps) space.",
        uses: [
            "Monte Carlo simulation when only a range and a most likely value are known",
            "Project task-duration modeling in project management",
            "Rough risk and cost estimates with limited data",
        ],
        references: [
            "Vose, Risk Analysis: A Quantitative Guide, Chapter on the triangular distribution",
            "Triola, Elementary Statistics, continuous distributions section",
        ],
        workedExample:
            "With a = 0, b = 4 and mode c = 1, the density peaks at 0.5 at x = 1. The mean is (0+4+1)/3 = 1.667, the variance is (0+16+1-0-0-4)/18 = 0.722, and the median is sqrt(4*1/2) = 1.414.",
    },
    id: "triangular-distribution",
    name: "Triangular Distribution",
    category: "statistics-probability",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { a: 0, b: 4, c: 1, steps: 16 },
    visualType: "array",
    run,
    pseudocode: [
        "read lower bound a, upper bound b, and mode c",
        "for each grid point x evaluate the density lines",
        "evaluate the matching quadratic cumulative value",
        "accumulate the trapezoid area under the density",
        "compute the mean as (a+b+c) over three",
        "compute the variance from the closed form",
        "solve the cumulative equation for the median and report",
    ],
};

export default module;
