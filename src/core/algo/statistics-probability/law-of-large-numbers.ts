/**
 * law-of-large-numbers.ts - Law of Large Numbers Demonstration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The law of large numbers says that the average of many independent draws
 * from a distribution approaches its expected value. This module draws i.i.d.
 * samples from either a fair six-sided die or a Bernoulli coin using a seeded
 * generator, and plots the running average after each draw. The jitter shrinks
 * as the sample count grows, making convergence visible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n draws
 *   Space: O(n) for the displayed running averages
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per draw shows the running average after that draw.
 *   - The current bar is highlighted; the final bar is green.
 *   - meta carries every draw and running average for verification.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic linear congruential generator. */
function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

/** Build running-average bars. */
function makeBars(averages: number[], trueMean: number, current: number, done: boolean): VisualEntity[] {
    return averages.map((average, index) => {
        let state: EntityState = "idle";
        if (done && index === averages.length - 1) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `n=${index + 1}:${average.toFixed(3)}`,
            value: average,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, draw: index + 1, average, trueMean },
        };
    });
}

/** The law of large numbers generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; seed?: number; distribution?: string; p?: number } | null) ?? {};
    const n = Math.min(2000, Math.max(1, Math.floor(Number(task.n ?? 100)) || 100));
    const seed = Math.floor(Number(task.seed ?? 42)) || 42;
    const distribution = task.distribution === "bernoulli" ? "bernoulli" : "dice";
    const p = Number.isFinite(Number(task.p)) ? Math.min(1, Math.max(0, Number(task.p))) : 0.5;
    const trueMean = distribution === "dice" ? 3.5 : p;
    const rng = makeRng(seed);

    const draws: number[] = [];
    const averages: number[] = [];
    let sum = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(averages, trueMean, -1, false),
        edges: [],
        description: `Drawing ${n} independent samples from ${distribution === "dice" ? "a fair six-sided die" : `a Bernoulli(p=${p}) coin`}; the true mean is ${trueMean.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, seed, distribution, p, trueMean, draws: [], averages: [], sampleCount: 0, runningAverage: 0, absoluteError: trueMean },
    };

    let step = 1;
    for (let i = 0; i < n; i += 1) {
        const draw = distribution === "dice" ? 1 + Math.floor(rng() * 6) : (rng() < p ? 1 : 0);
        draws.push(draw);
        sum += draw;
        const average = sum / (i + 1);
        averages.push(average);
        yield {
            stepNumber: step,
            entities: makeBars(averages, trueMean, i, false),
            edges: [],
            description: `Draw ${i + 1}: value ${draw}, running average ${average.toFixed(4)}, error ${Math.abs(average - trueMean).toFixed(4)} from the true mean.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, seed, distribution, p, trueMean, draws: [...draws], averages: [...averages], sampleCount: i + 1, runningAverage: average, absoluteError: Math.abs(average - trueMean) },
        };
        step += 1;
    }

    const finalAverage = averages[averages.length - 1] ?? 0;
    yield {
        stepNumber: step,
        entities: makeBars(averages, trueMean, -1, true),
        edges: [],
        description: `After ${n} draws the sample mean is ${finalAverage.toFixed(4)}, within ${Math.abs(finalAverage - trueMean).toFixed(4)} of the expected value ${trueMean.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, seed, distribution, p, trueMean, draws: [...draws], averages: [...averages], sampleCount: n, runningAverage: finalAverage, absoluteError: Math.abs(finalAverage - trueMean) },
    };
}

/** The law of large numbers module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A single coin flip says little about the coin, but thousands of flips reveal its bias. Track the average as draws accumulate: early on it jumps around, then the swings shrink and the average settles near the expected value. That settling is the law of large numbers in action.",
        invariants: [
            "Every draw comes from the same distribution and is independent of the others.",
            "The running average always equals the running sum divided by the number of draws.",
            "The seeded generator makes the whole sequence reproducible.",
        ],
        correctness:
            "The weak law of large numbers states that for i.i.d. variables with finite mean mu, the sample mean converges in probability to mu: for any tolerance epsilon, the chance the average differs from mu by more than epsilon tends to zero as n grows. The simulation implements independent draws from a distribution with known mean, so its running average obeys that convergence; the decreasing error band in the frames is a direct observation of the theorem.",
        complexityRationale:
            "Each draw needs one pseudorandom number and constant arithmetic, so n draws take O(n) time. Keeping every draw and average for the plot uses O(n) space.",
        uses: [
            "Monte Carlo estimation of expectations",
            "Explaining why large samples stabilize statistics",
            "Justifying averaging in simulation and polling",
        ],
        references: [
            "Grimmett and Stirzaker, Probability and Random Processes, Chapter 7",
            "Ross, A First Course in Probability, Chapter 8",
        ],
        workedExample:
            "With a fair die the mean is 3.5. After ten draws the average might be 3.9, but over two thousand seeded draws the running average typically ends within a few hundredths of 3.5, and the error trend visibly falls as more draws are added.",
    },
    id: "law-of-large-numbers",
    name: "Law of Large Numbers",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { n: 100, seed: 42, distribution: "dice", p: 0.5 },
    visualType: "array",
    run,
    pseudocode: [
        "set the true mean of the distribution",
        "initialize the running sum to zero",
        "for each of n independent draws",
        "sample a value from the distribution and add it to the sum",
        "record the running sum divided by the draw count",
        "compare the running average with the true mean",
        "done: report the final sample mean and its error",
    ],
};

export default module;
