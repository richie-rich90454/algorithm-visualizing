/**
 * temperature-sampling.ts - Temperature Scaled Sampling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Temperature sampling divides every logit by a positive temperature before
 * applying a softmax. A temperature below one sharpens the distribution toward
 * the most likely token; a temperature above one flattens it toward uniform.
 * A seeded uniform draw then selects one token, which makes the demo replayable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for the scaling, softmax and cumulative draw
 *   Space: O(n) for the scaled logits and probability array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars start as raw logits, then show scaled logits, then probabilities.
 *   - The selected token is highlighted in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SamplingInput {
    logits?: number[];
    temperature?: number;
    seed?: number;
}

/** Deterministic linear congruential uniform in [0, 1). */
function uniform(seed: number): number {
    const state = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
}

/** Numerically stable softmax. */
function softmax(values: number[]): number[] {
    if (values.length === 0) return [];
    const max = Math.max(...values);
    const exps = values.map((value) => Math.exp(value - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    return exps.map((value) => (total === 0 ? 0 : value / total));
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `tok-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SamplingInput | null) ?? {};
    const logits: number[] =
        Array.isArray(task.logits) && task.logits.length > 0
            ? task.logits
            : [2, 1, 0.5, 0.1, -1, -2];
    const temperature = typeof task.temperature === "number" && task.temperature > 0 ? task.temperature : 1;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;

    const scaled = logits.map((value) => value / temperature);
    const probability = softmax(scaled);
    const draw = uniform(seed);
    let cumulative = 0;
    let drawn = probability.length - 1;
    for (let i = 0; i < probability.length; i += 1) {
        cumulative += probability[i] ?? 0;
        if (draw < cumulative) {
            drawn = i;
            break;
        }
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(logits, logits.map(() => "idle")),
        edges: [],
        description: `Read ${logits.length} logits with temperature ${temperature}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "logits", logits, temperature, seed, scaled: [], probability: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(scaled, scaled.map(() => "comparing")),
        edges: [],
        description: `Divide every logit by ${temperature} to rescale the logits.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "scale", logits, temperature, seed, scaled, probability: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(probability, probability.map(() => "sorted")),
        edges: [],
        description: "Exponentiate after subtracting the maximum and normalize to a distribution.",
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "softmax", logits, temperature, seed, scaled, probability },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(probability, probability.map((_, i) => (i === drawn ? "active" : "sorted"))),
        edges: [],
        description: `Done: seeded draw ${draw.toFixed(4)} selected token ${drawn}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { phase: "done", logits, temperature, seed, scaled, probability, draw, drawn },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A language model produces a score for every possible next token. Temperature divides those scores by a single number before turning them into probabilities. A low temperature makes the model nearly greedy and repetitive; a high temperature flattens the distribution and makes surprising tokens more likely. The rest of the sampler is unchanged.",
        invariants: [
            "Temperature is strictly positive and the same value scales every logit.",
            "Subtracting the maximum before exponentiating leaves the probability ratios unchanged.",
            "The probabilities are nonnegative and sum to one for any positive temperature.",
        ],
        correctness:
            "Dividing every logit by the same positive constant preserves their ordering, so the argmax is unchanged. The stable softmax subtracts the largest scaled logit before exponentiating, which only multiplies every exponential by the same factor and cancels during normalization; the result is therefore identical to the textbook softmax and sums to one. Walking the cumulative distribution with a uniform draw in [0,1) returns token i with probability exactly equal to its probability mass, and a fixed seed reproduces the same draw.",
        complexityRationale:
            "Scaling, exponentiating, summing and the cumulative scan each touch the n tokens once, so the time is O(n). The scaled values and probabilities each require an array of length n, giving O(n) space.",
        uses: [
            "Tuning creativity in language model text generation",
            "Making sampling nearly deterministic with a low temperature",
            "Producing diverse candidate continuations for creative writing tools",
        ],
        references: [
            "Ackley, Hinton and Sejnowski, A Learning Algorithm for Boltzmann Machines, 1985",
            "Holtzman et al., The Curious Case of Neural Text Degeneration, ICLR 2020",
        ],
        workedExample:
            "For logits 2, 1 and 0 with temperature 2, the scaled values are 1, 0.5 and 0. Their exponentials are about 2.72, 1.65 and 1, so after dividing by the total of 5.37 the probabilities are roughly 0.51, 0.31 and 0.19. At temperature 1 the same logits give roughly 0.67, 0.25 and 0.09, showing how a higher temperature flattens the distribution.",
    },
    id: "temperature-sampling",
    name: "Temperature Sampling",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { logits: [2, 1, 0.5, 0.1, -1, -2], temperature: 0.8, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "read the logits, a positive temperature and a random seed",
        "divide each logit by the temperature",
        "subtract the largest scaled logit and exponentiate",
        "divide by the total to form a probability distribution",
        "draw a uniform number and walk the cumulative distribution",
        "select the token whose interval contains the draw",
        "done: report the chosen token",
    ],
};

export default module;
