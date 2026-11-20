/**
 * top-k-sampling.ts - Top-k Truncated Sampling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Top-k sampling keeps only the k logits with the largest values, converts
 * those to a probability distribution with a softmax, and draws one token from
 * it. Tokens outside the top k get zero probability, which removes the long
 * tail of unlikely words while preserving randomness among the plausible ones.
 * A seeded generator makes the draw reproducible for visualization.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) to rank n logits, or O(n) with a selection step
 *   Space: O(n) for the probability array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the logits, then the truncated distribution.
 *   - The sampled token is highlighted in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SamplingInput {
    logits?: number[];
    k?: number;
    seed?: number;
}

/** A small deterministic linear congruential uniform generator. */
export function uniform(seed: number): number {
    const state = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
}

/** Truncate logits to the top k and return the renormalized distribution. */
export function topKDistribution(logits: number[], k: number) {
    const n = logits.length;
    const limit = Math.max(1, Math.min(n, Math.floor(k)));
    const ranked = logits
        .map((value, index) => ({ value, index }))
        .sort((a, b) => b.value - a.value || a.index - b.index);
    const kept = new Set(ranked.slice(0, limit).map((item) => item.index));
    const probability: number[] = new Array(n).fill(0);
    const maxKept = Math.max(...ranked.slice(0, limit).map((item) => item.value));
    const weights = logits.map((value, index) => (kept.has(index) ? Math.exp(value - maxKept) : 0));
    const total = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i += 1) probability[i] = total === 0 ? 0 : (weights[i] ?? 0) / total;
    return { kept, probability, limit };
}

/** Draw a token index from a distribution using a seeded uniform. */
export function sample(probability: number[], seed: number): number {
    const u = uniform(seed);
    let cumulative = 0;
    for (let i = 0; i < probability.length; i += 1) {
        cumulative += probability[i] ?? 0;
        if (u < cumulative) return i;
    }
    return probability.length - 1;
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
    const logits: number[] = task.logits ?? [2, 1, 0.5, 0.1, -1, -2];
    const k = typeof task.k === "number" && task.k > 0 ? Math.floor(task.k) : 3;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const { kept, probability, limit } = topKDistribution(logits, k);
    const drawn = sample(probability, seed);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(logits, logits.map(() => "idle")),
        edges: [],
        description: `Keep only the ${limit} largest of ${logits.length} logits before sampling.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "logits", k: limit, seed, logits, kept: [...kept], probability: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(
            logits,
            logits.map((_, i) => (kept.has(i) ? "sorted" : "error")),
        ),
        edges: [],
        description: "Discard every logit outside the top k by assigning it zero probability.",
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "truncate", k: limit, seed, logits, kept: [...kept], probability: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(probability, probability.map((_, i) => (kept.has(i) ? "comparing" : "error"))),
        edges: [],
        description: "Apply a softmax over the surviving logits to obtain a valid distribution.",
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "softmax", k: limit, seed, logits, kept: [...kept], probability },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(probability, probability.map((_, i) => (i === drawn ? "active" : kept.has(i) ? "sorted" : "error"))),
        edges: [],
        description: `Done: the seeded draw selected token ${drawn} from the top-${limit} distribution.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { phase: "done", k: limit, seed, logits, kept: [...kept], probability, drawn, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Pure sampling can pick a very unlikely token and derail a sentence. Top-k sampling first throws away all but the k most likely next tokens, then samples only among those. The result keeps the creativity of random choice while avoiding the long tail of poor options, and k controls how adventurous the output is.",
        invariants: [
            "Every token outside the top k has probability exactly zero.",
            "The surviving probabilities are nonnegative and sum to one.",
            "A fixed seed always selects the same token.",
        ],
        correctness:
            "Ranking the logits and taking the first k indices yields exactly the k largest values, with ties broken by index. The softmax subtracts the largest kept logit before exponentiating, which prevents overflow and does not change the ratios, so dividing by the sum gives a proper distribution. Walking the cumulative distribution with a uniform draw in [0,1) returns a token with probability equal to its mass, and a fixed seed reproduces the same uniform every time.",
        complexityRationale:
            "Sorting the n logits costs O(n log n) and the softmax and cumulative scan each cost O(n). Storing the probability array and kept set uses O(n) space.",
        uses: [
            "Controlled randomness in language model decoding",
            "Reducing nonsensical low-probability tokens in generated text",
            "A tunable alternative to greedy decoding and beam search",
        ],
        references: [
            "Fan et al., Hierarchical Neural Story Generation, ACL 2018",
            "Holtzman et al., Curious Case of Neural Text Degeneration, ICLR 2020",
        ],
        workedExample:
            "For logits 2, 1, 0.5, 0.1, negative 1, negative 2 with k three, the kept tokens are the first three. Their softmax weights are exp of the differences from 2, which after normalization give roughly 0.67, 0.25 and 0.08. A seeded uniform of 0.5 falls in the first token's interval, so token zero is selected.",
    },
    id: "top-k-sampling",
    name: "Top-k Sampling",
    category: "ml-ai",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { logits: [2, 1, 0.5, 0.1, -1, -2], k: 3, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "read the logits, the cutoff k and a random seed",
        "rank the logits from largest to smallest",
        "mark the top k tokens as the only survivors",
        "subtract the largest surviving logit and exponentiate",
        "divide by the total to get the sampling distribution",
        "draw a uniform number and walk the cumulative distribution",
        "done: report the selected token",
    ],
};

export default module;
