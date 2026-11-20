/**
 * nucleus-sampling.ts - Nucleus (Top-p) Sampling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Nucleus sampling keeps the smallest set of highest-probability tokens whose
 * combined probability reaches a threshold p, then renormalizes and samples
 * from that set. Unlike a fixed top k, the number of candidates adapts to how
 * peaked the distribution is, so a confident model draws from a short list and
 * an uncertain one draws from a longer list.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) to sort n logits
 *   Space: O(n) for the ranked list and probability array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the softmax probabilities with the cumulative cutoff marked.
 *   - The sampled token is highlighted in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface NucleusInput {
    logits?: number[];
    p?: number;
    seed?: number;
}

/** A small deterministic linear congruential uniform generator. */
export function uniform(seed: number): number {
    const state = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
}

/** Draw an index from a probability array using a seeded uniform sample. */
export function sample(probability: number[], seed: number): number {
    const u = uniform(seed);
    let cumulative = 0;
    for (let i = 0; i < probability.length; i += 1) {
        cumulative += probability[i] ?? 0;
        if (u < cumulative) return i;
    }
    for (let i = probability.length - 1; i >= 0; i -= 1) {
        if ((probability[i] ?? 0) > 0) return i;
    }
    return 0;
}

/** Build the nucleus, its renormalized distribution, and the cutoff mass. */
export function nucleusDistribution(logits: number[], p: number) {
    const n = logits.length;
    const max = Math.max(...logits);
    const raw = logits.map((v) => Math.exp(v - max));
    const sum = raw.reduce((a, b) => a + b, 0);
    const base = raw.map((v) => (sum === 0 ? 0 : v / sum));
    const ranked = base
        .map((value, index) => ({ value, index }))
        .sort((a, b) => b.value - a.value || a.index - b.index);
    const target = Math.max(0, Math.min(1, p));
    let cumulative = 0;
    let size = 0;
    for (const item of ranked) {
        cumulative += item.value;
        size += 1;
        if (cumulative >= target) break;
    }
    const kept = new Set(ranked.slice(0, size).map((item) => item.index));
    const nucleusMass = ranked.slice(0, size).reduce((acc, item) => acc + item.value, 0);
    const probability = base.map((value, index) =>
        kept.has(index) && nucleusMass > 0 ? value / nucleusMass : 0,
    );
    return { base, kept, probability, size, cumulative, target };
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
    const task = (input as NucleusInput | null) ?? {};
    const logits: number[] = task.logits ?? [2, 1.5, 0.8, 0.3, -0.5, -1.5, -2.5];
    const p = typeof task.p === "number" && task.p > 0 && task.p <= 1 ? task.p : 0.9;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const { base, kept, probability, size, cumulative } = nucleusDistribution(logits, p);
    const drawn = sample(probability, seed);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(base, base.map(() => "idle")),
        edges: [],
        description: `Sort ${logits.length} softmax probabilities and keep the smallest nucleus reaching mass ${p}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "softmax", p, seed, base, kept: [...kept], probability: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(base, base.map((_, i) => (kept.has(i) ? "comparing" : "error"))),
        edges: [],
        description: `The smallest ${size} tokens reach cumulative mass ${cumulative.toFixed(3)}; the rest are discarded.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "nucleus", p, seed, base, kept: [...kept], size, cumulative, probability: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(probability, probability.map((_, i) => (kept.has(i) ? "sorted" : "error"))),
        edges: [],
        description: "Renormalize the surviving probabilities so they form a distribution again.",
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "renormalize", p, seed, base, kept: [...kept], probability },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(probability, probability.map((_, i) => (i === drawn ? "active" : kept.has(i) ? "sorted" : "error"))),
        edges: [],
        description: `Done: the seeded draw selected token ${drawn} from the ${size}-token nucleus.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { phase: "done", p, seed, base, kept: [...kept], probability, drawn, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A fixed top-k cutoff may keep too many dull tokens for a confident model or too few for an uncertain one. Nucleus sampling instead adds probabilities from the most likely token downward until their total reaches a threshold such as 0.9, and samples only from that group. The candidate list therefore shrinks when the model is sure and grows when it is not.",
        invariants: [
            "The nucleus is the smallest ranked prefix whose mass reaches the threshold.",
            "Tokens outside the nucleus have probability exactly zero.",
            "The renormalized probabilities of the nucleus sum to one.",
        ],
        correctness:
            "The softmax is computed stably by subtracting the maximum logit. Sorting by probability and walking the cumulative sum identifies the shortest prefix reaching p, so the nucleus is minimal by construction. Dividing each retained probability by the nucleus mass leaves a valid distribution on exactly those tokens, and the seeded cumulative draw selects an index with probability equal to its renormalized mass.",
        complexityRationale:
            "Forming the softmax costs O(n), sorting costs O(n log n), and the cumulative walk costs O(n). The ranked list and probability array use O(n) space.",
        uses: [
            "Adaptive randomness in language model generation",
            "Avoiding both repetitive and incoherent text",
            "A standard decoding setting in modern text generation",
        ],
        references: [
            "Holtzman et al., The Curious Case of Neural Text Degeneration, ICLR 2020",
            "Fan et al., Hierarchical Neural Story Generation, ACL 2018",
        ],
        workedExample:
            "If softmax gives probabilities 0.6, 0.25, 0.1, 0.04 and 0.01 with p set to 0.9, the cumulative sums are 0.6, 0.85 and 0.95. The smallest nucleus reaching 0.9 has three tokens; their probabilities are divided by 0.95 so they sum to one, and the remaining two tokens get zero mass.",
    },
    id: "nucleus-sampling",
    name: "Nucleus Sampling",
    category: "ml-ai",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { logits: [2, 1.5, 0.8, 0.3, -0.5, -1.5, -2.5], p: 0.9, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "read the logits, the nucleus mass p and a random seed",
        "convert the logits into a stable softmax distribution",
        "rank the tokens from largest to smallest probability",
        "add probabilities until the cumulative mass reaches p",
        "mark that prefix as the nucleus and discard the rest",
        "divide the retained probabilities by their total",
        "draw a seeded sample and report the selected token",
    ],
};

export default module;
