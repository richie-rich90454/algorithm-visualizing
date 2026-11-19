/**
 * straight-through-estimator.ts - The Straight-Through Estimator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The straight-through estimator trains networks that contain rounding or
 * thresholding operations. The forward pass applies the hard, nondifferentiable
 * function, but the backward pass pretends that function was the identity and
 * passes the upstream gradient through unchanged. This demo shows the hard
 * forward values and the surrogate gradients that would be propagated.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n values
 *   Space: O(n) for the hard values and gradients
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per value: raw input, hard binary output, and passed gradient.
 *   - A bar is green when its hard output is one and idle when zero.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    values?: number[];
    threshold?: number;
    upstream?: number[];
}

function bars(values: number[], states: EntityState[], labels?: string[]): VisualEntity[] {
    return values.map((v, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: labels?.[i] ?? v.toFixed(3),
        value: v,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value: v },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const values = (task.values ?? [-1.2, 0.3, 2.5, -0.7]).slice();
    const threshold = typeof task.threshold === "number" ? task.threshold : 0;
    const upstream = (task.upstream ?? [0.1, -0.2, 0.3, 0.4]).slice();
    const n = values.length;
    const at = (a: number[], i: number): number => a[i] ?? 0;
    const hard = values.map((v) => (v >= threshold ? 1 : 0));
    const surrogate = values.map((_, i) => at(upstream, i));
    const states = hard.map((h) => (h === 1 ? "sorted" : "idle")) as EntityState[];
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(values, new Array<EntityState>(n).fill("idle"), values.map((v) => v.toFixed(3))),
        edges: [],
        description: `Straight-through estimator on ${n} values with threshold ${threshold}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, threshold, values },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(hard, states, hard.map((h) => String(h))),
        edges: [],
        description: "Forward pass: a value at or above the threshold becomes one, otherwise zero.",
        codeLineNumber: 1,
        layout: "array",
        meta: { n, threshold, hard },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(upstream, new Array<EntityState>(n).fill("comparing"), upstream.map((v) => v.toFixed(3))),
        edges: [],
        description: "The upstream gradient arrives at the nondifferentiable threshold operation.",
        codeLineNumber: 2,
        layout: "array",
        meta: { n, threshold, upstream },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(surrogate, states, surrogate.map((v) => v.toFixed(3))),
        edges: [],
        description: "Backward pass: pass the upstream gradient through unchanged as if the threshold were the identity.",
        codeLineNumber: 3,
        layout: "array",
        meta: { n, threshold, hard, upstream, surrogate, trueGradient: new Array<number>(n).fill(0) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rounding a number is useful but has zero slope almost everywhere, so ordinary backpropagation cannot teach a network that rounds. The straight-through estimator keeps the hard rounded value for the forward pass, then deliberately lies in the backward pass by treating rounding as the identity. The network receives a usable gradient even though the true mathematical derivative is zero.",
        invariants: [
            "The forward output is always exactly zero or one under a unit step.",
            "The surrogate gradient equals the upstream gradient element for element.",
            "The true derivative of the step function is zero away from the threshold.",
        ],
        correctness:
            "The estimator is a deliberate bias rather than an exact derivative. It is justified because it supplies a gradient with the correct sign that pushes the pre-threshold value toward crossing the threshold when that would reduce the loss. In expectation over randomized variants it is an unbiased estimator of the gradient of a smoothed objective, which is why it trains quantized and discretized networks effectively in practice.",
        complexityRationale:
            "Thresholding n values and copying n upstream gradients are both linear scans, giving O(n) time. Storing the hard outputs and the surrogate gradient vector uses O(n) space.",
        uses: [
            "Training neural networks with binary or quantized weights",
            "Learning discrete latent codes in autoencoders",
            "Differentiable approximations inside stochastic computational graphs",
        ],
        references: [
            "Hinton, Lecture 10b: The Straight-Through Estimator, Coursera, 2012",
            "Bengio, Leonard, and Courville, Estimating or Propagating Gradients Through Stochastic Neurons, 2013",
        ],
        workedExample:
            "For a pre-threshold value of 2.5 with threshold 0 and upstream gradient 0.3, the forward output is 1. The true slope of the step is 0, but the straight-through rule passes 0.3 backward unchanged, so a gradient step nudges the underlying value in the direction that reduces the loss.",
    },
    id: "straight-through-estimator",
    name: "Straight-Through Estimator",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [-1.2, 0.3, 2.5, -0.7], threshold: 0, upstream: [0.1, -0.2, 0.3, 0.4] },
    visualType: "array",
    run,
    pseudocode: [
        "read the pre-threshold values, the threshold, and upstream gradients",
        "forward: output one when a value meets the threshold, else zero",
        "receive the upstream gradient for each value",
        "backward: pass the upstream gradient through as the identity",
        "ignore the true zero slope of the hard step function",
        "done: emit hard values and the surrogate gradients",
    ],
};

export default module;
