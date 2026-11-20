/**
 * contrastive-search.ts - Contrastive Search Decoding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Contrastive search scores each candidate token by a blend of model
 * confidence and dissimilarity from the already generated context. A token
 * that is likely yet not repetitive wins, which reduces the degenerate loops
 * that pure likelihood maximization tends to produce.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * k * d) for m context vectors, k candidates, dimension d
 *   Space: O(k) for the candidate score array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the final contrastive score of each candidate token.
 *   - The selected candidate is highlighted in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ContrastiveInput {
    context?: number[][];
    candidates?: number[][];
    logits?: number[];
    alpha?: number;
}

/** Cosine similarity of two equal-length vectors. */
export function cosine(a: number[], b: number[]): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
        dot += (a[i] ?? 0) * (b[i] ?? 0);
        na += (a[i] ?? 0) ** 2;
        nb += (b[i] ?? 0) ** 2;
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Score every candidate as (1 - alpha) * maximum context similarity plus
 * alpha * model probability. Higher is better; ties break to the lower index.
 */
export function contrastiveScores(
    context: number[][],
    candidates: number[][],
    logits: number[],
    alpha: number,
) {
    const a = Math.max(0, Math.min(1, alpha));
    const maxLogit = logits.length === 0 ? 0 : Math.max(...logits);
    const exps = logits.map((value) => Math.exp(value - maxLogit));
    const total = exps.reduce((s, v) => s + v, 0);
    const probs = exps.map((v) => (total === 0 ? 0 : v / total));
    const scores = candidates.map((candidate, k) => {
        let maxSim = 0;
        for (const hidden of context) maxSim = Math.max(maxSim, cosine(hidden, candidate));
        return (1 - a) * maxSim + a * (probs[k] ?? 0);
    });
    return { scores, probs, alpha: a };
}

/** Index of the largest value, breaking ties toward the lower index. */
export function argmax(values: number[]): number {
    let best = 0;
    for (let i = 1; i < values.length; i += 1) {
        if ((values[i] ?? -Infinity) > (values[best] ?? -Infinity)) best = i;
    }
    return best;
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `cand-${index}`,
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
    const task = (input as ContrastiveInput | null) ?? {};
    const context: number[][] = task.context ?? [[1, 0], [0.9, 0.1]];
    const candidates: number[][] = task.candidates ?? [
        [1, 0],
        [0.95, 0.05],
        [0, 1],
        [-1, 0.2],
    ];
    const logits: number[] = task.logits ?? [3, 2.5, 2, 1];
    const alpha = typeof task.alpha === "number" ? task.alpha : 0.6;
    const { scores, probs } = contrastiveScores(context, candidates, logits, alpha);
    const chosen = argmax(scores);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(logits, logits.map(() => "idle")),
        edges: [],
        description: `Score ${candidates.length} candidate tokens against ${context.length} context vectors.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "setup", alpha, scores: [], probs, chosen: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(probs, probs.map(() => "comparing")),
        edges: [],
        description: "Convert the model logits into a probability for each candidate.",
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "prob", alpha, scores: [], probs, chosen: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(
            scores,
            scores.map((_, i) => (i === chosen ? "active" : "sorted")),
        ),
        edges: [],
        description: `Blend repetition penalty and confidence with alpha ${alpha}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "score", alpha, scores, probs, chosen: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(
            scores,
            scores.map((_, i) => (i === chosen ? "active" : i === chosen - 1 ? "sorted" : "unvisited")),
        ),
        edges: [],
        description: `Done: candidate ${chosen} has the highest contrastive score ${scores[chosen]?.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "done", alpha, scores, probs, chosen, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Contrastive search fights repetition by looking backward. For every possible next token it asks how similar that token is to tokens already in the context, then rewards tokens that are both probable and fresh. A mixing weight alpha trades confidence against anti-repetition, so the model stays on topic without falling into loops.",
        invariants: [
            "Model probabilities are nonnegative and sum to one.",
            "Each similarity term is the maximum cosine over the whole context.",
            "The final score is a convex blend of similarity and probability when alpha is in [0, 1].",
        ],
        correctness:
            "Softmax with a shifted maximum yields the model probabilities without overflow. Cosine similarity is computed from normalized dot products, so it lies in [-1, 1] and is capped from below by zero when no context vector is positively aligned. Taking the maximum over the context gives the token most likely to repeat prior content, and the weighted sum with model probability produces the ranking. Argmax scans left to right with a strict greater-than test, so the highest score wins and ties go to the smaller index.",
        complexityRationale:
            "For k candidates, m context vectors of dimension d, computing all similarities costs O(m k d) and softmax costs O(k). Only the score and probability arrays are kept, using O(k) space.",
        uses: [
            "Repetition-free decoding in text generation",
            "Open-ended story and dialogue generation",
            "A likelihood-plus-diversity alternative to beam search",
        ],
        references: [
            "Su et al., A Contrastive Framework for Neural Text Generation, NeurIPS 2022",
            "Holtzman et al., The Curious Case of Neural Text Degeneration, ICLR 2020",
        ],
        workedExample:
            "With one context vector (1,0), candidates (1,0) and (0,1), logits 3 and 2, and alpha 0.5, the first candidate has similarity 1 and probability about 0.73, while the second has similarity 0 and probability about 0.27. The blended scores are roughly 0.86 and 0.14, so candidate zero is chosen.",
    },
    id: "contrastive-search",
    name: "Contrastive Search",
    category: "ml-ai",
    complexity: { time: "O(m * k * d)", space: "O(k)" },
    defaultInput: {
        context: [[1, 0], [0.9, 0.1]],
        candidates: [[1, 0], [0.95, 0.05], [0, 1], [-1, 0.2]],
        logits: [3, 2.5, 2, 1],
        alpha: 0.6,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read context vectors, candidates, logits and alpha",
        "turn the candidate logits into model probabilities",
        "for each candidate compute maximum cosine similarity to the context",
        "score it as (1-alpha) times similarity plus alpha times probability",
        "pick the candidate with the highest score",
        "done: report the selected candidate and all scores",
    ],
};

export default module;
