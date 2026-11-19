/**
 * he-initialization.ts - He (Kaiming) Weight Initialization
 *
 * He initialization scales the initial weights of a ReLU network by the number
 * of inputs so that the variance of activations stays stable across layers.
 * The uniform form draws from minus to plus the square root of six over fan-in.
 * This replay uses a deterministic stratified draw so the variance is exact.
 *
 * Time:  O(samples), space O(samples)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HeInput {
    fanIn: number;
    samples: number;
}

/** Uniform bound whose squared value divided by three gives variance 2/fanIn. */
export function heUniformBound(fanIn: number): number {
    return Math.sqrt(6 / Math.max(1, fanIn));
}

/** Deterministic stratified draws in [-1, 1] scaled to the He uniform bound. */
export function heSamples(fanIn: number, count: number): number[] {
    const bound = heUniformBound(fanIn);
    return Array.from({ length: count }, (_unused, k) => {
        const u = (2 * (k + 0.5)) / count - 1;
        return bound * u;
    });
}

function makeBars(values: number[], bound: number, revealed: number): VisualEntity[] {
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
            metadata: { index: i, bound },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<HeInput> | null) ?? {};
    const fanIn = Math.max(1, Math.floor(task.fanIn ?? 4));
    const count = Math.max(2, Math.floor(task.samples ?? 12));
    const bound = heUniformBound(fanIn);
    const values = heSamples(fanIn, count);
    const theoreticalVariance = 2 / fanIn;
    const empiricalVariance = values.reduce((sum, v) => sum + v * v, 0) / values.length;
    const base = { fanIn, count, bound, rows: 1, cols: count, theoreticalVariance, empiricalVariance, std: Math.sqrt(theoreticalVariance) };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(values, bound, -1),
        edges: [],
        description: `He initialization for fan-in ${fanIn}: uniform bound ${bound.toFixed(4)}, target variance ${theoreticalVariance.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, weights: values.slice() },
    };
    step += 1;

    for (let i = 0; i < count; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(values, bound, i),
            edges: [],
            description: `Sample ${i + 1}: draw ${values[i]!.toFixed(4)} inside the symmetric He interval.`,
            codeLineNumber: i === count - 1 ? 4 : 3,
            layout: "array",
            meta: { ...base, weights: values.slice(), revealed: i },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(values, bound, count - 1),
        edges: [],
        description: `Done: empirical variance ${empiricalVariance.toFixed(4)} is close to 2 over fan-in.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...base, weights: values.slice(), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If the weights of a layer are too large, activations explode; too small and they vanish. He initialization chooses the initial spread from the number of incoming connections, using a factor of two because a ReLU passes roughly half of its inputs. The uniform variant draws symmetrically from a bound set by the square root of six over fan-in.",
        invariants: [
            "Every drawn weight lies within plus or minus the square root of six over fan-in.",
            "The draws are symmetric around zero, so their mean is zero.",
            "The variance of the uniform draw approaches two over fan-in as the sample count grows.",
        ],
        correctness:
            "A uniform draw on the interval from minus a to plus a has variance a squared over three. Setting a to the square root of six over fan-in makes that variance exactly two over fan-in in expectation, which is the He criterion for ReLU layers. The replay fills the interval with evenly spaced stratified points, so the empirical second moment converges to the same value, and the test verifies both the bound and the resulting variance against an independent computation.",
        complexityRationale:
            "Generating each sample needs constant arithmetic and each frame redraws the displayed bars, so the work is O(samples) per frame. Storing the sampled weights uses O(samples) space.",
        uses: [
            "Initializing deep convolutional networks with ReLU activations",
            "Avoiding vanishing or exploding activations at training start",
            "A default weight scale in modern vision and language models",
        ],
        references: [
            "He et al., Delving Deep into Rectifiers, ICCV, 2015",
            "Goodfellow, Bengio, and Courville, Deep Learning, Section 8.2, 2016",
        ],
        workedExample:
            "With fan-in four the bound is the square root of one and a half, about 1.22. Twelve evenly spaced draws fill the interval from minus 1.22 to plus 1.22 symmetrically. Their variance is close to two over four, or 0.5, which keeps the variance of the next layer's pre-activations near one after a ReLU.",
    },
    id: "he-initialization",
    name: "He (Kaiming) Initialization",
    category: "ml-ai",
    complexity: { time: "O(samples)", space: "O(samples)" },
    defaultInput: { fanIn: 4, samples: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "read the fan-in and the requested number of samples",
        "set the uniform bound to the square root of six over fan-in",
        "for each sample take an evenly spaced point between minus one and one",
        "scale that point by the uniform bound",
        "accumulate the squared draws to estimate the variance",
        "compare the estimate with the target variance of two over fan-in",
        "done: report the sampled weights and their variance",
    ],
};

export default module;
