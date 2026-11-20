/**
 * laplace-mechanism-differential-privacy.ts - Laplace Differential Privacy
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Laplace mechanism releases a numeric query answer with calibrated noise
 * so that neighboring datasets produce indistinguishable outputs. The noise
 * scale is the query's global sensitivity divided by the privacy budget
 * epsilon. This module samples the Laplace distribution by inverting its CDF
 * with a seeded uniform generator, then shows several noisy releases of the
 * same true answer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(s) for s noise samples
 *   Space: O(s) for the displayed releases
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per noisy release, centered around the true value.
 *   - The true value bar is GREEN (sorted); noisy bars are BLUE (active).
 *   - The final frame reports the noise scale and the privacy parameters.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    trueValue?: number;
    sensitivity?: number;
    epsilon?: number;
    seed?: number;
    samples?: number;
}

const DEFAULT_INPUT: Required<Input> = {
    trueValue: 50,
    sensitivity: 10,
    epsilon: 1,
    seed: 12345,
    samples: 8,
};

function lcg(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function laplaceNoise(uniform: number, scale: number): number {
    const u = Math.min(1 - 1e-12, Math.max(1e-12, uniform));
    const centered = u - 0.5;
    return -scale * Math.sign(centered) * Math.log(1 - 2 * Math.abs(centered));
}

function makeBars(
    releases: number[],
    trueValue: number,
    states: Map<number, EntityState>,
): VisualEntity[] {
    return releases.map((value, index) => ({
        id: `bar-release-${index}`,
        type: "bar" as const,
        label: `#${index + 1}`,
        value,
        state: states.get(index) ?? "active",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { sample: index, release: value, trueValue, noise: value - trueValue },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const raw = (input as Input | null) ?? {};
    const trueValue = typeof raw.trueValue === "number" ? raw.trueValue : DEFAULT_INPUT.trueValue;
    const sensitivity = typeof raw.sensitivity === "number" ? Math.max(0, raw.sensitivity) : DEFAULT_INPUT.sensitivity;
    const epsilon = typeof raw.epsilon === "number" ? Math.max(1e-9, raw.epsilon) : DEFAULT_INPUT.epsilon;
    const seed = typeof raw.seed === "number" ? raw.seed : DEFAULT_INPUT.seed;
    const samples = typeof raw.samples === "number" ? Math.max(1, Math.floor(raw.samples)) : DEFAULT_INPUT.samples;

    const scale = sensitivity / epsilon;
    const uniform = lcg(seed);
    const noise: number[] = [];
    const releases: number[] = [];
    for (let i = 0; i < samples; i += 1) {
        const draw = laplaceNoise(uniform(), scale);
        noise.push(draw);
        releases.push(trueValue + draw);
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(releases, trueValue, new Map()),
        edges: [],
        description: `Laplace mechanism with sensitivity ${sensitivity} and epsilon ${epsilon} gives noise scale ${scale.toFixed(4)}; drawing ${samples} release(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { trueValue, sensitivity, epsilon, scale, samples, seed },
    };
    step += 1;

    for (let i = 0; i < samples; i += 1) {
        const states = new Map<number, EntityState>([[i, "active"]]);
        yield {
            stepNumber: step,
            entities: makeBars(releases, trueValue, states),
            edges: [],
            description: `Release ${i + 1}: noise ${noise[i]?.toFixed(4) ?? "0"} gives the noisy answer ${releases[i]?.toFixed(4) ?? "0"}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { sample: i, noise: noise[i] ?? 0, release: releases[i] ?? 0, scale },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(releases, trueValue, new Map()),
        edges: [],
        description: `Privacy budget epsilon = ${epsilon}: every release is the true answer ${trueValue} plus Laplace noise of scale ${scale.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { trueValue, sensitivity, epsilon, scale, seed, samples, noise, releases },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To hide whether one person is in a dataset, add random noise to the answer. The noise must be large when the answer could change a lot between neighboring datasets and small when the privacy budget is generous. The Laplace distribution has exactly the shape that makes all neighboring datasets produce outputs within a constant factor of each other.",
        invariants: [
            "The noise scale equals global sensitivity divided by epsilon.",
            "Every release equals the true answer plus one Laplace noise draw.",
            "For any output, the likelihood ratio between neighboring datasets is at most exp(epsilon).",
        ],
        correctness:
            "For a query with global sensitivity Delta, changing one record moves the true answer by at most Delta. The Laplace density at an output x is proportional to exp of minus the absolute distance from the true answer divided by b, where b is Delta over epsilon. The ratio of densities for two answers Delta apart is bounded by exp(Delta over b), which equals exp(epsilon). By composition over the density integral this gives epsilon-differential privacy for every output set.",
        complexityRationale:
            "Each sample needs one uniform draw and a logarithm, so the work and stored releases are linear in the requested number of samples and independent of the dataset size.",
        uses: [
            "Releasing aggregate statistics from sensitive datasets",
            "Private count queries in census and health data",
            "Training data protection in machine learning pipelines",
        ],
        references: [
            "Dwork, Differential Privacy, ICALP, 2006",
            "Dwork and Roth, The Algorithmic Foundations of Differential Privacy, 2014",
        ],
        workedExample:
            "A count query with sensitivity 1 and epsilon 0.5 uses noise scale 2. If the true count is 50 and the drawn noise is 1.4, the released answer is 51.4. Neighboring datasets that differ by one in the count give output densities within a factor of exp(0.5) of each other.",
    },
    id: "laplace-mechanism-differential-privacy",
    name: "Laplace Mechanism (Differential Privacy)",
    category: "production-systems",
    complexity: { time: "O(s)", space: "O(s)" },
    defaultInput: DEFAULT_INPUT,
    visualType: "array",
    run,
    pseudocode: [
        "read the true answer, global sensitivity and privacy budget",
        "set the noise scale to sensitivity divided by epsilon",
        "for each requested sample draw a uniform value with a seeded generator",
        "invert the Laplace CDF to turn the uniform draw into noise",
        "add the noise to the true answer to form a release",
        "report the releases together with the privacy parameters",
    ],
};

export default module;
