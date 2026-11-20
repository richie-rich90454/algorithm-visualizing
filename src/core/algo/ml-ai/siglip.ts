/**
 * siglip.ts - Sigmoid Language-Image Pretraining
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SigLIP replaces the softmax of contrastive image-text training with a
 * sigmoid applied independently to every image-text pair. A learned bias and
 * scale turn the embedding dot product into a logit. Matching pairs are pushed
 * toward logit one and all other pairs toward logit zero, so the loss is a sum
 * of binary cross-entropies rather than a softmax over the batch.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N^2 * d) for N images, N texts, and embedding dimension d
 *   Space: O(N^2) for the logit matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show each pair's signed logit and whether it is a match.
 *   - The final frame reports the mean sigmoid loss.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SiglipInput {
    images?: number[][];
    texts?: number[][];
    bias?: number;
    logScale?: number;
}

function dot(a: number[], b: number[]): number {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
        total += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return total;
}

/** Numerically stable softplus: log(1 + exp(x)). */
function softplus(x: number): number {
    return x > 20 ? x : Math.log1p(Math.exp(x));
}

function makeCells(logits: number[][], done: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < logits.length; i += 1) {
        for (let j = 0; j < (logits[i] ?? []).length; j += 1) {
            const value = logits[i]?.[j] ?? 0;
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: value.toFixed(3),
                value,
                state: done ? (i === j ? "sorted" : "idle") : i === j ? "active" : "comparing",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, logit: value, match: i === j },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SiglipInput | null) ?? {};
    const images = task.images ?? [
        [1, 0],
        [0, 1],
        [-1, 0],
    ];
    const texts = task.texts ?? [
        [0.9, 0.1],
        [0.1, 0.9],
        [-0.9, 0.1],
    ];
    const bias = typeof task.bias === "number" ? task.bias : -0.1;
    const logScale = typeof task.logScale === "number" ? task.logScale : 0;
    const scale = Math.exp(logScale);
    const n = Math.min(images.length, texts.length);

    const logits: number[][] = [];
    const pairLosses: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        const logitRow: number[] = [];
        const lossRow: number[] = [];
        for (let j = 0; j < n; j += 1) {
            const logit = scale * dot(images[i] ?? [], texts[j] ?? []) + bias;
            logitRow.push(logit);
            const label = i === j ? 1 : -1;
            lossRow.push(softplus(-label * logit));
        }
        logits.push(logitRow);
        pairLosses.push(lossRow);
    }
    const total = pairLosses.flat().reduce((a, v) => a + v, 0);
    const loss = total / Math.max(1, n * n);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(logits, false),
        edges: [],
        description: `SigLIP over ${n} image-text pairs with bias ${bias} and scale ${scale.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, rows: n, cols: n, bias, scale, loss: 0 },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const matchLoss = pairLosses[i]?.[i] ?? 0;
        yield {
            stepNumber: step,
            entities: makeCells(logits, false),
            edges: [],
            description: `Row ${i}: the matching pair has logit ${(logits[i]?.[i] ?? 0).toFixed(4)} and binary loss ${matchLoss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                step,
                rows: n,
                cols: n,
                row: i,
                matchLogit: logits[i]?.[i] ?? 0,
                matchLoss,
                meanNegLoss: (pairLosses[i] ?? []).reduce((a, v, j) => a + (j === i ? 0 : v), 0) / Math.max(1, n - 1),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(logits, true),
        edges: [],
        description: `Done: mean sigmoid loss ${loss.toFixed(6)} over ${n * n} image-text pairs.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { step, rows: n, cols: n, loss, logits: logits.flat(), pairLosses: pairLosses.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Standard contrastive image-text training builds a softmax over all pairs in a batch, which couples every example to the batch size. SigLIP instead asks a yes-or-no question about each pair independently: is this image matched to this caption? A sigmoid turns the scaled dot product plus a learned bias into a probability, and binary cross-entropy pushes matches up and non-matches down.",
        invariants: [
            "Each pair contributes one binary cross-entropy term, independent of the batch size.",
            "The logit is a learned scale times the embedding dot product plus a learned bias.",
            "Matching pairs receive a positive label and every other pair a negative label.",
        ],
        correctness:
            "Binary cross-entropy with label y in plus or minus one can be written as softplus of minus y times the logit, which is exactly what the code evaluates. Using the softplus identity log(1 plus exp x) computed stably avoids overflow. The test recomputes every logit and loss independently and checks that at zero logit every term equals log two.",
        complexityRationale:
            "The N by N logits come from N squared dot products of dimension d, and each softplus is constant work, so the cost is O(N squared times d) with O(N squared) storage for the matrix.",
        uses: [
            "Training multilingual image-text encoders at large batch sizes",
            "Zero-shot image classification and retrieval",
            "Multimodal representation learning without a global softmax",
        ],
        references: [
            "Zhai et al., Sigmoid Loss for Language Image Pre-Training, 2023",
            "Radford et al., Learning Transferable Visual Models From Natural Language Supervision, 2021",
        ],
        workedExample:
            "With image (1,0), text (0.9,0.1), scale one, and bias minus 0.1, the matching logit is about 0.8 and its loss is softplus of minus 0.8, roughly 0.52. A mismatched pair with logit minus 0.8 gets the same loss with the sign flipped, so training separates them.",
    },
    id: "siglip",
    name: "Sigmoid Language-Image Pretraining",
    category: "ml-ai",
    complexity: { time: "O(N^2 * d)", space: "O(N^2)" },
    defaultInput: {
        images: [
            [1, 0],
            [0, 1],
            [-1, 0],
        ],
        texts: [
            [0.9, 0.1],
            [0.1, 0.9],
            [-0.9, 0.1],
        ],
        bias: -0.1,
        logScale: 0,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize a learnable logit scale and bias",
        "for each image and text compute the scaled dot product plus bias",
        "assign label plus one to matching pairs and minus one otherwise",
        "compute softplus of minus label times logit for each pair",
        "average all pair losses over the batch matrix",
        "highlight the matching logits and their contributions",
        "record the logit matrix and the mean loss",
        "done: report the sigmoid pretraining loss",
    ],
};

export default module;
