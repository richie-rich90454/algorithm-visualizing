/**
 * stochastic-depth.ts - Stochastic Depth (Layer Dropout)
 *
 * Stochastic depth randomly skips whole layers during training with a
 * per-layer survival probability. The network therefore trains an ensemble of
 * subnetworks of different depths, and at inference every layer is active with
 * its expected scale. Deeper layers usually get lower survival probabilities.
 *
 * Time is O(rounds * layers); space is O(layers) for the survival flags.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { mulberry32 } from "./random-search-hyperparameter";

/** Sum of the per-layer survival probabilities: the expected active depth. */
export function expectedDepth(probabilities: number[]): number {
    return probabilities.reduce((sum, p) => sum + Math.max(0, Math.min(1, p)), 0);
}

export interface DepthSample {
    active: boolean[];
    depth: number;
    expected: number;
}

/** Sample one Bernoulli survival outcome per layer from a seeded generator. */
export function stochasticDepthSample(probabilities: number[], seed: number): DepthSample {
    const rand = mulberry32(seed);
    const active = probabilities.map((p) => rand() < Math.max(0, Math.min(1, p)));
    return {
        active,
        depth: active.filter(Boolean).length,
        expected: expectedDepth(probabilities),
    };
}

/** Linearly ramp survival probabilities from an initial value to one. */
export function survivalSchedule(layers: number, initialProbability: number): number[] {
    return Array.from({ length: Math.max(0, layers) }, (_, i) =>
        layers <= 1 ? 1 : initialProbability + ((1 - initialProbability) * i) / (layers - 1),
    );
}

function makeBars(probabilities: number[], active: boolean[]): VisualEntity[] {
    return probabilities.map((p, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: `L${i}: p=${p.toFixed(2)}${active[i] ? " on" : " off"}`,
        value: p,
        state: (active[i] ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, active: Boolean(active[i]) },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            layers?: number;
            initialProbability?: number;
            probabilities?: number[];
            trials?: number;
            seed?: number;
        } | null
    ) ?? {};
    const layers = typeof task.layers === "number" ? Math.max(1, Math.floor(task.layers)) : 8;
    const initialProbability =
        typeof task.initialProbability === "number" ? task.initialProbability : 0.5;
    const probabilities: number[] =
        Array.isArray(task.probabilities) && task.probabilities.length > 0
            ? task.probabilities
            : survivalSchedule(layers, initialProbability);
    const trials = typeof task.trials === "number" ? Math.max(1, Math.floor(task.trials)) : 6;
    const baseSeed = typeof task.seed === "number" ? task.seed : 3;
    const expected = expectedDepth(probabilities);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(probabilities, probabilities.map(() => true)),
        edges: [],
        description: `Stochastic depth over ${probabilities.length} layers with expected active depth ${expected.toFixed(2)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { trial: 0, expected, depth: probabilities.length },
    };
    step += 1;

    for (let t = 0; t < trials; t += 1) {
        const sample = stochasticDepthSample(probabilities, baseSeed + t);
        yield {
            stepNumber: step,
            entities: makeBars(probabilities, sample.active),
            edges: [],
            description: `Trial ${t + 1}: ${sample.depth} of ${probabilities.length} layers survive, expected ${expected.toFixed(2)}; skipped layers are shown dimmed.`,
            codeLineNumber: sample.depth >= expected ? 2 : 3,
            layout: "array",
            meta: { trial: t + 1, expected, depth: sample.depth, active: sample.active.map((a) => (a ? 1 : 0)) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, probabilities.map(() => true)),
        edges: [],
        description: `At inference all layers are active with their expected scale; expected depth is ${expected.toFixed(2)} of ${probabilities.length} layers.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { converged: true, expected, depth: probabilities.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Very deep networks can be hard to train because gradients must pass through every layer. Stochastic depth removes whole layers at random during training, so a given example flows through a shorter network. Different examples see different subnetworks, which acts like training an ensemble and lets gradients reach early layers more directly.",
        invariants: [
            "Each layer is skipped independently according to its own survival probability.",
            "The expected number of active layers is the sum of the survival probabilities.",
            "At inference every layer is active, scaled by its expected contribution.",
        ],
        correctness:
            "A Bernoulli draw per layer with parameter p has expected value p, so linearity of expectation makes the mean active depth equal to the sum of the probabilities. The tests confirm this with a large Monte Carlo sample, check the boundary cases where all probabilities are zero or one, and verify the linear schedule endpoints. Every frame stores the sampled flags so the visualization matches the computation.",
        complexityRationale:
            "Sampling one uniform number and comparing it to a probability per layer costs O(layers) per trial. Only the probability vector and the current active flags are stored, using O(layers) space.",
        uses: [
            "Training very deep residual networks",
            "Implicit ensembling of many subnetworks",
            "Regularizing models when labeled data is scarce",
        ],
        references: [
            "Huang et al., Deep Networks with Stochastic Depth, ECCV 2016",
            "Srivastava et al., Dropout: A Simple Way to Prevent Neural Networks from Overfitting, JMLR 2014",
        ],
        workedExample:
            "With four layers and survival probabilities (1, 0.8, 0.6, 0.4), the expected active depth is 2.8. A trial might skip layers three and four, training a two-layer subnetwork, while another trial keeps all but the second layer.",
    },
    id: "stochastic-depth",
    name: "Stochastic Depth",
    category: "ml-ai",
    complexity: { time: "O(trials * layers)", space: "O(layers)" },
    defaultInput: { layers: 8, initialProbability: 0.5, trials: 6, seed: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "assign a survival probability to each layer",
        "for each training trial",
        "draw a uniform random number for each layer",
        "keep the layer when the draw is below its survival probability, otherwise skip it",
        "train the remaining subnetwork on the current example",
        "done: use all layers at inference with expected scaling",
    ],
};

export default module;
