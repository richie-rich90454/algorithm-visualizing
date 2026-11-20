/**
 * glove.ts - GloVe: Global Vectors for Word Representation
 *
 * GloVe learns word embeddings by regressing the dot product of two word
 * vectors (plus biases) onto the logarithm of their co-occurrence count.
 * Rare co-occurrences are down-weighted so frequent pairs do not dominate.
 *
 * Time is O(steps * vocabulary^2 * dim); space is O(vocabulary * dim).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { mulberry32 } from "./random-search-hyperparameter";

export interface GloveCooccurrence {
    vocab: string[];
    matrix: number[][];
}

/** Count how often each word pair appears within a window, symmetrically. */
export function gloveCooccurrence(corpus: string[][], window: number): GloveCooccurrence {
    const vocabSet = new Set<string>();
    for (const sentence of corpus) {
        for (const token of sentence) {
            vocabSet.add(token);
        }
    }
    const vocab = [...vocabSet].sort();
    const index = new Map(vocab.map((token, i) => [token, i] as const));
    const matrix = vocab.map(() => vocab.map(() => 0));
    for (const sentence of corpus) {
        for (let i = 0; i < sentence.length; i += 1) {
            const ti = index.get(sentence[i]!);
            if (ti === undefined) {
                continue;
            }
            for (let j = i + 1; j < Math.min(sentence.length, i + window + 1); j += 1) {
                const tj = index.get(sentence[j]!);
                if (tj === undefined) {
                    continue;
                }
                matrix[ti]![tj] = (matrix[ti]![tj] ?? 0) + 1;
                matrix[tj]![ti] = (matrix[tj]![ti] ?? 0) + 1;
            }
        }
    }
    return { vocab, matrix };
}

/** Weighted squared-regression objective of the GloVe model. */
export function gloveLoss(
    matrix: number[][],
    embeddings: number[][],
    biases: number[],
    xmax = 100,
    alpha = 0.75,
): number {
    let loss = 0;
    const n = matrix.length;
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            const count = matrix[i]![j] ?? 0;
            if (count <= 0) {
                continue;
            }
            const weight = Math.min(1, (count / xmax) ** alpha);
            let dot = biases[i]! + biases[j]!;
            for (let k = 0; k < (embeddings[i]?.length ?? 0); k += 1) {
                dot += (embeddings[i]![k] ?? 0) * (embeddings[j]![k] ?? 0);
            }
            const err = dot - Math.log(1 + count);
            loss += weight * err * err;
        }
    }
    return loss;
}

export interface GloveResult {
    embeddings: number[][];
    biases: number[];
    losses: number[];
}

/** Fit GloVe embeddings by averaged full-batch gradient descent. */
export function gloveEmbeddings(
    matrix: number[][],
    dim: number,
    steps: number,
    learningRate: number,
    seed: number,
    xmax = 100,
    alpha = 0.75,
): GloveResult {
    const n = matrix.length;
    const rand = mulberry32(seed);
    const embeddings = matrix.map(() => Array.from({ length: dim }, () => rand() - 0.5));
    const biases = matrix.map(() => 0);
    const losses: number[] = [gloveLoss(matrix, embeddings, biases, xmax, alpha)];

    for (let _step = 0; _step < steps; _step += 1) {
        const gradU = matrix.map(() => Array.from({ length: dim }, () => 0));
        const gradB = matrix.map(() => 0);
        let pairs = 0;
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                const count = matrix[i]![j] ?? 0;
                if (count <= 0) {
                    continue;
                }
                pairs += 1;
                const weight = Math.min(1, (count / xmax) ** alpha);
                let dot = biases[i]! + biases[j]!;
                for (let k = 0; k < dim; k += 1) {
                    dot += (embeddings[i]![k] ?? 0) * (embeddings[j]![k] ?? 0);
                }
                const shared = 2 * weight * (dot - Math.log(1 + count));
                for (let k = 0; k < dim; k += 1) {
                    gradU[i]![k] = (gradU[i]![k] ?? 0) + shared * (embeddings[j]![k] ?? 0);
                    gradU[j]![k] = (gradU[j]![k] ?? 0) + shared * (embeddings[i]![k] ?? 0);
                }
                gradB[i] = gradB[i]! + shared;
                gradB[j] = gradB[j]! + shared;
            }
        }
        const scale = pairs > 0 ? learningRate / pairs : 0;
        for (let i = 0; i < n; i += 1) {
            for (let k = 0; k < dim; k += 1) {
                embeddings[i]![k] = (embeddings[i]![k] ?? 0) - scale * (gradU[i]![k] ?? 0);
            }
            biases[i] = (biases[i] ?? 0) - scale * (gradB[i] ?? 0);
        }
        losses.push(gloveLoss(matrix, embeddings, biases, xmax, alpha));
    }
    return { embeddings, biases, losses };
}

function makeCells(matrix: number[][], vocab: string[], pair: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < matrix.length; i += 1) {
        for (let j = 0; j < (matrix[i]?.length ?? 0); j += 1) {
            const count = matrix[i]![j] ?? 0;
            const active = i === Math.floor(pair / matrix.length) || j === pair % matrix.length;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: `${vocab[i]}/${vocab[j]}: ${count}`,
                value: count,
                state: active ? "comparing" : count > 0 ? "visited" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            corpus?: string[][];
            window?: number;
            dim?: number;
            steps?: number;
            learningRate?: number;
            seed?: number;
        } | null
    ) ?? {};
    const corpus: string[][] = task.corpus ?? [
        ["king", "queen", "royal", "palace"],
        ["king", "queen", "royal", "crown"],
        ["cat", "dog", "pet", "animal"],
        ["dog", "cat", "pet", "puppy"],
    ];
    const window = typeof task.window === "number" ? Math.max(1, Math.floor(task.window)) : 2;
    const dim = typeof task.dim === "number" ? Math.max(1, Math.floor(task.dim)) : 2;
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 10;
    const learningRate =
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 1;
    const seed = typeof task.seed === "number" ? task.seed : 5;
    const cooc = gloveCooccurrence(corpus, window);
    const fit = gloveEmbeddings(cooc.matrix, dim, steps, learningRate, seed);
    const metaBase = { rows: cooc.vocab.length, cols: cooc.vocab.length, vocab: cooc.vocab, dim };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(cooc.matrix, cooc.vocab, -1),
        edges: [],
        description: `GloVe over ${cooc.vocab.length} words and ${corpus.length} sentences; co-occurrence counts within a window of ${window}.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { ...metaBase, loss: fit.losses[0]!, step: 0 },
    };
    step += 1;

    for (let s = 0; s < steps; s += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(cooc.matrix, cooc.vocab, s),
            edges: [],
            description: `Gradient step ${s + 1}: weighted squared loss is ${fit.losses[s + 1]!.toFixed(5)} as dot products approach log co-occurrence.`,
            codeLineNumber: s % 2 === 0 ? 2 : 4,
            layout: "matrix",
            meta: { ...metaBase, loss: fit.losses[s + 1]!, step: s + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(cooc.matrix, cooc.vocab, -1),
        edges: [],
        description: `Learned ${dim}-dimensional GloVe vectors; loss fell from ${fit.losses[0]!.toFixed(5)} to ${fit.losses[steps]!.toFixed(5)}.`,
        codeLineNumber: 5,
        layout: "matrix",
        meta: { ...metaBase, converged: true, loss: fit.losses[steps]!, embeddings: JSON.stringify(fit.embeddings) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Word2vec learns from local word pairs, but GloVe looks at the whole corpus at once. It first counts how often each pair of words appears near each other, then chooses vectors whose dot product predicts the logarithm of that count. Words that share company end up near one another, and directions in the space capture analogies such as king minus man plus woman.",
        invariants: [
            "The co-occurrence matrix is symmetric because the counting window runs in both directions.",
            "The regression target is log of one plus the co-occurrence count.",
            "Frequent pairs are capped by the weighting so they cannot dominate the fit.",
        ],
        correctness:
            "The objective is the GloVe weighted least-squares loss, and the implementation computes its exact gradient for every observed pair before taking an averaged gradient step. The tests rebuild the co-occurrence counts with an independent double loop, check symmetry, verify the loss formula against a direct summation, and confirm that training lowers the objective. Dot products that reproduce log counts are exactly what the model is designed to learn.",
        complexityRationale:
            "Counting co-occurrences touches at most window successors per token, O(tokens * window). Each gradient step considers all vocabulary pairs, O(V squared * dim), and the stored embeddings occupy O(V * dim) space.",
        uses: [
            "Static word embeddings for downstream NLP models",
            "Analogy and similarity evaluation benchmarks",
            "Compact features for text classification when training data is limited",
        ],
        references: [
            "Pennington et al., GloVe: Global Vectors for Word Representation, EMNLP 2014",
            "Mikolov et al., Efficient Estimation of Word Representations in Vector Space, 2013",
        ],
        workedExample:
            "In the sentence the cat sat on the mat with window two, the pair (cat, sat) receives one co-occurrence. If cat and sat appear together three times overall, the target log(4) is about 1.39, so their dot product plus biases is pushed toward that value, while a pair seen once is pushed toward log(2).",
    },
    id: "glove",
    name: "GloVe Word Embeddings",
    category: "ml-ai",
    complexity: { time: "O(steps * V^2 * dim)", space: "O(V * dim)" },
    defaultInput: {
        corpus: [
            ["king", "queen", "royal", "palace"],
            ["king", "queen", "royal", "crown"],
            ["cat", "dog", "pet", "animal"],
            ["dog", "cat", "pet", "puppy"],
        ],
        window: 2,
        dim: 2,
        steps: 10,
        learningRate: 1,
        seed: 5,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "build the vocabulary and zero a co-occurrence matrix",
        "for each sentence and each word count neighbors inside the window symmetrically",
        "initialize word vectors and biases",
        "for each training step sum gradients of the weighted squared log-count error",
        "subtract a scaled average gradient from every vector and bias",
        "done: report the learned word vectors and final loss",
    ],
};

export default module;
