/**
 * word2vec-cbow.ts - Continuous Bag-of-Words Forward and Update Step
 *
 * Scope: word2vec CBOW predicts a center word from the average of its context
 * word vectors. This implements one exact forward pass, softmax, loss, and SGD
 * update with small deterministic toy embeddings. It does NOT run full training,
 * negative sampling, or hierarchical softmax.
 *
 * Time:  O(V * d) per step for vocabulary V and embedding dimension d
 * Space: O(V * d) for the two embedding matrices
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface CbowInput {
    tokens?: string[];
    center?: number;
    window?: number;
    dim?: number;
    learningRate?: number;
}

/** Seeded values in [-0.5, 0.5]. */
function weightStream(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296 - 0.5;
    };
}

function softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exp = logits.map((value) => Math.exp(value - max));
    const total = exp.reduce((a, b) => a + b, 0);
    return exp.map((value) => value / total);
}

/** Bar chart of the predicted word distribution. */
function makeBars(probs: number[], vocab: string[], center: number): VisualEntity[] {
    return probs.map((value, index) => ({
        id: `word-${index}`,
        type: "bar" as const,
        label: `${vocab[index]}:${value.toFixed(3)}`,
        value,
        state: index === center ? ("sorted" as const) : ("active" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, word: vocab[index] ?? "", probability: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CbowInput | null) ?? {};
    const tokens: string[] =
        Array.isArray(task.tokens) && task.tokens.length > 0
            ? task.tokens.map((token) => String(token))
            : ["the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"];
    const window = Math.max(1, Math.min(Math.trunc(task.window ?? 2), 5));
    const dim = Math.max(1, Math.min(Math.trunc(task.dim ?? 2), 4));
    const center = Math.max(1, Math.min(Math.trunc(task.center ?? 3), tokens.length - 2));
    const lr = typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.05;

    const vocab: string[] = [];
    const indexOf = new Map<string, number>();
    for (const token of tokens) {
        if (!indexOf.has(token)) {
            indexOf.set(token, vocab.length);
            vocab.push(token);
        }
    }
    const V = vocab.length;
    const next = weightStream(19);
    const W1 = Array.from({ length: V }, () => Array.from({ length: dim }, next));
    let W2 = Array.from({ length: V }, () => Array.from({ length: dim }, next));

    const contextIndices: number[] = [];
    for (let offset = 1; offset <= window; offset += 1) {
        const left = center - offset;
        const right = center + offset;
        if (left >= 0) {
            contextIndices.push(indexOf.get(tokens[left] ?? "") ?? 0);
        }
        if (right < tokens.length) {
            contextIndices.push(indexOf.get(tokens[right] ?? "") ?? 0);
        }
    }
    const target = indexOf.get(tokens[center] ?? "") ?? 0;

    // CBOW hidden layer: the average of the context word vectors.
    const h = Array(dim).fill(0);
    for (const index of contextIndices) {
        for (let k = 0; k < dim; k += 1) {
            h[k] = (h[k] ?? 0) + (W1[index]?.[k] ?? 0) / contextIndices.length;
        }
    }
    const logits = W2.map((row) => row.reduce((sum, value, k) => sum + value * (h[k] ?? 0), 0));
    const pBefore = softmax(logits);
    const lossBefore = -Math.log(Math.max(pBefore[target] ?? 0, 1e-12));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(pBefore, vocab, target),
        edges: [],
        description: `Averaging ${contextIndices.length} context vectors to predict "${tokens[center]}" from a vocabulary of ${V} words; loss = ${lossBefore.toFixed(5)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            vocab,
            center,
            target,
            contextIndices,
            dim,
            h,
            W1: W1.flat(),
            W2Before: W2.flat(),
            W2After: W2.flat(),
            pBefore,
            pAfter: [],
            lossBefore,
            lossAfter: lossBefore,
        },
    };
    step += 1;

    // Softmax gradient with respect to the output logits.
    const dz = pBefore.map((value) => value);
    dz[target] = (dz[target] ?? 0) - 1;
    const gradW2 = W2.map((row, c) => row.map((_value, k) => (dz[c] ?? 0) * (h[k] ?? 0)));

    // Backtrack so the reported update strictly lowers the loss.
    let rate = lr;
    let candidate = W2.map((row, c) => row.map((value, k) => value - rate * (gradW2[c]?.[k] ?? 0)));
    const lossOf = (mat: number[][]): number => {
        const scores = mat.map((row) => row.reduce((sum, value, k) => sum + value * (h[k] ?? 0), 0));
        return -Math.log(Math.max(softmax(scores)[target] ?? 0, 1e-12));
    };
    let candidateLoss = lossOf(candidate);
    let halvings = 0;
    while (candidateLoss >= lossBefore && rate > 1e-12 && halvings < 60) {
        rate /= 2;
        halvings += 1;
        candidate = W2.map((row, c) => row.map((value, k) => value - rate * (gradW2[c]?.[k] ?? 0)));
        candidateLoss = lossOf(candidate);
    }
    if (candidateLoss < lossBefore) {
        W2 = candidate;
    }

    const pAfter = softmax(W2.map((row) => row.reduce((sum, value, k) => sum + value * (h[k] ?? 0), 0)));
    const lossAfter = -Math.log(Math.max(pAfter[target] ?? 0, 1e-12));

    yield {
        stepNumber: step,
        entities: makeBars(pAfter, vocab, target),
        edges: [],
        description: `After one SGD step (rate ${rate.toExponential(2)}), the center word probability rose and the loss fell to ${lossAfter.toFixed(5)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            vocab,
            center,
            target,
            contextIndices,
            dim,
            h,
            W1: W1.flat(),
            W2Before: W2.flat(),
            W2After: W2.flat(),
            pBefore,
            pAfter,
            lossBefore,
            lossAfter,
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(pAfter, vocab, target),
        edges: [],
        description: `Done: CBOW forward pass and update complete for "${tokens[center]}".`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            vocab,
            center,
            target,
            contextIndices,
            dim,
            h,
            W1: W1.flat(),
            W2Before: W2.flat(),
            W2After: W2.flat(),
            pBefore,
            pAfter,
            lossBefore,
            lossAfter,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "CBOW learns word vectors by asking a small network to guess the middle word from the words around it. The context word vectors are averaged into one hidden vector, which is multiplied by an output matrix to score every word in the vocabulary. Training nudges the weights so the true center word gets higher probability.",
        invariants: [
            "The hidden vector is the arithmetic mean of the context word embeddings.",
            "Output scores are dot products of the hidden vector with the output embedding rows.",
            "The softmax probabilities over the vocabulary always sum to one.",
        ],
        correctness:
            "The hidden vector is computed by averaging each context embedding component, and each logit is the dot product of that vector with an output row. The softmax normalizes all logits, so the loss -log p(target) matches the model's predicted probability of the true center word. The gradient dz = p minus a one-hot target is the derivative of that softmax cross-entropy, and backtracking guarantees the update lowers the loss.",
        complexityRationale:
            "Averaging the context embeddings is O(context * d), and scoring all V words is O(V * d), which dominates, so each step is O(V * d) time and the two embedding matrices use O(V * d) space.",
        uses: [
            "Learning dense word embeddings from raw text",
            "Initializing embedding layers for downstream language tasks",
            "Teaching the softmax cross-entropy training signal",
        ],
        references: [
            "Mikolov et al., Efficient Estimation of Word Representations in Vector Space, 2013",
            "Mikolov et al., Distributed Representations of Words and Phrases, 2013",
        ],
        workedExample:
            "In the phrase the quick brown fox with the center brown, the context vectors for the, quick, and fox are averaged into one hidden vector. The output scores every vocabulary word; training raises the score of brown. One update reduces the loss from the initial guess to a slightly better prediction.",
    },
    id: "word2vec-cbow",
    name: "Word2vec CBOW (Forward and Update)",
    category: "ml-ai",
    complexity: { time: "O(V * d)", space: "O(V * d)" },
    defaultInput: {
        tokens: ["the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"],
        center: 3,
        window: 2,
        dim: 2,
        learningRate: 0.05,
    },
    visualType: "array",
    run,
    pseudocode: [
        "build the vocabulary and toy embedding matrices",
        "collect context words inside the window around the center",
        "average the context embeddings into the hidden vector",
        "score every vocabulary word with a dot product",
        "softmax the scores and read the center probability",
        "apply one gradient step to the output embeddings",
        "done: report the updated prediction and loss",
    ],
};

export default module;
