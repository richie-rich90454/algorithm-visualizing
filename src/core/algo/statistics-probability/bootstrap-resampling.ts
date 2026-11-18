/**
 * bootstrap-resampling.ts - Bootstrap Resampling Confidence Interval
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bootstrapping estimates the sampling distribution of a statistic by drawing
 * many resamples of the same size from the observed data with replacement. The
 * spread of the resample means approximates how much the true mean would vary
 * across repeated experiments, and the percentile interval gives a simple
 * confidence interval. A seeded generator keeps every run reproducible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(B * n) for B resamples of size n
 *   Space: O(B * n) for the recorded indices and means
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per resample shows the mean of that resample.
 *   - The current resample is highlighted; the final frame is green.
 *   - meta carries all indices and means for independent verification.
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

/** Build bars for the bootstrap means. */
function makeBars(means: number[], current: number, done: boolean): VisualEntity[] {
    return means.map((mean, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `b${index + 1}:${mean.toFixed(3)}`,
            value: mean,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, mean },
        };
    });
}

/** The bootstrap generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { data?: number[]; resamples?: number; seed?: number; alpha?: number } | null) ?? {};
    const data = Array.isArray(task.data) && task.data.length > 0
        ? task.data.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : [2, 4, 4, 4, 5, 5, 7, 9];
    const n = Math.max(1, data.length);
    const b = Math.min(500, Math.max(2, Math.floor(Number(task.resamples ?? 200)) || 200));
    const seed = Math.floor(Number(task.seed ?? 42)) || 42;
    const alpha = Number.isFinite(Number(task.alpha)) ? Math.min(0.5, Math.max(0.01, Number(task.alpha))) : 0.05;
    const rng = makeRng(seed);

    const dataMin = Math.min(...data);
    const dataMax = Math.max(...data);
    const sampleMean = data.reduce((sum, value) => sum + value, 0) / n;

    yield {
        stepNumber: 0,
        entities: makeBars([], -1, false),
        edges: [],
        description: `Bootstrapping ${b} resamples of size ${n} from ${n} observations; sample mean ${sampleMean.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, b, seed, alpha, data: [...data], sampleMean, dataMin, dataMax, means: [], resampleIndicesFlat: [], sampleSize: n, ciLower: 0, ciUpper: 0, currentMean: 0 },
    };

    const means: number[] = [];
    const indicesFlat: number[] = [];
    let step = 1;
    for (let resample = 0; resample < b; resample += 1) {
        let total = 0;
        for (let j = 0; j < n; j += 1) {
            const index = Math.min(n - 1, Math.floor(rng() * n));
            indicesFlat.push(index);
            total += data[index] ?? 0;
        }
        const mean = total / n;
        means.push(mean);
        yield {
            stepNumber: step,
            entities: makeBars(means, resample, false),
            edges: [],
            description: `Resample ${resample + 1} of ${b}: mean ${mean.toFixed(4)} from ${n} draws with replacement.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, b, seed, alpha, data: [...data], sampleMean, dataMin, dataMax, means: [...means], resampleIndicesFlat: [...indicesFlat], sampleSize: n, ciLower: 0, ciUpper: 0, currentMean: mean },
        };
        step += 1;
    }

    const sorted = [...means].sort((x, y) => x - y);
    const lowerIndex = Math.min(sorted.length - 1, Math.floor((alpha / 2) * sorted.length));
    const upperIndex = Math.max(0, Math.min(sorted.length - 1, Math.ceil((1 - alpha / 2) * sorted.length) - 1));
    const ciLower = sorted[lowerIndex] ?? 0;
    const ciUpper = sorted[upperIndex] ?? 0;

    yield {
        stepNumber: step,
        entities: makeBars(means, -1, true),
        edges: [],
        description: `Bootstrap complete: ${b} means from ${dataMin} to ${dataMax} in the data; ${(1 - alpha) * 100} percent percentile interval is [${ciLower.toFixed(3)}, ${ciUpper.toFixed(3)}].`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, b, seed, alpha, data: [...data], sampleMean, dataMin, dataMax, means: [...means], resampleIndicesFlat: [...indicesFlat], sampleSize: n, ciLower, ciUpper, currentMean: means[means.length - 1] ?? 0 },
    };
}

/** The bootstrap resampling module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Treat the observed sample as if it were the whole population and repeatedly draw new samples from it with replacement. Each resample gives another value of the statistic, and the collection of those values shows how much the statistic would wobble from experiment to experiment. The middle percentile band is a practical confidence interval.",
        invariants: [
            "Every resample has exactly the same size as the original data.",
            "Draws are with replacement, so an observation may appear zero or many times.",
            "Each resample mean lies between the minimum and maximum of the data.",
        ],
        correctness:
            "Bootstrapping approximates the sampling distribution of a statistic by the empirical distribution of the data. For a mean, the bootstrap distribution is centered at the sample mean and its spread approximates the true standard error for large samples; the percentile interval takes the alpha/2 and one-minus-alpha/2 quantiles of that distribution, giving a confidence interval with asymptotic coverage one minus alpha. The seeded resampling implements independent draws from the empirical distribution exactly.",
        complexityRationale:
            "Each of the B resamples draws n indices and sums n values, so the time is O(B times n). Storing the index list and the means uses O(B times n) space.",
        uses: [
            "Estimating confidence intervals without distributional assumptions",
            "Assessing the stability of a sample statistic",
            "Small-sample inference where formulas are unreliable",
        ],
        references: [
            "Efron, Bootstrap Methods: Another Look at the Jackknife, 1979",
            "Efron and Tibshirani, An Introduction to the Bootstrap, 1993",
        ],
        workedExample:
            "For the eight values 2, 4, 4, 4, 5, 5, 7, 9 the sample mean is 5. A resample might pick the indices 3, 0, 7, 7, 1, 5, 2, 4 and average about 5.1; after two hundred such resamples the middle 95 percent of the means forms the reported interval around 5.",
    },
    id: "bootstrap-resampling",
    name: "Bootstrap Resampling",
    category: "statistics-probability",
    complexity: { time: "O(B * n)", space: "O(B * n)" },
    defaultInput: { data: [2, 4, 4, 4, 5, 5, 7, 9], resamples: 200, seed: 42, alpha: 0.05 },
    visualType: "array",
    run,
    pseudocode: [
        "record the observed data and its sample mean",
        "for each of B bootstrap replicates",
        "draw n observations from the data with replacement",
        "compute and store the mean of this resample",
        "sort the stored means from smallest to largest",
        "read the alpha/2 and one-minus-alpha/2 quantiles",
        "done: report the bootstrap percentile confidence interval",
    ],
};

export default module;
