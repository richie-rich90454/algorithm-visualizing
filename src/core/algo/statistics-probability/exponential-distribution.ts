/**
 * exponential-distribution.ts - Exponential Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The exponential distribution models the waiting time between events in a
 * Poisson process. With rate lambda it has density f(x) = lambda * exp(-lambda
 * * x) for x >= 0 and cumulative distribution F(x) = 1 - exp(-lambda * x).
 * Its mean is 1 / lambda and its variance is 1 / lambda squared. The simulator
 * evaluates both functions on a uniform grid of x values and reports the
 * accumulated probability and moments.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) to evaluate the grid
 *   Space: O(steps) for the x, density, and cumulative arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the density f(x).
 *   - The bar being evaluated is yellow; the finished curve is green.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(density: number[], current: number, done: boolean): VisualEntity[] {
    return density.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value === null ? `x=${index}` : `${value.toFixed(4)}`,
        value,
        state: done || index < current ? ("sorted" as const) : index === current ? ("comparing" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, k: index },
    }));
}

/** The exponential distribution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lambda?: number; maxX?: number; steps?: number } | null) ?? {};
    const lambda = typeof task.lambda === "number" && task.lambda > 0 ? task.lambda : 1;
    const maxX = typeof task.maxX === "number" && task.maxX > 0 ? task.maxX : 6;
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 12;
    const xs = Array.from({ length: steps + 1 }, (_, i) => (i * maxX) / steps);
    const mean = 1 / lambda;
    const variance = 1 / (lambda * lambda);

    const densities: number[] = [];
    const cumulative: number[] = [];
    const pending = new Array<number>(steps + 1).fill(0);

    yield {
        stepNumber: 0,
        entities: makeBars(pending, -1, false),
        edges: [],
        description: `Evaluating the exponential density and CDF on ${steps + 1} points from 0 to ${maxX} with rate ${lambda}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lambda, maxX, steps, xs, pdf: [], cdf: [], mean, variance, area: 0 },
    };
    let step = 1;

    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i] ?? 0;
        const density = lambda * Math.exp(-lambda * x);
        const cdf = 1 - Math.exp(-lambda * x);
        densities.push(density);
        cumulative.push(cdf);
        const display = [...densities, ...new Array<number>(steps - i).fill(0)];
        const area = densities.reduce((total, value, k) => {
            if (k === 0 || k === densities.length - 1) {
                return total + value / 2;
            }
            return total + value;
        }, 0) * (maxX / steps);
        yield {
            stepNumber: step,
            entities: makeBars(display, i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density f(x) = ${density.toFixed(5)}, cumulative F(x) = ${cdf.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { lambda, maxX, steps, xs, pdf: [...densities], cdf: [...cumulative], mean, variance, area },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(densities, steps, true),
        edges: [],
        description: `Distribution complete: area under the truncated density is ${densities.reduce((a, b) => a + b, 0).toFixed(4)} (trapezoid ${(densities.reduce((total, value, k) => total + (k === 0 || k === densities.length - 1 ? value / 2 : value), 0) * (maxX / steps)).toFixed(4)}), mean ${mean.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { lambda, maxX, steps, xs, pdf: [...densities], cdf: [...cumulative], mean, variance, area: densities.reduce((total, value, k) => total + (k === 0 || k === densities.length - 1 ? value / 2 : value), 0) * (maxX / steps) },
    };
}

/** The exponential distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If events happen at a constant average rate and independently of one another, the time you wait for the next one follows an exponential curve. It starts high at zero and decays smoothly. The cumulative version tells you the chance that the wait is already over by a given time.",
        invariants: [
            "The density is lambda times the exponential decay and is nonnegative.",
            "The cumulative value equals one minus the same exponential decay.",
            "The cumulative curve is nondecreasing and approaches one.",
        ],
        correctness:
            "A Poisson process with rate lambda has no arrivals in an interval of length x with probability exp(-lambda x). The waiting time exceeds x exactly when there are no arrivals, so the cumulative distribution is 1 - exp(-lambda x), and differentiating gives the density lambda exp(-lambda x). Integrating x times the density over the positive real line gives 1 / lambda.",
        complexityRationale:
            "Each grid point needs a fixed number of exponential evaluations and additions, so building the curve costs O(steps) time and O(steps) space for the three parallel arrays.",
        uses: [
            "Modeling interarrival times in queues and networks",
            "Reliability engineering and time-to-failure models",
            "The waiting-time component of a Poisson process",
        ],
        references: [
            "Ross, Introduction to Probability Models, Chapter 2",
            "Papoulis and Pillai, Probability, Random Variables and Stochastic Processes, Chapter 4",
        ],
        workedExample:
            "With rate lambda = 1, the density at x = 0 is 1 and at x = 1 is about 0.3679. The cumulative probability at x = 1 is about 0.6321, so roughly 63 percent of waits end within one time unit, and the average wait is 1.",
    },
    id: "exponential-distribution",
    name: "Exponential Distribution",
    category: "statistics-probability",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { lambda: 1, maxX: 6, steps: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "read rate lambda, upper bound maxX, and step count",
        "for each grid point x from zero to maxX",
        "compute the density lambda times exp of minus lambda x",
        "compute the CDF one minus exp of minus lambda x",
        "store both values and accumulate area",
        "report the mean one over lambda and variance",
        "done: emit the density and cumulative curves",
    ],
};

export default module;
