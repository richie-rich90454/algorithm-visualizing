/**
 * sentencepiece-unigram.ts - Unigram Language Model Segmentation (Viterbi)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A unigram language model assigns each subword a log probability and segments
 * a word into the sequence whose scores sum highest. This module runs the
 * Viterbi dynamic program over character positions: best[i] is the best score
 * reaching character i, each known piece extends that score, and a single
 * unknown fallback advances one character. Backtracking recovers the pieces.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * v * L) for n characters, v pieces, max piece length L
 *   Space: O(n) for the best-score and backtracking arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the best score at each character boundary as the DP advances.
 *   - The final frame shows the chosen subword pieces in order.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface UnigramPiece {
    token: string;
    score: number;
}

interface UnigramInput {
    word?: string;
    pieces?: UnigramPiece[];
}

/** Viterbi segmentation of a word under a unigram subword model. */
export function unigramSegment(word: string, pieces: UnigramPiece[]) {
    const n = word.length;
    const best = new Array<number>(n + 1).fill(Number.NEGATIVE_INFINITY);
    const prev = new Array<number>(n + 1).fill(-1);
    const prevToken = new Array<string>(n + 1).fill("");
    best[0] = 0;
    const unknown = pieces.find((piece) => piece.token === "<unk>") ?? { token: "<unk>", score: -10 };
    const known = pieces.filter((piece) => piece.token !== "<unk>" && piece.token.length > 0);

    for (let i = 0; i < n; i += 1) {
        if (!Number.isFinite(best[i])) {
            continue;
        }
        for (const piece of known) {
            const end = i + piece.token.length;
            if (end <= n && word.startsWith(piece.token, i)) {
                const candidate = (best[i] ?? 0) + piece.score;
                if (candidate > (best[end] ?? Number.NEGATIVE_INFINITY)) {
                    best[end] = candidate;
                    prev[end] = i;
                    prevToken[end] = piece.token;
                }
            }
        }
        const unknownCandidate = (best[i] ?? 0) + unknown.score;
        if (unknownCandidate > (best[i + 1] ?? Number.NEGATIVE_INFINITY)) {
            best[i + 1] = unknownCandidate;
            prev[i + 1] = i;
            prevToken[i + 1] = unknown.token;
        }
    }

    const tokens: string[] = [];
    let pos = n;
    while (pos > 0) {
        tokens.unshift(prevToken[pos] ?? unknown.token);
        pos = prev[pos] ?? 0;
    }
    return { best, tokens, score: best[n] ?? Number.NEGATIVE_INFINITY };
}

function scoreBars(values: number[], filled: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `pos-${index}`,
        type: "bar" as const,
        label: Number.isFinite(value) ? value.toFixed(2) : "-",
        value: Number.isFinite(value) ? Number(value.toFixed(8)) : 0,
        state: (index <= filled ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function tokenBars(tokens: string[]): VisualEntity[] {
    return tokens.map((token, index) => ({
        id: `token-${index}`,
        type: "bar" as const,
        label: token,
        value: index + 1,
        state: "sorted" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, token },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as UnigramInput | null) ?? {};
    const word: string = typeof task.word === "string" && task.word.length > 0 ? task.word : "unhappiness";
    const pieces: UnigramPiece[] = Array.isArray(task.pieces) && task.pieces.length > 0
        ? task.pieces
        : [
              { token: "un", score: -1 },
              { token: "happy", score: -2 },
              { token: "happiness", score: -4 },
              { token: "ness", score: -1 },
              { token: "unhappy", score: -3 },
              { token: "hap", score: -2 },
              { token: "py", score: -1.5 },
              { token: "i", score: -1 },
              { token: "a", score: -1 },
              { token: "n", score: -1 },
              { token: "s", score: -1 },
              { token: "p", score: -1 },
              { token: "y", score: -1 },
              { token: "h", score: -1 },
              { token: "e", score: -1 },
              { token: "<unk>", score: -10 },
          ];
    const r = unigramSegment(word, pieces);
    const n = word.length;
    const finiteBest = r.best.map((value) => (Number.isFinite(value) ? Number(value.toFixed(8)) : 0));

    let step = 0;
    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: scoreBars(r.best, i + 1),
            edges: [],
            description: `Boundary ${i + 1}: best cumulative log probability is ${Number.isFinite(r.best[i + 1]) ? (r.best[i + 1] ?? 0).toFixed(2) : "unreachable"}.`,
            codeLineNumber: i === 0 ? 1 : 3,
            layout: "array",
            meta: { word, best: finiteBest, phase: "viterbi", current: i + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: tokenBars(r.tokens),
        edges: [],
        description: `Done: segmented "${word}" into ${r.tokens.length} pieces with score ${r.score.toFixed(2)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            word,
            tokens: r.tokens,
            score: Number(r.score.toFixed(8)),
            best: finiteBest,
            phase: "done",
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A unigram tokenizer scores every candidate subword and then chooses the segmentation of a word with the highest total score. Because a choice at one character only affects later characters through the running score, a dynamic program can decide left to right. Keeping the best predecessor at each boundary lets it reconstruct the exact winning piece sequence at the end.",
        invariants: [
            "best[i] is the maximum score of any segmentation ending at character i.",
            "Each transition adds exactly one vocabulary piece or one unknown fallback.",
            "The unknown fallback guarantees every boundary is reachable.",
        ],
        correctness:
            "The recurrence considers every vocabulary piece that matches at position i and every score achievable at i, so best[i + length] is the maximum over all segmentations whose last piece starts at i. By induction on the boundary index, best[n] is the global optimum. Storing the predecessor that achieved each maximum and walking backward therefore returns an optimal segmentation whose piece scores sum to best[n].",
        complexityRationale:
            "At each of the n boundaries the program tries v pieces, each matched in up to L character comparisons, giving O(n * v * L) time. The best and backtracking arrays hold n plus one entries each, so space is O(n).",
        uses: [
            "Subword segmentation in SentencePiece-based tokenizers",
            "Sampling alternative segmentations with the unigram model",
            "Vocabulary training by iterative score pruning",
        ],
        references: [
            "Kudo, Subword Regularization: Improving Neural Network Translation Models, 2018",
            "Viterbi, Error Bounds for Convolutional Codes, 1967",
        ],
        workedExample:
            "For the word unhappiness with pieces un, happy, and ness, the scores of un plus happy plus ness are compared with the single piece happiness plus other splits. The dynamic program keeps the highest cumulative score at each boundary and backtracks to the winning pieces.",
    },
    id: "sentencepiece-unigram",
    name: "SentencePiece Unigram Segmentation",
    category: "ml-ai",
    complexity: { time: "O(n * v * L)", space: "O(n)" },
    defaultInput: { word: "unhappiness" },
    visualType: "array",
    run,
    pseudocode: [
        "set the best score at boundary zero to zero",
        "for each character boundary with a reachable score",
        "try every vocabulary piece that matches at this boundary",
        "also allow the single-character unknown fallback",
        "keep the highest score reaching each later boundary",
        "record the predecessor that achieved each best score",
        "backtrack from the final boundary to recover the pieces",
        "done: report the optimal segmentation and score",
    ],
};

export default module;
