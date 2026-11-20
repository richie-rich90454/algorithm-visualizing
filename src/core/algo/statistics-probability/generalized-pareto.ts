/**
 * generalized-pareto.ts - Generalized Pareto Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The generalized Pareto distribution models exceedances over a high threshold.
 * A single shape parameter xi controls the tail: positive xi gives a heavy
 * polynomial tail, xi = 0 gives an exponential tail, and negative xi gives a
 * finite upper endpoint. Its cumulative curve and quantile function have simple
 * closed forms, so it is easy to fit and to simulate from.
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
    const task = (input as { xi?: number; sigma?: number; mu?: number; steps?: number; maxX?: number } | null) ?? {};
    const xi = typeof task.xi === "number" ? task.xi : 0.2;
    const sigma = typeof task.sigma === "number" && task.sigma > 0 ? task.sigma : 1;
    const mu = typeof task.mu === "number" ? task.mu : 0;
    const steps = typeof task.steps === "number" ? Math.max(2, Math.floor(task.steps)) : 16;
    const maxX = typeof task.maxX === "number" && task.maxX > mu ? task.maxX : mu + 8 * sigma;
    const xs = Array.from({ length: steps + 1 }, (_, i) => mu + ((maxX - mu) * i) / steps);
    const upper = xi < 0 ? mu - sigma / xi : Infinity;

    const survival = (x: number): number => {
        if (x <= mu) return 1;
        const z = (x - mu) / sigma;
        if (xi < 0 && z >= -1 / xi) return 0;
        if (Math.abs(xi) < 1e-9) return Math.exp(-z);
        return Math.pow(Math.max(1 + xi * z, 0), -1 / xi);
    };
    const density = (x: number): number => {
        if (x < mu) return 0;
        const s = survival(x);
        if (Math.abs(xi) < 1e-9) return Math.exp(-(x - mu) / sigma) / sigma;
        return s / (sigma * Math.max(1 + (xi * (x - mu)) / sigma, 1e-12));
    };
    const quantile = (p: number): number => {
        if (p <= 0) return mu;
        if (p >= 1) return xi >= 0 ? Infinity : upper;
        if (Math.abs(xi) < 1e-9) return mu - sigma * Math.log(1 - p);
        return mu + (sigma * (Math.pow(1 - p, -xi) - 1)) / xi;
    };
    const mean = xi < 1 ? mu + sigma / (1 - xi) : Infinity;

    const pdf: number[] = [];
    const cdf: number[] = [];
    const base = { xi, sigma, mu, steps, maxX, upper: Number.isFinite(upper) ? upper : -1, mean: Number.isFinite(mean) ? mean : -1 };
    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(steps + 1).fill(0), -1, false),
        edges: [],
        description: `Evaluating a generalized Pareto density with shape ${xi.toFixed(3)} and scale ${sigma.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, xs, pdf: [], cdf: [], area: 0, median: quantile(0.5) },
    };
    let step = 1;
    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i]!;
        pdf.push(density(x));
        cdf.push(1 - survival(x));
        const display = [...pdf, ...new Array<number>(steps - i).fill(0)];
        const area = pdf.reduce((s, v, k) => s + (k === 0 || k === pdf.length - 1 ? v / 2 : v), 0) * ((maxX - mu) / steps);
        yield {
            stepNumber: step++,
            entities: makeBars(display, i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${(pdf[i] ?? 0).toFixed(5)}, cumulative ${(cdf[i] ?? 0).toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { ...base, xs, pdf: [...pdf], cdf: [...cdf], area, median: quantile(0.5) },
        };
    }
    const area = pdf.reduce((s, v, k) => s + (k === 0 || k === pdf.length - 1 ? v / 2 : v), 0) * ((maxX - mu) / steps);
    yield {
        stepNumber: step,
        entities: makeBars(pdf, steps, true),
        edges: [],
        description: `Generalized Pareto complete: median ${quantile(0.5).toFixed(4)}, area ${area.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...base, xs, pdf, cdf, area, median: quantile(0.5) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Extreme value theory says that values beyond a high threshold follow a generalized Pareto curve. One shape parameter decides whether the tail decays polynomially, exponentially, or stops at a hard ceiling. The curve's quantile formula is simply the inverse of its cumulative formula, which makes simulation and threshold modeling straightforward.",
        invariants: [
            "The density is zero below the location mu.",
            "For xi < 0 the support ends at mu minus sigma over xi; for xi >= 0 it is unbounded.",
            "Applying the quantile function to a cumulative probability returns the original x.",
        ],
        correctness:
            "The survival function is (1 + xi z)^(-1/xi) for nonzero xi and exp(-z) in the limit, where z = (x-mu)/sigma. Differentiating gives the stated density. Solving the equation p = 1 - (1+xi z)^(-1/xi) for z yields the quantile function, so Q(F(x)) = x. Integrating x times the density gives the mean mu + sigma/(1-xi) whenever xi is below one.",
        complexityRationale:
            "Each grid point needs a fixed number of exponentiations and arithmetic steps, so time is O(steps). The x, density, and cumulative arrays use O(steps) space.",
        uses: [
            "Estimating value at risk from threshold exceedances",
            "Modeling extreme rainfall and flood levels",
            "Tail modeling in actuarial loss distributions",
        ],
        references: [
            "Pickands, Inference About Extreme Values, 1975",
            "Coles, An Introduction to Statistical Modeling of Extreme Values, Chapter 4",
        ],
        workedExample:
            "With xi = 0, sigma = 2 and mu = 0, the distribution is exponential with rate 1/2. The median is -2 ln(0.5) = 1.386 and the mean is 2. With xi = 0.5 and sigma = 1 the median is (0.5^-0.5 - 1)/0.5 = 0.828.",
    },
    id: "generalized-pareto",
    name: "Generalized Pareto Distribution",
    category: "statistics-probability",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { xi: 0.2, sigma: 1, mu: 0, steps: 16, maxX: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "read shape xi, scale sigma, and location mu",
        "compute the survival function at each grid point",
        "differentiate the survival function for the density",
        "set the cumulative curve to one minus survival",
        "invert the cumulative curve to get the quantile function",
        "integrate the density to check total area",
        "done: report density, cumulative curve, and quantiles",
    ],
};

export default module;
