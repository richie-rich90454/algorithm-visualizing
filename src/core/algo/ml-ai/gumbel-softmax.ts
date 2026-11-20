/**
 * gumbel-softmax.ts - The Gumbel-Softmax (Concrete) Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gumbel-Softmax provides a differentiable way to draw a categorical sample.
 * Adding Gumbel noise to the logits and applying a temperature-controlled
 * softmax yields a continuous vector that approaches a one-hot sample as the
 * temperature falls. This demo accepts explicit uniform draws so the result is
 * fully reproducible and can be checked against a direct computation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k categories
 *   Space: O(k) for the perturbed logits and probabilities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per category showing the perturbed logits, then the sample
 *     probabilities. The chosen category is highlighted.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    logits?: number[];
    uniforms?: number[];
    temperature?: number;
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

function gumbel(u: number): number {
    const clamped = Math.min(1 - 1e-12, Math.max(1e-12, u));
    return -Math.log(-Math.log(clamped));
}

function softmax(values: number[]): number[] {
    const max = values.length > 0 ? Math.max(...values) : 0;
    const exps = values.map((v) => Math.exp(v - max));
    const sum = exps.reduce((a, v) => a + v, 0);
    return exps.map((v) => (sum === 0 ? 0 : v / sum));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const logits = (task.logits ?? [1, 2, 0.5]).slice();
    const uniforms = (task.uniforms ?? [0.2, 0.5, 0.9]).slice();
    const tau = typeof task.temperature === "number" && task.temperature > 0 ? task.temperature : 1;
    const k = logits.length;
    const perturbed = logits.map((l, i) => l + gumbel(uniforms[i] ?? 0.5));
    const probs = softmax(perturbed.map((v) => v / tau));
    let chosen = 0;
    for (let i = 1; i < probs.length; i += 1) {
        if ((probs[i] ?? 0) > (probs[chosen] ?? 0)) chosen = i;
    }
    const state = (s: EntityState): EntityState[] => new Array<EntityState>(k).fill(s);
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(logits, state("idle"), logits.map((v) => v.toFixed(3))),
        edges: [],
        description: `Gumbel-Softmax over ${k} categories at temperature ${tau.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { k, temperature: tau, logits },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(uniforms, state("comparing"), uniforms.map((v) => v.toFixed(3))),
        edges: [],
        description: "Draw one uniform per category and transform it into Gumbel noise.",
        codeLineNumber: 1,
        layout: "array",
        meta: { k, temperature: tau, uniforms },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(perturbed, state("active"), perturbed.map((v) => v.toFixed(3))),
        edges: [],
        description: "Add the Gumbel noise to each logit, then divide by the temperature.",
        codeLineNumber: 2,
        layout: "array",
        meta: { k, temperature: tau, perturbed },
    };
    step += 1;

    const finalStates = probs.map((_, i) => (i === chosen ? "sorted" : "visited")) as EntityState[];
    yield {
        stepNumber: step,
        entities: bars(probs, finalStates, probs.map((v) => v.toFixed(3))),
        edges: [],
        description: `Sample probabilities sum to ${probs.reduce((a, v) => a + v, 0).toFixed(4)}; category ${chosen} is the relaxed one-hot draw.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { k, temperature: tau, probs, chosen, gumbelNoise: perturbed.map((v, i) => v - (logits[i] ?? 0)) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Sampling a category is not differentiable, which blocks backpropagation through discrete choices. Gumbel-Softmax replaces the hard draw with a smooth one: inject Gumbel noise into the logits and run a softmax whose temperature controls how close the output is to a one-hot vector. Gradients can flow through the soft sample during training.",
        invariants: [
            "The probabilities are nonnegative and sum to one.",
            "As the temperature approaches zero the output approaches a one-hot vector at the largest perturbed logit.",
            "Identical uniform draws always produce identical samples, so the demo is reproducible.",
        ],
        correctness:
            "The Gumbel-max identity states that choosing the largest of logits plus independent Gumbel noises samples the categorical distribution with probabilities given by the softmax of the logits. Replacing the hard maximum by a softmax of the same perturbed values keeps that limiting behavior while making the sample a differentiable function of the logits, so the relaxed vector is a valid reparameterized categorical draw.",
        complexityRationale:
            "Generating noise, perturbing logits, and normalizing the softmax each touch all k categories once, giving O(k) time and O(k) space for the intermediate perturbed logits and probabilities.",
        uses: [
            "Differentiable selection of discrete latent variables in VAEs",
            "Relaxed categorical policies in reinforcement learning",
            "Differentiable architecture and token selection in neural networks",
        ],
        references: [
            "Jang, Gu, and Poole, Categorical Reparameterization with Gumbel-Softmax, ICLR 2017",
            "Maddison, Mnih, and Teh, The Concrete Distribution, ICLR 2017",
        ],
        workedExample:
            "With logits 1, 2, 0.5 and uniforms 0.2, 0.5, 0.9, the Gumbel noises are about 0.43, 0.37, and 2.25. Adding them gives perturbed logits near 1.43, 2.37, and 2.75. At temperature 1 the softmax assigns the largest probability to the third category, yielding a relaxed sample close to one-hot there.",
    },
    id: "gumbel-softmax",
    name: "Gumbel-Softmax",
    category: "ml-ai",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { logits: [1, 2, 0.5], uniforms: [0.2, 0.5, 0.9], temperature: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "read the category logits, uniform draws, and temperature",
        "transform each uniform draw into Gumbel noise",
        "add Gumbel noise to each logit and divide by the temperature",
        "apply softmax to obtain the relaxed sample probabilities",
        "select the largest probability as the hard category",
        "done: emit probabilities and the chosen category",
    ],
};

export default module;
