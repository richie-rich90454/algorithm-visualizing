/**
 * slice-sampling.ts - Univariate Slice Sampling (Stepping Out and Shrinkage)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Slice sampling draws from a target density without needing a proposal
 * distribution or a tuning parameter. Each iteration picks a uniform height y
 * under the curve at the current point, finds an interval around the point that
 * reaches below that horizontal slice by "stepping out", then repeatedly draws
 * a candidate in that interval and shrinks the interval toward the current
 * point until the candidate is above the slice. Accepted samples follow the
 * target distribution exactly. A fixed-seed generator keeps the demo
 * deterministic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * (steps + shrinks)) for the given iteration count
 *   Space: O(iterations) for the reported sample chain
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per iteration shows the accepted sample.
 *   - The active iteration is yellow and the final mean is green.
 *   - meta carries the full chain, slice levels and interval bounds.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function lcg(seed: number): () => number {
    let state = (seed >>> 0) || 1;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

/** Unnormalized Gaussian target density. */
function target(x: number, mean: number, sigma: number): number {
    const z = (x - mean) / sigma;
    return Math.exp(-0.5 * z * z);
}

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    if (values.length === 0) {
        return [];
    }
    const scale = Math.max(0.001, ...values.map((v) => Math.abs(v)));
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `x${index}: ${value.toFixed(2)}`,
        value,
        state: (done ? "sorted" : index === active ? "comparing" : "visited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value, scale },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        mean?: number;
        sigma?: number;
        width?: number;
        iterations?: number;
        seed?: number;
    } | null) ?? {};
    const mean = typeof task.mean === "number" ? task.mean : 0;
    const sigma = typeof task.sigma === "number" && task.sigma > 0 ? task.sigma : 1;
    const width = typeof task.width === "number" && task.width > 0 ? task.width : 2;
    const iterations = Math.min(5000, Math.max(1, Math.floor(Number(task.iterations ?? 14)) || 14));
    const rnd = lcg(typeof task.seed === "number" ? Math.floor(task.seed) : 11);

    const chain: number[] = [];
    const levels: number[] = [];
    const lowers: number[] = [];
    const uppers: number[] = [];
    let current = mean;

    const meta = (iteration: number, accepted: number) => {
        const n = chain.length;
        const sampleMean = n > 0 ? chain.reduce((sum, x) => sum + x, 0) / n : 0;
        const sampleVar = n > 1
            ? chain.reduce((sum, x) => sum + (x - sampleMean) ** 2, 0) / (n - 1)
            : 0;
        return {
            iterations,
            iteration,
            mean,
            sigma,
            width,
            accepted,
            chain: [...chain],
            levels: [...levels],
            lowers: [...lowers],
            uppers: [...uppers],
            sampleMean,
            sampleVar,
        };
    };

    yield {
        stepNumber: 0,
        entities: makeBars([], -1, false),
        edges: [],
        description: `Slice sampling a Gaussian with mean ${mean} and standard deviation ${sigma} for ${iterations} iterations.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, 0),
    };
    let step = 1;

    // Show at most about a dozen iterations so large statistical runs stay light.
    const displayEvery = Math.max(1, Math.floor(iterations / 12));

    for (let iter = 0; iter < iterations; iter += 1) {
        const height = target(current, mean, sigma);
        const sliceLevel = Math.max(1e-12, rnd() * height);

        // Stepping out: expand a random-width bracket around the current point.
        const leftShift = rnd() * width;
        const rightShift = rnd() * width;
        let lower = current - leftShift;
        let upper = current + rightShift;
        let guard = 0;
        while (lower > current - 8 * width && target(lower, mean, sigma) >= sliceLevel && guard < 64) {
            lower -= width;
            guard += 1;
        }
        guard = 0;
        while (upper < current + 8 * width && target(upper, mean, sigma) >= sliceLevel && guard < 64) {
            upper += width;
            guard += 1;
        }

        // Shrinkage: propose inside the bracket and shrink toward the current point.
        let proposal = lower + rnd() * (upper - lower);
        let shrink = 0;
        while (target(proposal, mean, sigma) < sliceLevel && shrink < 64) {
            if (proposal < current) {
                lower = proposal;
            } else {
                upper = proposal;
            }
            proposal = lower + rnd() * (upper - lower);
            shrink += 1;
        }
        current = proposal;
        chain.push(current);
        levels.push(sliceLevel);
        lowers.push(lower);
        uppers.push(upper);

        if (iter % displayEvery === 0 || iter === iterations - 1) {
            yield {
                stepNumber: step,
                entities: makeBars(chain, chain.length - 1, false),
                edges: [],
                description: `Iteration ${iter + 1}: slice height ${sliceLevel.toFixed(4)}, accepted x = ${current.toFixed(4)} after ${shrink} shrink step(s).`,
                codeLineNumber: shrink > 0 ? 4 : 3,
                layout: "array",
                meta: meta(iter + 1, chain.length),
            };
            step += 1;
        }
    }

    const final = meta(iterations, chain.length);
    const finalMean = final["sampleMean"] as number;
    const finalVar = final["sampleVar"] as number;
    yield {
        stepNumber: step,
        entities: makeBars([finalMean], 0, true),
        edges: [],
        description: `Sampled ${chain.length} points: mean ${finalMean.toFixed(4)}, variance ${finalVar.toFixed(4)} (target mean ${mean}).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...final, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine slicing the density curve with a horizontal line at a random height below the current point. Every location above that line is equally valid as the next sample. Slice sampling first widens an interval until its ends fall below the line, then draws candidates inside it and shrinks the interval toward the current point whenever a candidate is too low. No proposal distribution has to be tuned.",
        invariants: [
            "The slice height is always between zero and the target density at the current point.",
            "An accepted proposal has target density at least the slice height.",
            "The bracket always contains the current point while it is being shrunk.",
        ],
        correctness:
            "Stepping out and shrinkage are symmetric around the current point: the interval and the accept rule do not favor any direction, so the transition leaves the uniform area under the density invariant. Because the slice is drawn uniformly under the curve at the current point and accepted points are uniform on that slice, the stationary distribution has density proportional to the target. Repeated transitions therefore produce dependent samples from exactly the intended distribution.",
        complexityRationale:
            "One iteration performs a constant number of density evaluations while stepping out and a data-dependent number while shrinking; with a bounded bracket this is O(steps plus shrinks) per iteration, and the chain uses O(iterations) space.",
        uses: [
            "Bayesian posterior sampling when conjugate updates are unavailable",
            "Markov chain Monte Carlo with little or no tuning",
            "Sampling from log-concave and multimodal one-dimensional densities",
        ],
        references: [
            "Neal, Slice Sampling, Annals of Statistics, 2003",
            "Gelman, Carlin, Stern and Rubin, Bayesian Data Analysis, Chapter 11",
        ],
        workedExample:
            "At x = 0 under a standard normal, the density is about 1. A slice height of 0.6 is drawn, stepping out from a width of 2 already reaches points with density below 0.6 near plus and minus 1.0. A candidate at 0.4 has density 0.92, above the slice, so it is accepted as the next state.",
    },
    id: "slice-sampling",
    name: "Slice Sampling",
    category: "statistics-probability",
    complexity: { time: "O(iterations * (steps + shrinks))", space: "O(iterations)" },
    defaultInput: { mean: 0, sigma: 1, width: 2, iterations: 14, seed: 11 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the starting point and the target density",
        "draw a slice height uniformly below the density at the current point",
        "step left and right until the bracket ends fall below the slice",
        "draw a candidate uniformly inside the bracket",
        "if the candidate is below the slice, shrink the bracket toward the current point",
        "otherwise accept the candidate as the new state",
        "done: report the chain, its mean, and its variance",
    ],
};

export default module;
