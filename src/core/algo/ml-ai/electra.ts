/**
 * electra.ts - ELECTRA Replaced Token Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ELECTRA learns from text by corrupting a small fraction of tokens with
 * plausible alternatives and training a discriminator to decide, at every
 * position, whether the token is original or was swapped in by a generator.
 * Unlike masked language modeling, which only trains on the hidden positions,
 * every position supplies a learning signal, which makes pretraining more
 * compute-efficient. This demo builds one deterministic corruption example and
 * runs a small local-window discriminator over it.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n tokens
 *   Space: O(n) for the corrupted sequence, labels, and scores
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Frames show bars for the original ids, corrupted ids, labels, and
 *     discriminator predictions.
 *   - Replaced positions are highlighted in the corrupted frame.
 *   - The final frame reports detection accuracy and cross-entropy loss.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ElectraInput {
    tokens: number[];
    seed: number;
    replaceProbability: number;
    vocabSize: number;
}

const W_SELF = 1;
const W_LEFT = -0.5;
const W_RIGHT = -0.5;
const BIAS = 0;

/** Deterministic mulberry32 pseudo-random generator so corruption is replayable. */
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

function sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
}

function makeBars(values: number[], highlighted: Set<number>, state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `token-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: highlighted.has(index) ? "swapped" : state,
        x: index * 30,
        y: 0,
        width: 18,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<ElectraInput> | null) ?? {};
    const tokens: number[] = task.tokens ?? [5, 7, 3, 8, 4, 9, 6];
    const seed = typeof task.seed === "number" ? task.seed : 42;
    const q = typeof task.replaceProbability === "number" ? task.replaceProbability : 0.3;
    const vocabSize = typeof task.vocabSize === "number" ? task.vocabSize : 16;

    const random = mulberry32(seed);
    const corrupted = tokens.slice();
    const labels: number[] = new Array(tokens.length).fill(0);
    const replacedPositions: number[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
        if (random() >= q || vocabSize <= 4) {
            continue;
        }
        let alternative = 3 + Math.floor(random() * (vocabSize - 3));
        if (alternative === tokens[i]) {
            alternative = 3 + ((alternative - 3 + 1) % (vocabSize - 3));
        }
        corrupted[i] = alternative;
        labels[i] = 1;
        replacedPositions.push(i);
    }

    const scores: number[] = [];
    const predictions: number[] = [];
    for (let i = 0; i < corrupted.length; i += 1) {
        const self = corrupted[i] ?? 0;
        const left = i > 0 ? (corrupted[i - 1] ?? 0) : 0;
        const right = i < corrupted.length - 1 ? (corrupted[i + 1] ?? 0) : 0;
        const z = W_SELF * self + W_LEFT * left + W_RIGHT * right + BIAS;
        scores.push(z);
        predictions.push(z >= 0 ? 1 : 0);
    }

    let lossSum = 0;
    for (let i = 0; i < labels.length; i += 1) {
        const probability = Math.min(1 - 1e-12, Math.max(1e-12, sigmoid(scores[i] ?? 0)));
        const target = labels[i] ?? 0;
        lossSum += -(target * Math.log(probability) + (1 - target) * Math.log(1 - probability));
    }
    const loss = labels.length ? lossSum / labels.length : 0;
    let detected = 0;
    for (let i = 0; i < labels.length; i += 1) {
        if (predictions[i] === labels[i]) {
            detected += 1;
        }
    }
    const accuracy = labels.length ? detected / labels.length : 0;
    const weights = { self: W_SELF, left: W_LEFT, right: W_RIGHT, bias: BIAS };

    yield {
        stepNumber: 0,
        entities: makeBars(tokens, new Set(), "idle"),
        edges: [],
        description: `Original sequence of ${tokens.length} tokens before generator corruption.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { stage: "original", tokens: tokens.slice(), values: tokens.slice(), vocabSize, replaceProbability: q },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(corrupted, new Set(replacedPositions), "sorted"),
        edges: [],
        description: `Generator replaced ${replacedPositions.length} of ${tokens.length} token(s) with plausible alternatives.`,
        codeLineNumber: 2,
        layout: "array",
        meta: {
            stage: "corrupted",
            corrupted: corrupted.slice(),
            replacedPositions: replacedPositions.slice(),
            values: corrupted.slice(),
        },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(labels, new Set(), "comparing"),
        edges: [],
        description: "Binary labels mark one for a replaced token and zero for an original token.",
        codeLineNumber: 4,
        layout: "array",
        meta: { stage: "labels", labels: labels.slice(), values: labels.slice() },
    };

    yield {
        stepNumber: 3,
        entities: makeBars(predictions, new Set(), "active"),
        edges: [],
        description: `Discriminator predicted replaced at ${predictions.reduce((sum, p) => sum + p, 0)} position(s).`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            stage: "predictions",
            scores: scores.slice(),
            predictions: predictions.slice(),
            weights,
            values: predictions.slice(),
        },
    };

    yield {
        stepNumber: 4,
        entities: makeBars(predictions, new Set(replacedPositions), "sorted"),
        edges: [],
        description: `Replaced token detection: accuracy ${accuracy.toFixed(4)}, loss ${loss.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            stage: "summary",
            accuracy: Number(accuracy.toFixed(8)),
            loss: Number(loss.toFixed(8)),
            detected,
            replaced: replacedPositions.length,
            total: tokens.length,
            values: predictions.slice(),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of hiding a few words and guessing them, ELECTRA swaps a few words for plausible substitutes and asks the model to spot which words were swapped. Because almost every input word gets a real or fake label, the model learns from the whole sentence rather than only the small hidden fraction. A small generator proposes the substitutes and a discriminator judges every position.",
        invariants: [
            "A position is labeled replaced exactly when its corrupted id differs from its original id.",
            "Every label and every discriminator prediction is either zero or one.",
            "The generator never keeps a substitute identical to the original token.",
        ],
        correctness:
            "The generator draws a replacement only for positions selected by the pseudo-random threshold and always chooses an id different from the original, so the label of one matches a genuine change. The discriminator computes a fixed linear score over the token and its two neighbors and predicts replaced when that score is nonnegative. The reported accuracy counts positions where prediction equals label, and the loss is the mean binary cross-entropy of the sigmoid scores against the labels, both computed exactly. An independent reference in the test reproduces the sampling, scores, and loss, confirming the example is built faithfully.",
        complexityRationale:
            "The corruption loop visits each token once, the discriminator reads a constant-size window per token, and the loss is a single pass, so time is O(n). The corrupted sequence, labels, scores, and predictions each store one value per token, giving O(n) space.",
        uses: [
            "Compute-efficient pretraining of encoder language models",
            "Self-supervised learning from large unlabeled text corpora",
            "Teaching binary token-level classification and generator-discriminator training",
        ],
        references: [
            "Clark, Luong, Le, and Manning, ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators, ICLR 2020",
            "Devlin et al., BERT: Pre-training of Deep Bidirectional Transformers, NAACL 2019",
        ],
        workedExample:
            "For tokens [5, 7, 3, 8, 4, 9, 6] with seed 42, probability 0.3, and vocabulary 16, a few positions are chosen and each chosen token becomes a different random id in the vocabulary range. Those positions receive label one; the rest receive label zero. The discriminator scores each token with the weights on itself and its two neighbors, predicts replaced where the score is nonnegative, and the final frame reports how often prediction matched label.",
    },
    id: "electra",
    name: "ELECTRA Replaced Token Detection",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { tokens: [5, 7, 3, 8, 4, 9, 6], seed: 42, replaceProbability: 0.3, vocabSize: 16 },
    visualType: "array",
    run,
    pseudocode: [
        "read the original token ids and the replacement probability",
        "for each non-marker token draw a pseudo-random number",
        "when drawn below the probability, sample a different replacement token",
        "record the original as the target and mark the position as replaced",
        "attach a binary label: one for replaced, zero for original",
        "score every position with a discriminator over its local window",
        "predict replaced when the score is nonnegative",
        "report detection accuracy and binary cross-entropy loss",
    ],
};

export default module;
