/**
 * word2vec-skip-gram.ts - Skip-Gram Training Pair Extraction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The skip-gram model learns word vectors by asking a center word to predict
 * each word inside a small context window. This demo extracts those training
 * pairs from a token sequence and scores each pair with a fixed toy embedding,
 * showing the dot product that a real model would turn into a probability. The
 * embeddings are deterministic toy vectors for illustration, not trained
 * vectors.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * window) to enumerate all center and context pairs
 *   Space: O(n * window) for the emitted pair list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vocabulary words are nodes; a center word is the pivot.
 *   - Edges link the center to each of its context words.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface SkipGramInput {
    tokens?: string[];
    window?: number;
}

/** A fixed toy embedding so scores are reproducible. */
function embed(word: string): [number, number] {
    let sum = 0;
    for (let i = 0; i < word.length; i += 1) {
        sum += word.charCodeAt(i);
    }
    return [(sum % 7) - 3, ((word.length * 3) % 5) - 2];
}

function dot(a: [number, number], b: [number, number]): number {
    return a[0] * b[0] + a[1] * b[1];
}

/** Build vocabulary nodes for one frame. */
function makeNodes(
    vocab: string[],
    centerIndex: number,
    contextIndices: number[],
    states: Map<number, EntityState>,
): VisualEntity[] {
    return vocab.map((word, index) => ({
        id: `w-${index}`,
        type: "node" as const,
        label: word,
        value: word,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, word },
    }));
}

/** Extract and score skip-gram pairs, one center position at a time. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SkipGramInput | null) ?? {};
    const tokens: string[] =
        Array.isArray(task.tokens) && task.tokens.length > 0
            ? task.tokens.map((token) => String(token))
            : ["the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"];
    const window = Math.max(1, Math.min(typeof task.window === "number" ? task.window : 2, 5));

    const vocab: string[] = [];
    const tokenIndex = new Map<string, number>();
    for (const token of tokens) {
        if (!tokenIndex.has(token)) {
            tokenIndex.set(token, vocab.length);
            vocab.push(token);
        }
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeNodes(vocab, -1, [], new Map()),
        edges: [],
        description: `Extracting skip-gram pairs from ${tokens.length} tokens with a window of ${window}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { window, center: -1, pairs: [], scores: [], totalPairs: 0 },
    };
    step += 1;

    let totalPairs = 0;
    for (let position = 0; position < tokens.length; position += 1) {
        const contextPositions: number[] = [];
        for (let offset = 1; offset <= window; offset += 1) {
            const left = position - offset;
            const right = position + offset;
            if (left >= 0) {
                contextPositions.push(left);
            }
            if (right < tokens.length) {
                contextPositions.push(right);
            }
        }
        if (contextPositions.length === 0) {
            continue;
        }

        const centerWord = tokens[position]!;
        const centerVec = embed(centerWord);
        const states = new Map<number, EntityState>([[tokenIndex.get(centerWord)!, "pivot"]]);
        const edges: VisualEdge[] = [];
        const pairs: string[] = [];
        const scores: number[] = [];
        for (const contextPosition of contextPositions) {
            const contextWord = tokens[contextPosition]!;
            const contextId = tokenIndex.get(contextWord)!;
            states.set(contextId, "path");
            pairs.push(`${centerWord}|${contextWord}`);
            scores.push(Number(dot(centerVec, embed(contextWord)).toFixed(6)));
            edges.push({
                id: `pair-${position}-${contextPosition}`,
                sourceId: `w-${tokenIndex.get(centerWord)!}`,
                targetId: `w-${contextId}`,
                label: contextWord,
                state: "path",
                directed: true,
            });
        }
        totalPairs += pairs.length;
        yield {
            stepNumber: step,
            entities: makeNodes(vocab, position, contextPositions, states),
            edges,
            description: `Center "${centerWord}" at position ${position} predicts ${pairs.length} context word(s) within the window.`,
            codeLineNumber: 4,
            layout: "graph",
            meta: {
                window,
                center: position,
                centerWord,
                pairs,
                scores,
                totalPairs,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(vocab, -1, [], new Map()),
        edges: [],
        description: `Extracted ${totalPairs} center and context training pairs in total.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: { window, center: -1, pairs: [], scores: [], totalPairs },
    };
}

/** The skip-gram module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Skip-gram turns raw text into a prediction task: pick a word in the middle of a window and ask which nearby words appear around it. Words that share many contexts are trained to have similar vectors. Extracting the pairs correctly is the first and most important step of the method.",
        invariants: [
            "For each center position, context words lie within the window on either side, never crossing the sequence ends.",
            "A context position is never the center position itself.",
            "Every emitted pair is scored with the dot product of two fixed toy embeddings.",
        ],
        correctness:
            "The nested loops visit every offset from one to the window size on both sides of a center and keep only in-range positions, so the produced set is exactly all valid (center, context) pairs. Proving no pair is missed follows from checking each offset once; proving no extra pair appears follows because the center offset is skipped.",
        complexityRationale:
            "For n tokens and a fixed window c, each center examines at most two c positions, so pair extraction is O(n times c) time and the same order in emitted pairs. The vocabulary nodes add O(v) space for v distinct words.",
        uses: [
            "Learning dense word embeddings for downstream language tasks",
            "Finding similar words by vector distance",
            "Initializing embedding layers for neural language models",
        ],
        references: [
            "Mikolov et al., Efficient Estimation of Word Representations in Vector Space, 2013",
            "Mikolov et al., Distributed Representations of Words and Phrases, 2013",
        ],
        workedExample:
            "In the phrase the quick brown fox with window 2, the center brown has context words the, quick, fox, and jumps if present. The pair brown to fox is recorded and scored with the dot product of their toy embeddings, illustrating the training signal the model would learn from.",
    },
    id: "word2vec-skip-gram",
    name: "Word2vec Skip-Gram",
    category: "ml-ai",
    complexity: { time: "O(n * window)", space: "O(n * window)" },
    defaultInput: {
        tokens: ["the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"],
        window: 2,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build a vocabulary from the token sequence",
        "for each center position in the sequence",
        "for each offset from one to the window size",
        "collect in-range words to the left and right",
        "emit each center and context pair with a dot product score",
        "advance to the next center position",
        "done: report all extracted training pairs",
    ],
};

export default module;
