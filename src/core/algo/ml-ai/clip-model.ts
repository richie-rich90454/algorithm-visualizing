/**
 * clip-model.ts - CLIP Symmetric Contrastive Alignment
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CLIP learns a shared embedding space for images and text by pulling matching
 * pairs together and pushing non-matching pairs apart. A learned logit scale
 * multiplies the cosine similarity matrix, and a symmetric cross-entropy sums
 * the image-to-text and text-to-image classification losses. At inference the
 * same similarity matrix acts as a zero-shot classifier.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n_i * n_t * d) for n_i images, n_t texts and embedding width d
 *   Space: O(n_i * n_t) for the logit matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - The image-by-text logit matrix is drawn as a grid.
 *   - Matching diagonal pairs are green, mismatched pairs idle.
 *   - Frame meta carries the logits, scale, and symmetric loss.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ClipInput {
    imageEmbeddings?: number[][];
    textEmbeddings?: number[][];
    logitScale?: number;
}

function normalize(row: number[]): number[] {
    const norm = Math.sqrt(row.reduce((s, v) => s + v * v, 0));
    return norm === 0 ? row.map(() => 0) : row.map((v) => v / norm);
}

/** Scaled cosine similarity between every image and text embedding. */
export function clipLogits(images: number[][], texts: number[][], scale: number): number[][] {
    const I = images.map(normalize);
    const T = texts.map(normalize);
    return I.map((image) => T.map((text) => {
        let dot = 0;
        for (let k = 0; k < image.length; k += 1) dot += image[k]! * (text[k] ?? 0);
        return dot * scale;
    }));
}

/** Symmetric image-to-text and text-to-image InfoNCE loss. */
export function clipLoss(logits: number[][]): { loss: number; imageLoss: number; textLoss: number } {
    const n = logits.length;
    const m = logits[0]?.length ?? 0;
    const softmax = (row: number[], skip: number): number[] => {
        const max = Math.max(...row);
        const exps = row.map((v, j) => (j === skip ? 0 : Math.exp(v - max)));
        const sum = exps.reduce((a, b) => a + b, 0);
        return exps.map((e) => e / sum);
    };
    let imageLoss = 0;
    for (let i = 0; i < n; i += 1) {
        const probs = softmax(logits[i] ?? [], -1);
        imageLoss += -Math.log(probs[Math.min(i, m - 1)] ?? 1e-12);
    }
    imageLoss /= Math.max(1, n);
    let textLoss = 0;
    for (let j = 0; j < m; j += 1) {
        const column = logits.map((row) => row[j] ?? 0);
        const probs = softmax(column, -1);
        textLoss += -Math.log(probs[Math.min(j, n - 1)] ?? 1e-12);
    }
    textLoss /= Math.max(1, m);
    return { loss: (imageLoss + textLoss) / 2, imageLoss, textLoss };
}

function makeCells(logits: number[][], active: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < logits.length; row += 1) {
        for (let col = 0; col < (logits[row]?.length ?? 0); col += 1) {
            const value = logits[row]?.[col] ?? 0;
            const state: EntityState = row === col ? "sorted" : row === active ? "comparing" : "idle";
            entities.push({
                id: `logit-${row}-${col}`,
                type: "cell",
                label: value.toFixed(2),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, match: row === col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ClipInput | null) ?? {};
    const images = (task.imageEmbeddings ?? [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ]).map((row) => [...row]);
    const texts = (task.textEmbeddings ?? [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ]).map((row) => [...row]);
    const scale = typeof task.logitScale === "number" && task.logitScale > 0 ? task.logitScale : 4;
    const logits = clipLogits(images, texts, scale);
    const loss = clipLoss(logits);
    const rows = logits.length;
    const cols = logits[0]?.length ?? 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(logits, -1),
        edges: [],
        description: `CLIP logits for ${rows} images and ${cols} texts with learned scale ${scale}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, scale, logits, loss: 0, imageLoss: 0, textLoss: 0 },
    };
    step += 1;

    for (let i = 0; i < rows; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(logits, i),
            edges: [],
            description: `Image ${i}: similarity to its matching text ${(logits[i]?.[i] ?? 0).toFixed(2)}.`,
            codeLineNumber: i === 0 ? 2 : 4,
            layout: "grid",
            meta: { rows, cols, scale, logits, loss: loss.loss, imageLoss: loss.imageLoss, textLoss: loss.textLoss, anchor: i },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(logits, -1),
        edges: [],
        description: `Symmetric InfoNCE loss ${loss.loss.toFixed(5)} (image ${loss.imageLoss.toFixed(5)}, text ${loss.textLoss.toFixed(5)}).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows, cols, scale, logits, loss: loss.loss, imageLoss: loss.imageLoss, textLoss: loss.textLoss },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "CLIP trains two encoders so that an image and the text describing it land near each other in a shared space. The similarity between every image and every text in a batch forms a matrix; the correct pairs sit on the diagonal. The loss is just classification on that matrix in both directions, which teaches the space to align modalities without manual labels.",
        invariants: [
            "Embeddings are L2-normalized, so logits are cosine similarities multiplied by a positive learned scale.",
            "Correct image-text pairs occupy the diagonal of the logit matrix.",
            "The total loss is the average of the image-to-text and text-to-image cross-entropies.",
        ],
        correctness:
            "Each row of the logit matrix is a distribution over texts for one image and each column is a distribution over images for one text. Applying softmax cross-entropy to the diagonal entries in both directions is the symmetric InfoNCE objective used by CLIP. Subtracting the row maximum before exponentiating is the log-sum-exp trick and does not change any probability.",
        complexityRationale:
            "Computing all pairwise dot products of width d costs O(n_i times n_t times d), and the two cross-entropies cost O(n_i times n_t). The logit matrix uses O(n_i times n_t) space.",
        uses: [
            "Zero-shot image classification with natural language labels",
            "Cross-modal retrieval of images and captions",
            "Image grounding for downstream vision-language models",
        ],
        references: [
            "Radford et al., Learning Transferable Visual Models From Natural Language Supervision, ICML 2021",
            "Chen et al., A Simple Framework for Contrastive Learning of Visual Representations, ICML 2020",
        ],
        workedExample:
            "With three identical orthonormal image and text embeddings and scale 4, every diagonal logit is 4 and every off-diagonal logit is 0. Each row softmax puts weight exp(4)/(exp(4)+2) on the correct text, so the loss is the negative log of that probability in both directions.",
    },
    id: "clip-model",
    name: "CLIP Symmetric Contrastive Alignment",
    category: "ml-ai",
    complexity: { time: "O(n_i * n_t * d)", space: "O(n_i * n_t)" },
    defaultInput: {
        imageEmbeddings: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        textEmbeddings: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        logitScale: 4,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "L2-normalize every image and text embedding",
        "multiply all pairwise cosine similarities by the logit scale",
        "for each image row apply softmax over all texts",
        "accumulate negative log probability of the matching text",
        "for each text column apply softmax over all images",
        "accumulate negative log probability of the matching image",
        "average the two directional losses",
        "done: return the logits and symmetric contrastive loss",
    ],
};

export default module;
