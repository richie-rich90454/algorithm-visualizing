/**
 * focal-loss.ts - Focal Loss for Imbalanced Classification
 *
 * Focal loss multiplies cross-entropy by (1 - p_t)^gamma so that easy,
 * high-confidence examples contribute little and hard, low-confidence
 * examples dominate the gradient. An optional alpha factor reweights classes.
 * This is the exact scalar loss used per example in dense detectors.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface FocalResult {
    probability: number;
    crossEntropy: number;
    modulating: number;
    focal: number;
}

/** Compute cross-entropy, the modulating factor, and focal loss for one example. */
export function focalFor(p: number, label: number, gamma: number, alpha: number, eps = 1e-12): FocalResult {
    const prob = Math.max(eps, Math.min(1 - eps, p));
    const crossEntropy = -Math.log(prob);
    const modulating = Math.pow(1 - prob, gamma);
    const alphaT = label > 0 ? alpha : 1 - alpha;
    return { probability: prob, crossEntropy, modulating, focal: alphaT * modulating * crossEntropy };
}

function makeCells(results: FocalResult[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const columns = ["p", "CE", "(1-p)^g", "FL"];
    results.forEach((result, row) => {
        const values = [result.probability, result.crossEntropy, result.modulating, result.focal];
        columns.forEach((label, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === current ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${label} ${(values[col] ?? 0).toFixed(4)}` : "?",
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
        input as {
            probabilities?: number[];
            labels?: number[];
            gamma?: number;
            alpha?: number;
        } | null
    ) ?? {};
    const probabilities: number[] = Array.isArray(task.probabilities) && task.probabilities.length > 0
        ? task.probabilities
        : [0.95, 0.9, 0.6, 0.3, 0.1, 0.02];
    const labels: number[] = Array.isArray(task.labels) && task.labels.length === probabilities.length
        ? task.labels
        : probabilities.map((_p, i) => (i % 2));
    const gamma = typeof task.gamma === "number" ? Math.max(0, task.gamma) : 2;
    const alpha = typeof task.alpha === "number" ? Math.max(0, Math.min(1, task.alpha)) : 0.25;
    const results = probabilities.map((p, i) => focalFor(p, labels[i] ?? 0, gamma, alpha));
    const mean = results.reduce((sum, r) => sum + r.focal, 0) / (results.length || 1);
    const metaBase = { rows: results.length, cols: 4, gamma, alpha, mean };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, -1, -1),
        edges: [],
        description: `Focal loss on ${results.length} examples with gamma=${gamma}, alpha=${alpha}: down-weight confident predictions.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, losses: results.map((r) => r.focal) },
    };
    step += 1;

    for (let i = 0; i < results.length; i += 1) {
        const r = results[i];
        yield {
            stepNumber: step,
            entities: makeCells(results, i, i),
            edges: [],
            description: `Example ${i}: p=${(r?.probability ?? 0).toFixed(3)}, CE=${(r?.crossEntropy ?? 0).toFixed(4)}, factor=${(r?.modulating ?? 0).toFixed(4)}, FL=${(r?.focal ?? 0).toFixed(4)}.`,
            codeLineNumber: i === 0 ? 1 : 2,
            layout: "grid",
            meta: { ...metaBase, current: i, losses: results.map((v) => v.focal) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, results.length - 1, -1),
        edges: [],
        description: `Done: mean focal loss over the batch is ${mean.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...metaBase, losses: results.map((r) => r.focal), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "In imbalanced datasets, the many easy negatives can swamp the rare positives. Focal loss keeps the usual cross-entropy but scales it by (1 - p_t)^gamma: when the model is already confident and correct, that factor is near zero; when it is wrong or unsure, the factor is near one. Hard examples therefore drive learning.",
        invariants: [
            "The modulating factor (1 - p_t)^gamma is in [0, 1] for gamma >= 0.",
            "With gamma = 0 the loss reduces to alpha-weighted cross-entropy.",
            "For a fixed label, focal loss never exceeds the corresponding cross-entropy when alpha = 1.",
        ],
        correctness:
            "The loss is defined directly as -alpha_t*(1-p_t)^gamma*log(p_t), so each value is an exact evaluation of the definition. Setting gamma to zero removes the factor and alpha to one removes class weighting, recovering cross-entropy; because the factor is at most one, focal loss is bounded above by cross-entropy, and increasing confidence strictly lowers the loss for gamma > 0. The property tests verify each of these identities.",
        complexityRationale:
            "Each of the n examples needs a logarithm and a power, both constant time, giving O(n) time and O(n) stored per-example losses.",
        uses: [
            "Training dense object detectors such as RetinaNet",
            "Severely imbalanced classification with many easy negatives",
            "Any setting where hard examples should dominate the loss",
        ],
        references: [
            "Lin et al., Focal Loss for Dense Object Detection, ICCV 2017",
            "Goodfellow et al., Deep Learning, Chapter 6, 2016",
        ],
        workedExample:
            "With gamma=2 and alpha=1, an easy positive with p=0.95 has cross-entropy about 0.051 and factor 0.0025, so focal loss is about 0.00013. A hard positive with p=0.3 has cross-entropy about 1.20 and factor 0.49, so focal loss is about 0.59, giving the hard example over four thousand times more weight.",
    },
    id: "focal-loss",
    name: "Focal Loss",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        probabilities: [0.95, 0.9, 0.6, 0.3, 0.1, 0.02],
        labels: [1, 0, 1, 0, 1, 0],
        gamma: 2,
        alpha: 0.25,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each example take the predicted probability of the true class",
        "compute cross-entropy as negative log of that probability",
        "compute the modulating factor as (1-p) raised to gamma",
        "compute the class weight alpha for positives and one minus alpha for negatives",
        "multiply the three terms to get the focal loss",
        "average the focal losses over the batch",
        "done: report the per-example losses and the mean",
    ],
};

export default module;
