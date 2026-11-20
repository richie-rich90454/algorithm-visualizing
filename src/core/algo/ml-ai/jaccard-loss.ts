/**
 * jaccard-loss.ts - Soft Jaccard (IoU) Loss
 *
 * The Jaccard index, or intersection over union, is |A n B| / |A u B|. Soft
 * Jaccard replaces set cardinality with sums of probability maps and union with
 * sum(p) + sum(t) - sum(p*t). Jaccard loss is one minus this soft IoU and is a
 * common segmentation objective related to Dice loss but not identical to it.
 *
 * Time O(n) for maps of length n, space O(1) beyond the frame entities.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface JaccardResult {
    intersection: number;
    union: number;
    iou: number;
    loss: number;
}

/** Compute soft intersection over union and its loss for two probability maps. */
export function jaccardFor(prediction: number[], truth: number[], eps = 1e-6): JaccardResult {
    const length = Math.min(prediction.length, truth.length);
    let intersection = 0;
    let predSum = 0;
    let truthSum = 0;
    for (let i = 0; i < length; i += 1) {
        const p = prediction[i] ?? 0;
        const t = truth[i] ?? 0;
        intersection += p * t;
        predSum += p;
        truthSum += t;
    }
    const union = predSum + truthSum - intersection + eps;
    const iou = (intersection + eps) / union;
    return { intersection, union, iou, loss: 1 - iou };
}

function makeCells(prediction: number[], truth: number[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const columns = ["index", "pred", "truth", "product"];
    prediction.forEach((p, row) => {
        const t = truth[row] ?? 0;
        const values = [row, p, t, p * t];
        columns.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === current ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${column} ${(values[col] ?? 0).toFixed(3)}` : "?",
                value: shown ? (values[col] ?? 0) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { prediction?: number[]; truth?: number[] } | null) ?? {};
    const prediction: number[] = Array.isArray(task.prediction) && task.prediction.length > 0
        ? task.prediction
        : [0.9, 0.8, 0.2, 0.1, 0.7, 0.05];
    const truth: number[] = Array.isArray(task.truth) && task.truth.length === prediction.length
        ? task.truth
        : [1, 1, 0, 0, 1, 0];
    const result = jaccardFor(prediction, truth);
    const rows = Math.min(prediction.length, truth.length);
    const metaBase = { rows, cols: 4, iou: result.iou, intersection: result.intersection };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(prediction, truth, -1, -1),
        edges: [],
        description: `Soft Jaccard loss over ${rows} pixels: accumulate overlap and union of prediction and truth.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, loss: result.loss },
    };
    step += 1;

    for (let i = 0; i < rows; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(prediction, truth, i, i),
            edges: [],
            description: `Pixel ${i}: prediction ${(prediction[i] ?? 0).toFixed(3)}, truth ${(truth[i] ?? 0).toFixed(3)}, overlap product ${((prediction[i] ?? 0) * (truth[i] ?? 0)).toFixed(3)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...metaBase, current: i, loss: result.loss },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(prediction, truth, rows - 1, -1),
        edges: [],
        description: `Done: IoU ${result.iou.toFixed(4)}, so Jaccard loss ${result.loss.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, loss: result.loss, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Jaccard, better known as intersection over union, asks what fraction of the combined foreground of two masks they actually share. Soft Jaccard applies that ratio to probabilities. It is stricter than Dice because the union counts disagreement, so it penalizes false positives and false negatives more evenly.",
        invariants: [
            "Overlap is the sum of elementwise products of prediction and truth.",
            "The soft union is sum(p) + sum(t) - overlap.",
            "Jaccard loss is one minus overlap over union and is nonnegative for maps in [0, 1].",
        ],
        correctness:
            "The ratio is computed from the definition with a small epsilon for empty masks. When prediction and truth are the same binary mask, overlap equals each sum and the union equals that same sum, so IoU is one and the loss is zero; with fractional probabilities the soft IoU is below one even for matching maps. Overlap never exceeds the union for maps in [0, 1], keeping IoU in [0, 1] and the loss nonnegative. For the same maps, IoU is never larger than Dice, so Jaccard loss is at least Dice loss; the tests verify this relationship, a brute-force summation, the identical binary-mask case, and the lower bound.",
        complexityRationale:
            "A single pass over n pixels accumulates overlap and the two sums, so the work is O(n) time and O(1) extra space.",
        uses: [
            "Object-detection evaluation by intersection over union",
            "Segmentation training with IoU-based objectives",
            "Any metric that rewards set overlap",
        ],
        references: [
            "Jaccard, Etude de la Distribution Floraque, 1901",
            "Rahman and Wang, Optimizing Intersection-Over-Union in Deep Neural Networks, 2016",
        ],
        workedExample:
            "For prediction [0.9, 0.8, 0.2, 0.1] and truth [1, 1, 0, 0], overlap is 1.7 and union is 2.0 + 2.0 - 1.7 = 2.3, so IoU is about 0.739 and the loss about 0.261. Dice on the same maps gives 0.85, so Jaccard's penalty is larger. Identical binary masks give IoU 1 and loss 0.",
    },
    id: "jaccard-loss",
    name: "Soft Jaccard Loss",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: {
        prediction: [0.9, 0.8, 0.2, 0.1, 0.7, 0.05],
        truth: [1, 1, 0, 0, 1, 0],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize overlap and the two sums to zero",
        "for each pixel add prediction times truth to the overlap",
        "add the prediction to the first sum and the truth to the second",
        "compute the union as the two sums minus the overlap",
        "compute intersection over union as overlap divided by union",
        "set the loss to one minus that ratio",
        "done: report the IoU and Jaccard loss",
    ],
};

export default module;
