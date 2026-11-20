/**
 * irwin-hall-distribution.ts - Irwin-Hall Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Irwin-Hall distribution is the sum of n independent uniform(0,1) random
 * variables. Its density is a piecewise polynomial made of shifted power terms,
 * and its cumulative function is the same construction one degree higher. An
 * inclusion-exclusion sum over the breakpoints 0, 1, ..., n evaluates both
 * curves exactly at any point. The mean is n/2 and the variance is n/12.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * n) for the grid, with O(n) work per point
 *   Space: O(steps) for the density and cumulative arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the Irwin-Hall density.
 *   - The bar under evaluation is highlighted; the finished curve is sorted.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function factorial(n: number): number {
    let result = 1;
    for (let i = 2; i <= n; i += 1) result *= i;
    return result;
}

function binomial(n: number, k: number): number {
    let result = 1;
    for (let i = 1; i <= k; i += 1) result = (result * (n - i + 1)) / i;
    return result;
}

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
    const task = (input as { n?: number; steps?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(1, Math.min(12, Math.floor(task.n))) : 4;
    const steps = typeof task.steps === "number" ? Math.max(4, Math.floor(task.steps)) : 32;
    const xs = Array.from({ length: steps + 1 }, (_, i) => (n * i) / steps);
    const mean = n / 2;
    const variance = n / 12;

    const pdf = (x: number): number => {
        if (x < 0 || x > n) return 0;
        let sum = 0;
        for (let k = 0; k <= Math.floor(x) && k <= n; k += 1) {
            sum += (k % 2 === 0 ? 1 : -1) * binomial(n, k) * (x - k) ** (n - 1);
        }
        return sum / factorial(n - 1);
    };
    const cdf = (x: number): number => {
        if (x <= 0) return 0;
        if (x >= n) return 1;
        let sum = 0;
        for (let k = 0; k <= Math.floor(x) && k <= n; k += 1) {
            sum += (k % 2 === 0 ? 1 : -1) * binomial(n, k) * (x - k) ** n;
        }
        return sum / factorial(n);
    };

    const densities: number[] = [];
    const cumulative: number[] = [];
    const pending = new Array<number>(steps + 1).fill(0);
    yield {
        stepNumber: 0,
        entities: makeBars(pending, -1, false),
        edges: [],
        description: `Evaluating the distribution of the sum of ${n} uniform variables on ${steps + 1} grid points.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, steps, xs, pdf: [], cdf: [], mean, variance, area: 0 },
    };
    let step = 1;
    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i]!;
        const d = pdf(x);
        const f = cdf(x);
        densities.push(d);
        cumulative.push(f);
        const display = [...densities, ...new Array<number>(steps - i).fill(0)];
        const area = densities.reduce((total, value, k) => total + (k === 0 || k === densities.length - 1 ? value / 2 : value), 0) * (n / steps);
        yield {
            stepNumber: step,
            entities: makeBars(display, i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${d.toFixed(5)}, cumulative ${f.toFixed(5)} via inclusion-exclusion.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, steps, xs, pdf: [...densities], cdf: [...cumulative], mean, variance, area },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeBars(densities, steps, true),
        edges: [],
        description: `Irwin-Hall distribution complete: mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}, total area ${(densities.reduce((total, value, k) => total + (k === 0 || k === densities.length - 1 ? value / 2 : value), 0) * (n / steps)).toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, steps, xs, pdf: densities, cdf: cumulative, mean, variance, area: densities.reduce((total, value, k) => total + (k === 0 || k === densities.length - 1 ? value / 2 : value), 0) * (n / steps) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Add several independent uniform random numbers and the result clusters near the middle in a smooth, symmetric shape. With one variable the curve is flat; with two it is a triangle; with more it approaches a bell. The exact curve is built by adding and subtracting shifted pieces, one for each integer breakpoint.",
        invariants: [
            "The density is supported on [0, n] and is symmetric about n/2.",
            "The cumulative function reaches one at x = n.",
            "Inclusion-exclusion alternates signs for successive breakpoints.",
        ],
        correctness:
            "By the convolution of n uniform densities, the density of the sum has the inclusion-exclusion expansion 1/(n-1)! times the alternating sum over k of C(n,k)(x-k)^(n-1) for k up to floor(x); integrating one more power gives the cumulative expansion divided by n!. The terms cancel outside [0,n], both curves integrate to one, and the sum of n independent uniforms has mean n times 1/2 and variance n times 1/12 by additivity.",
        complexityRationale:
            "Each of the steps+1 points evaluates at most n+1 alternating terms, so time is O(steps * n). Storing the x, density, and cumulative arrays uses O(steps) space.",
        uses: [
            "Modeling the sum of several bounded random contributions",
            "Generating approximately normal noise from uniform generators",
            "A teaching example of repeated convolution and the central limit theorem",
        ],
        references: [
            "Irwin, On the Frequency Distribution of the Means of Samples, 1927",
            "Hall, Introduction to the Theory of Statistics, 1927",
        ],
        workedExample:
            "For n = 2 the sum of two uniforms has triangular density: f(x) = x on [0,1] and f(x) = 2-x on [1,2]. The inclusion-exclusion sum at x = 0.5 is just 0.5, and at x = 1.5 it is 1.5 minus 2 times 0.5, giving 0.5. The mean is 1 and the variance is 1/6.",
    },
    id: "irwin-hall-distribution",
    name: "Irwin-Hall Distribution",
    category: "statistics-probability",
    complexity: { time: "O(steps * n)", space: "O(steps)" },
    defaultInput: { n: 4, steps: 32 },
    visualType: "array",
    run,
    pseudocode: [
        "read the number n of uniform summands and the grid size",
        "for each x from zero to n determine the breakpoints below x",
        "alternate signs over those breakpoints in the sum",
        "divide the density sum by (n-1) factorial",
        "divide the cumulative sum by n factorial",
        "accumulate the trapezoid area of the density",
        "report the mean n over two and variance n over twelve",
    ],
};

export default module;
