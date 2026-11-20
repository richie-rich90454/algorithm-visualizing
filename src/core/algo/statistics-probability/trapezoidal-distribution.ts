/**
 * trapezoidal-distribution.ts - Trapezoidal Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The trapezoidal distribution is a piecewise-linear density with a flat top:
 * it rises from a to c, stays level from c to d, then falls from d to b. It
 * generalizes both the triangular and uniform distributions and has closed
 * form density, cumulative curve, and mean.
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
 *   - One bar per grid point shows the density.
 *   - The current point is highlighted; the finished curve is green.
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
    const task = (input as { a?: number; b?: number; c?: number; d?: number; steps?: number } | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 0;
    const b = typeof task.b === "number" && task.b > a ? task.b : a + 4;
    const c = typeof task.c === "number" && task.c > a && task.c < b ? task.c : a + (b - a) / 4;
    const d = typeof task.d === "number" && task.d > c && task.d < b ? task.d : a + 3 * (b - a) / 4;
    const steps = typeof task.steps === "number" ? Math.max(2, Math.floor(task.steps)) : 16;
    const xs = Array.from({ length: steps + 1 }, (_, i) => a + ((b - a) * i) / steps);
    const height = 2 / (b + d - a - c);
    const mean = (a + b + c + d) / 4;

    const density = (x: number): number => {
        if (x < a || x > b) return 0;
        if (x < c) return (height * (x - a)) / (c - a);
        if (x <= d) return height;
        return (height * (b - x)) / (b - d);
    };
    const cumulative = (x: number): number => {
        if (x <= a) return 0;
        if (x >= b) return 1;
        const leftArea = (c - a) * height / 2;
        const rightArea = (b - d) * height / 2;
        if (x < c) return ((x - a) ** 2 * height) / (2 * (c - a));
        if (x <= d) return leftArea + (x - c) * height;
        return 1 - ((b - x) ** 2 * height) / (2 * (b - d));
    };

    const pdf: number[] = [];
    const cdf: number[] = [];
    const base = { a, b, c, d, steps, height, mean };
    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(steps + 1).fill(0), -1, false),
        edges: [],
        description: `Evaluating a trapezoidal density on [${a}, ${b}] with plateau [${c}, ${d}].`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, xs, pdf: [], cdf: [], area: 0 },
    };
    let step = 1;
    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i]!;
        pdf.push(density(x));
        cdf.push(cumulative(x));
        const display = [...pdf, ...new Array<number>(steps - i).fill(0)];
        const area = pdf.reduce((s, v, k) => s + (k === 0 || k === pdf.length - 1 ? v / 2 : v), 0) * ((b - a) / steps);
        yield {
            stepNumber: step++,
            entities: makeBars(display, i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${(pdf[i] ?? 0).toFixed(5)}, cumulative ${(cdf[i] ?? 0).toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { ...base, xs, pdf: [...pdf], cdf: [...cdf], area },
        };
    }
    const area = pdf.reduce((s, v, k) => s + (k === 0 || k === pdf.length - 1 ? v / 2 : v), 0) * ((b - a) / steps);
    yield {
        stepNumber: step,
        entities: makeBars(pdf, steps, true),
        edges: [],
        description: `Trapezoidal distribution complete: mean ${mean.toFixed(4)}, plateau height ${height.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...base, xs, pdf, cdf, area },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A triangular distribution peaks at a single point, but many real estimates have a range of equally likely values. The trapezoidal distribution replaces that peak with a flat plateau, making the density rise, level off, then fall. It is a natural model when an expert gives a most likely interval instead of a single mode.",
        invariants: [
            "The density is zero outside [a, b] and equals the constant height across [c, d].",
            "The cumulative curve is nondecreasing and reaches one at b.",
            "The height is 2 divided by (b + d - a - c), which makes the total area one.",
        ],
        correctness:
            "The rising and falling pieces are triangles with areas (c-a)height/2 and (b-d)height/2, and the plateau is a rectangle of area (d-c)height. Their sum is height times (b+d-a-c)/2, so setting height to 2/(b+d-a-c) makes the density integrate to one. Integrating each piece gives the stated cumulative curve, and integrating x times the density gives the mean (a+b+c+d)/4.",
        complexityRationale:
            "Each of the steps+1 grid points evaluates a fixed number of arithmetic operations, so time is O(steps). Storing x, density, and cumulative arrays uses O(steps) space.",
        uses: [
            "Monte Carlo simulation with a most likely interval",
            "Project duration and cost risk modeling",
            "Modeling expert estimates with a plateau of typical values",
        ],
        references: [
            "Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions",
            "Vose, Risk Analysis: A Quantitative Guide, trapezoidal distribution section",
        ],
        workedExample:
            "With a=0, b=4, c=1 and d=3, the plateau height is 2/(4+3-0-1)=0.5. The rising triangle has area 0.25, the plateau 1, and the falling triangle 0.25, totaling 1. The mean is (0+4+1+3)/4=2.",
    },
    id: "trapezoidal-distribution",
    name: "Trapezoidal Distribution",
    category: "statistics-probability",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { a: 0, b: 4, c: 1, d: 3, steps: 16 },
    visualType: "array",
    run,
    pseudocode: [
        "read bounds a, b and plateau edges c, d",
        "set height to two over (b + d - a - c)",
        "for each grid point x evaluate the density piece",
        "evaluate the matching cumulative piece",
        "accumulate trapezoid area under the density",
        "compute the mean as (a+b+c+d) over four",
        "done: report density, cumulative curve, and mean",
    ],
};

export default module;
