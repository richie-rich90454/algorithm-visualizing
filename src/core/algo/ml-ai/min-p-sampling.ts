/**
 * min-p-sampling.ts - Min-p Sampling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Min-p sampling truncates the model distribution by an absolute threshold
 * that scales with the most likely token: keep every token whose probability
 * is at least p_base times the maximum probability, then renormalize. Unlike
 * top-k (a fixed count) or nucleus sampling (a fixed cumulative mass), the
 * cutoff adapts to how peaked the distribution is.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for softmax, threshold and renormalization
 *   Space: O(n) for the probability array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the model probabilities, then the truncated distribution.
 *   - Kept tokens are green; discarded tokens are red.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SamplingInput {
    logits?: number[];
    pBase?: number;
    seed?: number;
}

/** Deterministic linear congruential uniform generator in [0, 1). */
export function uniform(seed: number): number {
    const state = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
}

/** Numerically stable softmax of a logit array. */
export function softmax(logits: number[]): number[] {
    if (logits.length === 0) return [];
    const max = Math.max(...logits);
    const exps = logits.map((value) => Math.exp(value - max));
    const total = exps.reduce((a, b) => a + b, 0);
    return total === 0 ? exps.map(() => 0) : exps.map((value) => value / total);
}

/**
 * Keep tokens whose probability is at least pBase times the maximum
 * probability, then renormalize. Returns the truncated distribution and the
 * absolute cutoff used.
 */
export function minPDistribution(logits: number[], pBase: number) {
    const base = Math.max(0, Math.min(1, pBase));
    const probability = softmax(logits);
    const pMax = probability.length === 0 ? 0 : Math.max(...probability);
    const cutoff = base * pMax;
    const kept = new Set<number>();
    for (let i = 0; i < probability.length; i += 1) {
        if ((probability[i] ?? 0) >= cutoff) kept.add(i);
    }
    // The most likely token always survives, so the kept set is never empty.
    if (kept.size === 0 && probability.length > 0) kept.add(probability.indexOf(pMax));
    const total = [...kept].reduce((sum, i) => sum + (probability[i] ?? 0), 0);
    const truncated = probability.map((value, i) => (kept.has(i) && total > 0 ? value / total : 0));
    return { probability, truncated, kept, cutoff, pMax, base };
}

/** Draw a token index from a distribution with a seeded uniform. */
export function sample(probability: number[], seed: number): number {
    const u = uniform(seed);
    let cumulative = 0;
    for (let i = 0; i < probability.length; i += 1) {
        cumulative += probability[i] ?? 0;
        if (u < cumulative) return i;
    }
    return Math.max(0, probability.length - 1);
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `tok-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
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
    const pBase = typeof task.pBase === "number" ? task.pBase : 0.2;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const { probability, truncated, kept, cutoff, pMax } = minPDistribution(logits, pBase);
    const drawn = sample(truncated, seed);
    const keptList = [...kept];

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(probability, probability.map(() => "idle")),
        edges: [],
        description: `Convert ${logits.length} logits into a probability distribution with softmax.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "softmax", pBase, seed, probability, truncated: [], kept: keptList, cutoff, pMax },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(
            probability,
            probability.map((_, i) => (kept.has(i) ? "comparing" : "error")),
        ),
        edges: [],
        description: `Cutoff is ${cutoff.toFixed(4)} = ${pBase} times the max probability ${pMax.toFixed(4)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "threshold", pBase, seed, probability, truncated: [], kept: keptList, cutoff, pMax },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(
            truncated,
            truncated.map((_, i) => (kept.has(i) ? "sorted" : "error")),
        ),
        edges: [],
        description: "Discard tokens below the cutoff and renormalize the survivors.",
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "truncate", pBase, seed, probability, truncated, kept: keptList, cutoff, pMax },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(
            truncated,
            truncated.map((_, i) => (i === drawn ? "active" : kept.has(i) ? "sorted" : "error")),
        ),
        edges: [],
        description: `Done: seeded draw selected token ${drawn} from the min-p distribution.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "done", pBase, seed, probability, truncated, kept: keptList, cutoff, pMax, drawn },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Min-p sampling adapts the truncation cutoff to the confidence of the model. The threshold is a fixed fraction of the most likely token's probability, so a peaked distribution keeps only a few tokens while a flat one keeps many. This avoids the rigid token count of top-k and the variable tail of nucleus sampling.",
        invariants: [
            "The cutoff equals p_base multiplied by the maximum probability.",
            "Every kept token has probability at least the cutoff before renormalization.",
            "The truncated probabilities are nonnegative and sum to one.",
        ],
        correctness:
            "Softmax subtracts the largest logit before exponentiating, which preserves ratios and prevents overflow, then divides by the total to give a proper distribution. Selecting indices with probability at least the cutoff produces exactly the adaptive survivor set, and the most likely token is always retained so the set is nonempty. Dividing each survivor by their total mass renormalizes to one, and walking the cumulative distribution with a fixed seeded uniform returns a survivor with probability equal to its mass.",
        complexityRationale:
            "Computing the softmax, scanning for the cutoff and renormalizing are each linear in the vocabulary size n. Only the probability and truncated arrays are stored, giving O(n) space.",
        uses: [
            "Adaptive token filtering in language model decoding",
            "Balancing diversity and coherence in open-ended text generation",
            "A cutoff that behaves consistently across sharp and flat distributions",
        ],
        references: [
            "Nguyen et al., Min P Sampling: Balancing Creativity and Coherence at High Temperature, 2024",
            "Holtzman et al., The Curious Case of Neural Text Degeneration, ICLR 2020",
        ],
        workedExample:
            "For logits 2, 1, 0.5, 0.1 with p-base 0.5, softmax gives roughly 0.52, 0.19, 0.11, 0.07 and a maximum of 0.52, so the cutoff is 0.26. Only the first token survives and renormalizes to probability one; any seed therefore selects token zero.",
    },
    id: "min-p-sampling",
    name: "Min-p Sampling",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { logits: [2, 1, 0.5, 0.1, -1, -2], pBase: 0.2, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "read the logits, the base fraction p and a random seed",
        "compute the softmax probabilities of all tokens",
        "set the cutoff to p times the maximum probability",
        "keep every token whose probability reaches the cutoff",
        "divide the kept probabilities by their total to renormalize",
        "draw a uniform number and walk the cumulative distribution",
        "done: report the selected token",
    ],
};

export default module;
