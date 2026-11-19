/**
 * triplet-loss.ts - Triplet Loss
 *
 * Triplet loss takes an anchor a, a positive example p of the same class, and a
 * negative example n of a different class. With squared Euclidean distance d,
 * the loss is max(0, d(a,p) - d(a,n) + margin). It pushes the positive closer
 * than the negative by at least the margin, and is the basis of metric learning
 * systems such as FaceNet.
 *
 * Time O(k*d) for k triplets of dimension d, space O(1) beyond the frames.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface TripletResult {
    positiveDistance: number;
    negativeDistance: number;
    gap: number;
    margin: number;
    loss: number;
    active: boolean;
}

/** Compute squared Euclidean distances and the triplet penalty for one triplet. */
export function tripletFor(
    anchor: number[],
    positive: number[],
    negative: number[],
    margin: number,
): TripletResult {
    let positiveDistance = 0;
    let negativeDistance = 0;
    const length = Math.min(anchor.length, positive.length, negative.length);
    for (let i = 0; i < length; i += 1) {
        const a = anchor[i] ?? 0;
        positiveDistance += (a - (positive[i] ?? 0)) ** 2;
        negativeDistance += (a - (negative[i] ?? 0)) ** 2;
    }
    const gap = positiveDistance - negativeDistance;
    const raw = gap + margin;
    return {
        positiveDistance,
        negativeDistance,
        gap,
        margin,
        loss: Math.max(0, raw),
        active: raw > 0,
    };
}

function makeCells(results: TripletResult[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const columns = ["d(a,p)", "d(a,n)", "gap", "loss"];
    results.forEach((result, row) => {
        const values = [result.positiveDistance, result.negativeDistance, result.gap, result.loss];
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
    const task = (
        input as { anchors?: number[][]; positives?: number[][]; negatives?: number[][]; margin?: number } | null
    ) ?? {};
    const anchors: number[][] = Array.isArray(task.anchors) && task.anchors.length > 0
        ? task.anchors
        : [[0, 0], [1, 1], [2, 0], [0, 3]];
    const positives: number[][] = Array.isArray(task.positives) && task.positives.length === anchors.length
        ? task.positives
        : [[0.2, 0.1], [1.1, 0.9], [2.2, 0.1], [0.1, 2.8]];
    const negatives: number[][] = Array.isArray(task.negatives) && task.negatives.length === anchors.length
        ? task.negatives
        : [[3, 0], [3, 3], [0, 0], [3, 3]];
    const margin = typeof task.margin === "number" && task.margin >= 0 ? task.margin : 0.5;
    const results = anchors.map((a, i) => tripletFor(a, positives[i] ?? [], negatives[i] ?? [], margin));
    const losses = results.map((r) => r.loss);
    const mean = losses.reduce((a, b) => a + b, 0) / (losses.length || 1);
    const active = results.filter((r) => r.active).length;
    const metaBase = { rows: results.length, cols: 4, margin, mean, active };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, -1, -1),
        edges: [],
        description: `Triplet loss on ${results.length} triplets with margin ${margin}: enforce a gap between positive and negative distances.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, losses },
    };
    step += 1;

    for (let i = 0; i < results.length; i += 1) {
        const r = results[i];
        yield {
            stepNumber: step,
            entities: makeCells(results, i, i),
            edges: [],
            description: `Triplet ${i}: d(a,p)=${(r?.positiveDistance ?? 0).toFixed(3)}, d(a,n)=${(r?.negativeDistance ?? 0).toFixed(3)}, gap ${(r?.gap ?? 0).toFixed(3)}, loss ${(r?.loss ?? 0).toFixed(4)}${r?.active ? " - constraint violated" : " - satisfied"}.`,
            codeLineNumber: r?.active ? 4 : 3,
            layout: "grid",
            meta: { ...metaBase, current: i, losses },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, results.length - 1, -1),
        edges: [],
        description: `Done: mean triplet loss ${mean.toFixed(4)} with ${active} violated constraint(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...metaBase, losses, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Metric learning wants similar items close together in embedding space and dissimilar items far apart. A triplet fixes an anchor, one positive of the same class, and one negative of another class. The loss only cares when the negative is not already farther than the positive by a margin, so satisfied triplets stop contributing and training focuses on hard cases.",
        invariants: [
            "Distances are squared Euclidean sums over the embedding dimensions.",
            "The gap is the positive distance minus the negative distance.",
            "The loss is max(0, gap + margin) and is always nonnegative.",
        ],
        correctness:
            "The distances and the final maximum are evaluated directly from the definition. The loss is zero exactly when the negative is closer to the anchor than the positive by at least the margin, which is the desired constraint. Because of the maximum it is convex in the distances and its gradient vanishes on satisfied triplets, so easy examples do not move the embedding. Increasing the margin strictly raises the loss on any violated triplet. The tests compare against a brute-force distance computation and check the zero region, margin monotonicity, and nonnegativity.",
        complexityRationale:
            "Each triplet scans d dimensions twice to compute the two squared distances, so k triplets cost O(k*d) time and only constant extra space.",
        uses: [
            "Face recognition embeddings such as FaceNet",
            "Metric learning for nearest-neighbor retrieval",
            "Signature and product similarity models",
        ],
        references: [
            "Schroff, Kalenichenko, and Philbin, FaceNet, CVPR 2015",
            "Chechik et al., Learning with Multiple Pairwise Constraints, ICML 2010",
        ],
        workedExample:
            "If the positive distance is 0.1 and the negative distance is 2.0 with margin 0.5, the gap is -1.9 and the loss is max(0, -1.4) = 0, so the constraint is satisfied. If the negative distance is only 0.3, the gap is -0.2 and the loss is 0.3, nudging the embedding to separate them.",
    },
    id: "triplet-loss",
    name: "Triplet Loss",
    category: "ml-ai",
    complexity: { time: "O(k * d)", space: "O(1)" },
    defaultInput: {
        anchors: [[0, 0], [1, 1], [2, 0], [0, 3]],
        positives: [[0.2, 0.1], [1.1, 0.9], [2.2, 0.1], [0.1, 2.8]],
        negatives: [[3, 0], [3, 3], [0, 0], [3, 3]],
        margin: 0.5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each anchor with one positive and one negative example",
        "sum squared differences between anchor and positive",
        "sum squared differences between anchor and negative",
        "compute the gap as positive distance minus negative distance",
        "set the loss to the maximum of zero and gap plus margin",
        "accumulate the losses and count violated constraints",
        "done: report the mean triplet loss",
    ],
};

export default module;
