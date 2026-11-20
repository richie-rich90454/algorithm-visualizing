/**
 * bert-pretraining.ts - BERT Masked Language Modeling Pretraining
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BERT learns from raw text with two self-supervised objectives. Masked language
 * modeling hides some tokens and trains the model to recover them from context,
 * while next sentence prediction asks whether two segments originally followed
 * each other. This demo builds BERT's pretraining example: it wraps tokens with
 * class and separator markers, applies a deterministic 80/10/10 masking policy,
 * makes a simple context-based guess for each hidden token, and assembles the
 * two-segment next-sentence input.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) over the token sequence
 *   Space: O(n) for the masked sequence and segment ids
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Frames show the token ids at each construction stage.
 *   - Masked and predicted positions are highlighted.
 *   - The final frames report guess accuracy and the next-sentence label.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BertInput {
    tokens: number[];
    nextTokens: number[];
    seed: number;
    maskProbability: number;
    vocabSize: number;
    isNext: boolean;
}

const MASK_ID = 0;
const CLS_ID = 1;
const SEP_ID = 2;

/** Deterministic mulberry32 pseudo-random generator so masking is replayable. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Build bar entities for a token-id sequence. */
function makeBars(ids: number[], stage: string, highlighted: Set<number>, active: boolean): VisualEntity[] {
    return ids.map((id, index) => ({
        id: `token-${index}`,
        type: "bar" as const,
        label: String(id),
        value: id,
        state: (highlighted.has(index) ? "active" : active ? "sorted" : "idle") as EntityState,
        x: index * 30,
        y: 0,
        width: 18,
        height: 0,
        metadata: { index, tokenId: id, stage },
    }));
}

/** The BERT pretraining generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<BertInput> | null) ?? {};
    const tokens: number[] = task.tokens ?? [5, 7, 3, 8, 4, 9];
    const nextTokens: number[] = task.nextTokens ?? [6, 10, 11];
    const seed = typeof task.seed === "number" ? task.seed : 42;
    const maskProbability = typeof task.maskProbability === "number" ? task.maskProbability : 0.3;
    const vocabSize = typeof task.vocabSize === "number" ? task.vocabSize : 12;
    const isNext = typeof task.isNext === "boolean" ? task.isNext : true;

    const inputIds = [CLS_ID, ...tokens, SEP_ID];
    yield {
        stepNumber: 0,
        entities: makeBars(inputIds, "input", new Set(), false),
        edges: [],
        description: `Wrapped ${tokens.length} tokens with class and separator markers.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { stage: "input", length: inputIds.length, values: inputIds },
    };

    const random = mulberry32(seed);
    const maskedIds = inputIds.slice();
    const targets: number[] = [];
    const maskedPositions: number[] = [];
    for (let index = 1; index <= tokens.length; index += 1) {
        if (random() >= maskProbability) {
            continue;
        }
        const original = tokens[index - 1] ?? 0;
        targets.push(original);
        maskedPositions.push(index);
        const choice = random();
        if (choice < 0.8) {
            maskedIds[index] = MASK_ID;
        } else if (choice < 0.9) {
            maskedIds[index] = 3 + Math.floor(random() * Math.max(1, vocabSize - 3));
        }
    }
    const highlightMasked = new Set(maskedPositions);
    yield {
        stepNumber: 1,
        entities: makeBars(maskedIds, "masked", highlightMasked, false),
        edges: [],
        description: `Masked ${maskedPositions.length} token(s) with the 80/10/10 policy.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { stage: "masked", maskCount: maskedPositions.length, maskPositions: maskedPositions, targets, values: maskedIds },
    };

    const predictions = maskedPositions.map((index) => {
        const tokenIndex = index - 1;
        const left = tokens[tokenIndex - 1] ?? tokens[tokenIndex + 1] ?? 3;
        const right = tokens[tokenIndex + 1] ?? tokens[tokenIndex - 1] ?? 3;
        const guess = Math.round((left + right) / 2);
        return Math.max(3, Math.min(vocabSize - 1, guess));
    });
    const correct = predictions.reduce((count, prediction, i) => count + (prediction === targets[i] ? 1 : 0), 0);
    const accuracy = maskedPositions.length > 0 ? correct / maskedPositions.length : 0;
    yield {
        stepNumber: 2,
        entities: makeBars(predictions, "predictions", new Set(predictions.map((_, i) => i)), false),
        edges: [],
        description: `Context guesses scored ${correct} of ${maskedPositions.length} masked token(s) correctly.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { stage: "predictions", predictions, targets, accuracy: Number(accuracy.toFixed(6)), values: predictions },
    };

    const combined = [CLS_ID, ...tokens, SEP_ID, ...nextTokens, SEP_ID];
    const segmentIds = [
        ...new Array(tokens.length + 2).fill(0),
        ...new Array(nextTokens.length + 1).fill(1),
    ];
    yield {
        stepNumber: 3,
        entities: makeBars(combined, "nsp", new Set(), false),
        edges: [],
        description: `Next-sentence input combines both segments with segment ids; label is ${isNext ? "isNext" : "notNext"}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { stage: "nsp", combined, segmentIds, isNext, values: combined },
    };

    yield {
        stepNumber: 4,
        entities: makeBars(maskedIds, "summary", highlightMasked, true),
        edges: [],
        description: `Pretraining example ready: ${maskedPositions.length} masked token(s), accuracy ${accuracy.toFixed(2)}, isNext ${isNext}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { stage: "summary", maskCount: maskedPositions.length, accuracy: Number(accuracy.toFixed(6)), isNext, values: maskedIds },
    };
}

/** The BERT pretraining module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "BERT learns without human labels by hiding part of the input and asking the model to fill the blanks. It replaces about fifteen percent of tokens, mostly with a special mask marker, and trains the model to predict the originals from both left and right context. A second task shows two sentences and asks whether the second really followed the first, which teaches sentence-level relationships.",
        invariants: [
            "The class token opens the sequence and a separator token closes each segment.",
            "Exactly the selected token positions are eligible for masking; markers are never masked.",
            "Segment ids are zero for the first sentence and one for the second.",
        ],
        correctness:
            "The generator wraps tokens, applies the deterministic 80/10/10 masking policy, and builds the two-segment input with correct segment ids. The test reimplements the same pseudo-random masking and context guesser independently and checks the masked ids, targets, predictions, accuracy, and segment ids, confirming that the pretraining example is constructed faithfully and replayably.",
        complexityRationale:
            "Masking walks the token list once, guessing reads a constant number of neighbors per masked token, and building the segment input is one concatenation, so time is O(n). The masked sequence and segment ids also take O(n) space.",
        uses: [
            "Pretraining encoder language models such as BERT and RoBERTa",
            "Self-supervised learning from large unlabeled text corpora",
            "Teaching masked-token prediction and sentence-pair objectives",
        ],
        references: [
            "Devlin et al., BERT: Pre-training of Deep Bidirectional Transformers, NAACL 2019",
            "Liu et al., RoBERTa: A Robustly Optimized BERT Pretraining Approach, 2019",
        ],
        workedExample:
            "For tokens [5, 7, 3, 8, 4, 9] with seed 42, the sequence is wrapped as [1, 5, 7, 3, 8, 4, 9, 2]. A few token positions are selected and mostly replaced by the mask id 0, the original ids are saved as targets, and a neighbor-average guess is scored. The two-segment input then appends the second sentence after a separator with segment ids switching from zero to one.",
    },
    id: "bert-pretraining",
    name: "BERT Pretraining Objective",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { tokens: [5, 7, 3, 8, 4, 9], nextTokens: [6, 10, 11], seed: 42, maskProbability: 0.3, vocabSize: 12, isNext: true },
    visualType: "array",
    run,
    pseudocode: [
        "wrap the token sequence with class and separator markers",
        "for each token position draw a random number to decide masking",
        "replace a chosen token by mask, a random token, or keep it",
        "save the original token ids as prediction targets",
        "guess each hidden token from its neighboring tokens",
        "score the guesses against the targets",
        "build the two-segment next-sentence input with segment ids",
        "emit the completed pretraining example",
    ],
};

export default module;
