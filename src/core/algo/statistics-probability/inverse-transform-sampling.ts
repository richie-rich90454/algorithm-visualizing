/**
 * inverse-transform-sampling.ts - Inverse Transform Sampling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Inverse transform sampling turns a uniform random number into a draw from a
 * target discrete distribution. The probabilities are accumulated into a CDF,
 * then each uniform u is mapped to the smallest outcome whose cumulative
 * probability is at least u. With a fixed seed the stream of uniforms is
 * reproducible, so the visualization and its correctness check are fully
 * deterministic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(outcomes + n * log(outcomes)) with binary search per draw
 *   Space: O(outcomes + n) for the CDF, draws, and tallies
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per outcome shows its cumulative probability.
 *   - The outcome selected by the current uniform is highlighted.
 *   - The final frame reports the empirical frequency of each outcome.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SamplingInput {
    values?: number[];
    probabilities?: number[];
    samples?: number;
    seed?: number;
}

/** Advance a deterministic linear congruential generator. */
function nextUniform(state: number): [number, number] {
    const next = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return [next, next / 4294967296];
}

/** Build one CDF bar per outcome. */
function makeBars(
    values: number[],
    cdf: number[],
    selected: number,
    counts: number[],
    done: boolean,
): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === selected) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `X=${value}: F=${(cdf[index] ?? 0).toFixed(3)} (count ${counts[index] ?? 0})`,
            value: cdf[index] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value, cdf: cdf[index] ?? 0, count: counts[index] ?? 0 },
        };
    });
}

/** The inverse transform sampling generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SamplingInput | null) ?? {};
    const values: number[] = Array.isArray(task.values) ? [...task.values] : [0, 1, 2];
    const rawProbabilities: number[] = Array.isArray(task.probabilities)
        ? [...task.probabilities]
        : [0.2, 0.3, 0.5];
    const probabilitySum = rawProbabilities.reduce((a, b) => a + b, 0);
    const probabilities = probabilitySum === 0
        ? rawProbabilities.map(() => 1 / rawProbabilities.length)
        : rawProbabilities.map((p) => p / probabilitySum);
    const samples = Math.max(1, Math.min(5000, Math.floor(task.samples ?? 20)));
    let seed = (Math.floor(task.seed ?? 12345) >>> 0) || 1;

    const cdf: number[] = [];
    let running = 0;
    for (const probability of probabilities) {
        running += probability;
        cdf.push(running);
    }
    cdf[cdf.length - 1] = 1;
    const counts = new Array<number>(values.length).fill(0);

    yield {
        stepNumber: 0,
        entities: makeBars(values, cdf, -1, counts, false),
        edges: [],
        description: `Building the CDF over ${values.length} outcome(s) for ${samples} deterministic draws.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { outcomes: values.length, values, probabilities, cdf: [...cdf], uniforms: [] as number[], draws: [] as number[], counts: [...counts] },
    };
    let step = 1;
    const uniforms: number[] = [];
    const draws: number[] = [];

    for (let i = 0; i < samples; i += 1) {
        const advanced = nextUniform(seed);
        seed = advanced[0];
        const u = advanced[1];
        uniforms.push(u);
        let low = 0;
        let high = cdf.length - 1;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (u < (cdf[mid] ?? 0)) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        const index = low;
        const sampledValue = values[index] ?? 0;
        draws.push(sampledValue);
        counts[index] = (counts[index] ?? 0) + 1;
        if (samples <= 60 || i % Math.ceil(samples / 30) === 0) {
            yield {
                stepNumber: step,
                entities: makeBars(values, cdf, index, counts, false),
                edges: [],
                description: `Draw ${i + 1}: u=${u.toFixed(6)} falls in outcome ${index}, value ${sampledValue}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { outcomes: values.length, values, probabilities, cdf: [...cdf], uniforms: [...uniforms], draws: [...draws], counts: [...counts] },
            };
            step += 1;
        }
    }

    const frequencies = counts.map((count) => count / samples);
    yield {
        stepNumber: step,
        entities: makeBars(values, cdf, -1, counts, true),
        edges: [],
        description: `After ${samples} draws, empirical frequencies [${frequencies.map((f) => f.toFixed(3)).join(", ")}] track the target probabilities.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { outcomes: values.length, values, probabilities, cdf, uniforms, draws, counts, frequencies },
    };
}

/** The inverse transform sampling module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine laying the outcomes end to end on a line from zero to one, each taking a length equal to its probability. Drawing a uniform number is dropping a dart on that line, and the outcome covering the dart is the sample. Searching the cumulative probabilities finds that outcome quickly with a binary search.",
        invariants: [
            "The cumulative probabilities are nondecreasing and the last one equals one.",
            "A uniform u in the interval for outcome k always selects the value at index k.",
            "Every emitted draw is one of the supplied outcome values.",
        ],
        correctness:
            "The half open intervals between consecutive cumulative probabilities partition the unit interval, and their lengths equal the target probabilities. A uniform draw therefore lands in interval k with exactly probability p_k, so mapping the draw to outcome k samples the target distribution. Binary search returns the first cumulative value at least u, which is precisely that interval. Deterministic seeding makes the stream reproducible without changing its uniform behavior.",
        complexityRationale:
            "Building the CDF is linear in the number of outcomes, and each draw binary searches it in logarithmic time, giving O(outcomes plus n log outcomes). Storing the CDF, the uniforms, the draws, and the tallies uses O(outcomes plus n) space.",
        uses: [
            "Generating samples from a fitted discrete distribution",
            "Monte Carlo simulation with a known cumulative distribution",
            "Teaching the probability integral transform",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 2, Section 3.4.1",
            "Devroye, Non-Uniform Random Variate Generation, 1986",
        ],
        workedExample:
            "For outcomes 0, 1, 2 with probabilities 0.2, 0.3, 0.5, the CDF is 0.2, 0.5, 1. A uniform draw of 0.37 is at least 0.2 but below 0.5, so it selects outcome 1. A draw of 0.91 exceeds 0.5 and selects outcome 2.",
    },
    id: "inverse-transform-sampling",
    name: "Inverse Transform Sampling",
    category: "statistics-probability",
    complexity: { time: "O(outcomes + n * log(outcomes))", space: "O(outcomes + n)" },
    defaultInput: { values: [0, 1, 2], probabilities: [0.2, 0.3, 0.5], samples: 20, seed: 12345 },
    visualType: "array",
    run,
    pseudocode: [
        "read the outcomes, their probabilities, the draw count, and a seed",
        "normalize the probabilities and accumulate them into a CDF",
        "for each draw advance the seeded uniform generator to get u",
        "binary search the CDF for the first entry greater than or equal to u",
        "emit the outcome at that index as the sample",
        "tally how often each outcome was selected",
        "done: report the draws and their empirical frequencies",
    ],
};

export default module;
