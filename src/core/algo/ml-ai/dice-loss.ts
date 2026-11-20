/**
 * dice-loss.ts - Soft Dice Loss
 *
 * The Dice coefficient measures overlap between two sets as 2*|A n B| / (|A|+|B|).
 * Soft Dice replaces the sets with probability maps: overlap is the sum of
 * elementwise products, and the sizes are the sums of each map. Dice loss is
 * one minus the smoothed coefficient, and is widely used for image segmentation.
 *
 * Time O(n) for maps of length n, space O(1) beyond the frame entities.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface DiceResult {
    intersection: number;
    denominator: number;
    dice: number;
    loss: number;
}

/** Compute soft Dice overlap and loss for two equal-length probability maps. */
export function diceFor(prediction: number[], truth: number[], eps = 1e-6): DiceResult {
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
    const denominator = predSum + truthSum + eps;
    const dice = (2 * intersection + eps) / denominator;
    return { intersection, denominator, dice, loss: 1 - dice };
}

function makeCells(prediction: number[], truth: number[], result: DiceResult, revealed: number, current: number): VisualEntity[] {
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
    void result;
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
    const result = diceFor(prediction, truth);
    const rows = Math.min(prediction.length, truth.length);
    const metaBase = { rows, cols: 4, dice: result.dice, intersection: result.intersection };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(prediction, truth, result, -1, -1),
        edges: [],
        description: `Soft Dice loss over ${rows} pixels: accumulate elementwise overlap between prediction and truth.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, loss: result.loss },
    };
    step += 1;

    for (let i = 0; i < rows; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(prediction, truth, result, i, i),
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
        entities: makeCells(prediction, truth, result, rows - 1, -1),
        edges: [],
        description: `Done: Dice coefficient ${result.dice.toFixed(4)}, so Dice loss ${result.loss.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, loss: result.loss, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Segmentation cares about how much of a region is covered, not just per-pixel accuracy. Dice measures twice the overlap divided by the total mass in both maps, so it directly rewards agreement on the foreground. Soft Dice applies that formula to probabilities, making it differentiable for training.",
        invariants: [
            "Overlap is the sum of elementwise products of prediction and truth.",
            "The soft Dice coefficient is (2*overlap + eps) / (sum(p) + sum(t) + eps).",
            "Dice loss is one minus the coefficient and is nonnegative for maps in [0, 1].",
        ],
        correctness:
            "The coefficient is computed directly from its definition with a small epsilon for stability when both maps are empty. If prediction and truth are the same binary mask, overlap equals each sum and the coefficient is one, so the loss is zero; for fractional probabilities the soft coefficient is below one even when the maps match, approaching one as the probabilities saturate. Because overlap is at most the smaller of the two sums, 2*overlap is at most their total, so the coefficient never exceeds one and the loss never goes negative. The tests compare against a brute-force summation, check the identical binary-mask case, the empty-map behavior, and the zero lower bound.",
        complexityRationale:
            "One pass over the n pixels accumulates the three sums, so the computation is O(n) time and uses O(1) extra space.",
        uses: [
            "Semantic and medical image segmentation",
            "Losses for imbalanced foreground regions",
            "Evaluation of overlap between predicted masks",
        ],
        references: [
            "Dice, Measures of the Amount of Ecologic Association Between Species, 1945",
            "Milletari, Navab, and Ahmadi, V-Net, 3DV 2016",
        ],
        workedExample:
            "For prediction [0.9, 0.8, 0.2, 0.1] and truth [1, 1, 0, 0], the overlap is 1.7, the sums are 2.0 and 2.0, so Dice is 3.4/4.0 = 0.85 and the loss is 0.15. Identical binary masks give Dice 1 and loss 0.",
    },
    id: "dice-loss",
    name: "Soft Dice Loss",
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
        "compute Dice as twice the overlap over the sum of both sums",
        "set the loss to one minus the Dice coefficient",
        "done: report the Dice coefficient and Dice loss",
    ],
};

export default module;
