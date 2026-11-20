/**
 * dropout-regularization.ts - Inverted Dropout Regularization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dropout regularizes a network by zeroing each activation independently with
 * probability p during training. Inverted dropout then multiplies the kept
 * activations by 1/(1-p), so the expected value of a dropped layer equals the
 * original activation and no rescaling is needed at inference time. This demo
 * samples masks with a seeded generator so the replay is deterministic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(trials * d) for d activations
 *   Space: O(d) for the running expectation accumulator
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per activation shows its dropped output.
 *   - Dropped units are idle at zero; kept units are active and scaled up.
 *   - Meta records the sampled mask and the running expected output.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic 32-bit pseudo-random generator (mulberry32). */
function mulberry32(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function makeEntities(outputs: number[], mask: number[]): VisualEntity[] {
    return outputs.map((value, index) => ({
        id: `unit-${index}`,
        type: "bar" as const,
        label: value.toFixed(2),
        value,
        state: (mask[index] === 0 ? "idle" : "active") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, mask: mask[index] ?? 0 },
    }));
}

/** The inverted-dropout generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            activations?: number[];
            rate?: number;
            seed?: number;
            trials?: number;
        } | null
    ) ?? {};
    const activations: number[] = task.activations ?? [0.5, 1, 1.5, 2, 2.5, 3];
    const rate = typeof task.rate === "number" ? Math.min(0.95, Math.max(0, task.rate)) : 0.5;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 11;
    const trials =
        typeof task.trials === "number" ? Math.max(1, Math.floor(task.trials)) : 12;
    const random = mulberry32(seed);
    const scale = 1 / (1 - rate);
    const sum = activations.map(() => 0);

    const zeroMask = activations.map(() => 0);
    yield {
        stepNumber: 0,
        entities: makeEntities(activations, zeroMask),
        edges: [],
        description: `Inverted dropout with rate ${rate} on ${activations.length} activations; kept units are scaled by ${scale.toFixed(2)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rate, trials, seed, trial: 0, mask: [...zeroMask], expectation: [...activations] },
    };

    let step = 1;
    for (let trial = 1; trial <= trials; trial += 1) {
        const mask = activations.map(() => (random() >= rate ? scale : 0));
        const outputs = activations.map((value, index) => {
            const dropped = value * mask[index]!;
            sum[index] = (sum[index] ?? 0) + dropped;
            return dropped;
        });
        const expectation = sum.map((value) => value / trial);
        yield {
            stepNumber: step,
            entities: makeEntities(outputs, mask),
            edges: [],
            description: `Trial ${trial}: dropped ${mask.filter((value) => value === 0).length} of ${activations.length} units; kept activations multiplied by ${scale.toFixed(2)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                rate,
                trials,
                seed,
                trial,
                mask: mask.map((value) => Number(value.toFixed(6))),
                expectation: expectation.map((value) => Number(value.toFixed(6))),
            },
        };
        step += 1;
    }

    const expectation = sum.map((value) => value / trials);
    yield {
        stepNumber: step,
        entities: makeEntities(expectation, activations.map(() => scale)),
        edges: [],
        description: `Over ${trials} trials the sampled mean approaches the original activations because a kept unit's scale cancels the drop probability.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            rate,
            trials,
            seed,
            trial: trials,
            mask: activations.map(() => scale),
            expectation: expectation.map((value) => Number(value.toFixed(6))),
            original: [...activations],
        },
    };
}

/** The inverted-dropout module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Dropout breaks a network's reliance on individual neurons by randomly silencing a fraction of them on each training step. Inverted dropout then boosts the survivors by the inverse keep probability. Because a neuron survives with probability 1-p and is then scaled by 1/(1-p), its average contribution is unchanged, so evaluation can use the full network as is.",
        invariants: [
            "Each unit is either dropped to zero or kept and multiplied by 1/(1-p).",
            "The kept scale is the same for every unit and every trial.",
            "The expected masked activation equals the original activation.",
        ],
        correctness:
            "A Bernoulli keep variable K is one with probability 1-p and zero otherwise, and the inverted output is K/(1-p) times the activation. Its expectation is (1-p)/(1-p) times the activation, which is the activation itself. Therefore training with inverted dropout produces layers whose mean matches inference without any extra scaling.",
        complexityRationale:
            "Each trial draws one random number and scales each of the d activations, so the time is O(trials * d). Only a length-d running sum is needed, giving O(d) space.",
        uses: [
            "Regularizing deep neural networks against overfitting",
            "Approximating an ensemble of many thinned networks",
            "Reducing co-adaptation of features in fully connected layers",
        ],
        references: [
            "Srivastava et al., Dropout: A Simple Way to Prevent Neural Networks from Overfitting, 2014",
            "Goodfellow, Bengio, and Courville, Deep Learning, Chapter 7, 2016",
        ],
        workedExample:
            "With activations [1, 2] and drop rate 0.5, kept units are multiplied by two. If the first unit survives and the second is dropped, the masked layer is [2, 0]. Averaging many such masks gives values near [1, 2], the original layer.",
    },
    id: "dropout-regularization",
    name: "Dropout Regularization",
    category: "ml-ai",
    complexity: { time: "O(trials * d)", space: "O(d)" },
    defaultInput: {
        activations: [0.5, 1, 1.5, 2, 2.5, 3],
        rate: 0.5,
        seed: 11,
        trials: 12,
    },
    visualType: "array",
    run,
    pseudocode: [
        "set the keep scale to one over one minus the drop rate",
        "for each sampled training step",
        "draw an independent Bernoulli keep decision per unit",
        "zero dropped units and multiply kept units by the scale",
        "accumulate each unit's output for the running mean",
        "done: report that the mean recovers the original activations",
    ],
};

export default module;
