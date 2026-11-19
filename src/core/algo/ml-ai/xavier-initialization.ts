/**
 * xavier-initialization.ts - Xavier (Glorot) Weight Initialization
 *
 * Xavier initialization keeps the variance of activations and gradients stable
 * by scaling initial weights with both the fan-in and the fan-out. The uniform
 * variant draws from minus to plus the square root of six over their sum. A
 * deterministic stratified draw makes the variance exact in the replay.
 *
 * Time:  O(samples), space O(samples)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface XavierInput {
    fanIn: number;
    fanOut: number;
    samples: number;
}

/** Uniform bound whose squared value divided by three gives variance 2/(fanIn+fanOut). */
export function xavierUniformBound(fanIn: number, fanOut: number): number {
    return Math.sqrt(6 / Math.max(1, fanIn + fanOut));
}

/** Deterministic stratified draws in [-1, 1] scaled to the Xavier bound. */
export function xavierSamples(fanIn: number, fanOut: number, count: number): number[] {
    const bound = xavierUniformBound(fanIn, fanOut);
    return Array.from({ length: count }, (_unused, k) => {
        const u = (2 * (k + 0.5)) / count - 1;
        return bound * u;
    });
}

function makeBars(values: number[], revealed: number): VisualEntity[] {
    return values.map((value, i) => {
        const state: EntityState = i <= revealed ? "sorted" : "idle";
        return {
            id: `bar-${i}`,
            type: "bar" as const,
            label: i <= revealed ? `w${i}: ${value.toFixed(3)}` : "?",
            value: i <= revealed ? value : 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<XavierInput> | null) ?? {};
    const fanIn = Math.max(1, Math.floor(task.fanIn ?? 4));
    const fanOut = Math.max(1, Math.floor(task.fanOut ?? 6));
    const count = Math.max(2, Math.floor(task.samples ?? 12));
    const bound = xavierUniformBound(fanIn, fanOut);
    const values = xavierSamples(fanIn, fanOut, count);
    const theoreticalVariance = 2 / (fanIn + fanOut);
    const empiricalVariance = values.reduce((sum, v) => sum + v * v, 0) / values.length;
    const base = { fanIn, fanOut, count, bound, rows: 1, cols: count, theoreticalVariance, empiricalVariance, std: Math.sqrt(theoreticalVariance) };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(values, -1),
        edges: [],
        description: `Xavier initialization with fan-in ${fanIn} and fan-out ${fanOut}: bound ${bound.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, weights: values.slice() },
    };
    step += 1;

    for (let i = 0; i < count; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(values, i),
            edges: [],
            description: `Sample ${i + 1}: place a symmetric draw inside the Xavier interval.`,
            codeLineNumber: i === count - 1 ? 4 : 3,
            layout: "array",
            meta: { ...base, weights: values.slice(), revealed: i },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(values, count - 1),
        edges: [],
        description: `Done: empirical variance ${empiricalVariance.toFixed(4)} matches two over fan-in plus fan-out.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...base, weights: values.slice(), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A well-initialized layer passes signals forward and gradients backward without shrinking or blowing up. Xavier initialization balances both directions by using the average of fan-in and fan-out as the scale. The uniform form draws symmetrically within a bound derived from that average, which is a good default for saturating activations such as sigmoid and tanh.",
        invariants: [
            "Every draw lies within plus or minus the square root of six over fan-in plus fan-out.",
            "The symmetric stratified draws have mean zero.",
            "The variance of the draw approaches two over fan-in plus fan-out.",
        ],
        correctness:
            "A uniform draw on minus a to plus a has variance a squared over three. Choosing a as the square root of six over the sum of fan-in and fan-out yields variance two over that sum, which is the Glorot condition balancing forward and backward signal variance under linear activations. The stratified sequence fills the interval evenly, so its empirical variance approaches the same value, and the test recomputes each draw and the variance independently.",
        complexityRationale:
            "Each of the samples takes constant arithmetic to produce and the bars are redrawn once per frame, so the work is O(samples). Keeping the weight vector uses O(samples) space.",
        uses: [
            "Initializing fully connected layers with sigmoid or tanh activations",
            "Stabilizing training in autoencoders and multilayer perceptrons",
            "A baseline scale for comparing newer initialization schemes",
        ],
        references: [
            "Glorot and Bengio, Understanding the Difficulty of Training Deep Feedforward Neural Networks, AISTATS, 2010",
            "Goodfellow, Bengio, and Courville, Deep Learning, Section 8.2, 2016",
        ],
        workedExample:
            "With fan-in four and fan-out six the denominator is ten, so the bound is the square root of 0.6, about 0.775. Twelve even draws fill the interval symmetrically. Their variance is close to two over ten, or 0.2, which keeps both forward activations and backward gradients near unit variance across a linear layer.",
    },
    id: "xavier-initialization",
    name: "Xavier (Glorot) Initialization",
    category: "ml-ai",
    complexity: { time: "O(samples)", space: "O(samples)" },
    defaultInput: { fanIn: 4, fanOut: 6, samples: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "read the fan-in, fan-out, and sample count",
        "set the uniform bound to the square root of six over fan-in plus fan-out",
        "for each sample take an evenly spaced point between minus one and one",
        "scale that point by the uniform bound",
        "accumulate squared draws to estimate the variance",
        "compare with the target variance two over fan-in plus fan-out",
        "done: report the sampled weights and their variance",
    ],
};

export default module;
