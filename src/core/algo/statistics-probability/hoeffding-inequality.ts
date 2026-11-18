/**
 * hoeffding-inequality.ts - Hoeffding's Inequality
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * For n independent bounded random variables in [a, b], Hoeffding's inequality
 * bounds the probability that their sample mean deviates from its expectation
 * by at least t. The two-sided bound is 2 exp(-2 n t^2 / (b-a)^2) and the
 * one-sided bound is exp(-2 n t^2 / (b-a)^2). This module evaluates the bound
 * over a grid of deviations and reports the tail probability at the observed
 * deviation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(g) for a grid of g deviation values
 *   Space: O(g) for the grid of bound values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the bound at that deviation.
 *   - The observed deviation's bar is BLUE (active).
 *   - Later bars are GREEN (sorted) because larger deviations have smaller bounds.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(
    grid: number[],
    bounds: number[],
    observedIndex: number,
    states: Map<number, EntityState>,
): VisualEntity[] {
    return grid.map((t, index) => ({
        id: `bar-t-${index}`,
        type: "bar" as const,
        label: `t=${t.toFixed(2)}`,
        value: bounds[index] ?? 0,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { t, bound: bounds[index] ?? 0, observed: index === observedIndex },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            n?: number;
            lower?: number;
            upper?: number;
            deviation?: number;
            grid?: number[];
        } | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(1, task.n) : 100;
    const lower = typeof task.lower === "number" ? task.lower : 0;
    const upper = typeof task.upper === "number" ? task.upper : 1;
    const deviation = typeof task.deviation === "number" ? Math.abs(task.deviation) : 0.1;
    const range = upper - lower;
    const grid: number[] = task.grid ?? [0, 0.05, 0.1, 0.2, 0.3, 0.5];
    const safeRange = range > 0 ? range : 1;

    const exponentAt = (t: number): number => (-2 * n * t * t) / (safeRange * safeRange);
    const boundAt = (t: number): number => Math.min(1, 2 * Math.exp(exponentAt(t)));
    const bounds = grid.map((t) => boundAt(t));
    const oneSidedBound = Math.min(1, Math.exp(exponentAt(deviation)));
    const observedBound = Math.min(1, 2 * oneSidedBound);

    let observedIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    grid.forEach((t, index) => {
        const distance = Math.abs(t - deviation);
        if (distance < bestDistance) {
            bestDistance = distance;
            observedIndex = index;
        }
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(grid, bounds, observedIndex, new Map()),
        edges: [],
        description: `Evaluating Hoeffding's bound for ${n} variables in [${lower}, ${upper}] over ${grid.length} deviation(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, lower, upper, range, deviation, observedBound, oneSidedBound, grid: grid.length },
    };
    step += 1;

    const states = new Map<number, EntityState>();
    for (let i = 0; i < grid.length; i += 1) {
        states.set(i, i === observedIndex ? "active" : "sorted");
        yield {
            stepNumber: step,
            entities: makeBars(grid, bounds, observedIndex, states),
            edges: [],
            description: `At deviation ${(grid[i] ?? 0).toFixed(3)}, two-sided tail is at most ${(bounds[i] ?? 0).toExponential(3)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { t: grid[i] ?? 0, bound: bounds[i] ?? 0, observed: i === observedIndex },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(grid, bounds, observedIndex, states),
        edges: [],
        description: `At deviation ${deviation.toFixed(3)}, the two-sided bound is ${observedBound.toExponential(4)} and the one-sided bound is ${oneSidedBound.toExponential(4)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { n, lower, upper, range, deviation, observedBound, oneSidedBound },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If many independent bounded quantities are averaged, a large deviation from the expected average is very unlikely. Hoeffding's inequality turns that intuition into an explicit exponentially decaying bound that depends only on the sample size, the deviation and the width of the variables' range, not on their detailed distributions.",
        invariants: [
            "The exponent uses the squared range (b minus a) of the variables.",
            "Doubling the deviation multiplies the exponent by four.",
            "The bound decreases monotonically as n or the deviation grows.",
        ],
        correctness:
            "Hoeffding's lemma bounds the moment generating function of any mean-zero variable supported on an interval of width (b-a) by exp of the squared width over eight. Applying Chernoff's bounding technique to the sum of independent variables and optimizing the free parameter gives exp(-2 n t^2 / (b-a)^2) for a one-sided deviation, and a union bound over both tails doubles it.",
        complexityRationale:
            "The exponential is evaluated once per grid point with constant work, so time and space are linear in the number of displayed grid points and independent of the sample size.",
        uses: [
            "Generalization bounds for bounded loss functions in learning theory",
            "Concentration guarantees for randomized algorithms",
            "Confidence statements for Monte Carlo estimates",
        ],
        references: [
            "Hoeffding, Probability Inequalities for Sums of Bounded Random Variables, JASA, 1963",
            "Boucheron, Lugosi and Massart, Concentration Inequalities, 2013",
        ],
        workedExample:
            "For 100 variables in [0, 1] and a deviation of 0.1, the exponent is -2 times 100 times 0.01, which is -2, so the two-sided bound is 2 exp(-2), about 0.271 and the one-sided bound is about 0.135.",
    },
    id: "hoeffding-inequality",
    name: "Hoeffding's Inequality",
    category: "statistics-probability",
    complexity: { time: "O(g)", space: "O(g)" },
    defaultInput: { n: 100, lower: 0, upper: 1, deviation: 0.1, grid: [0, 0.05, 0.1, 0.2, 0.3, 0.5] },
    visualType: "array",
    run,
    pseudocode: [
        "read sample size n, range endpoints a and b, and deviation t",
        "set the range width to b minus a",
        "set the exponent to minus 2 n t squared over the squared width",
        "set the one-sided bound to exp of the exponent",
        "report the two-sided bound as twice the one-sided bound",
    ],
};

export default module;
