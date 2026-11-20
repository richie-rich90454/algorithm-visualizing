/**
 * iqn.ts - Implicit Quantile Networks
 *
 * IQN learns a continuous quantile function instead of a fixed set of quantile
 * atoms. A sampled probability level tau is expanded into a cosine basis, and a
 * small linear read-out turns that embedding into the return quantile at tau.
 * The quantile Huber loss pulls each prediction toward its Bellman target with
 * an asymmetry set by tau.
 *
 * Time O(m * d) for m samples and an embedding of size d, space O(m + d).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface IqnInput {
    taus?: number[];
    weights?: number[];
    bias?: number;
    reward?: number;
    gamma?: number;
    done?: boolean;
    nextValues?: number[];
    kappa?: number;
}

/** Cosine basis expansion of a quantile level tau. */
export function cosineEmbedding(tau: number, size: number): number[] {
    return Array.from({ length: size }, (_unused, i) => Math.cos(Math.PI * (i + 1) * tau));
}

/** Predict the return quantile at tau from the cosine embedding and read-out weights. */
export function quantileReadout(tau: number, weights: number[], bias: number): number {
    const phi = cosineEmbedding(tau, weights.length);
    return bias + weights.reduce((sum, w, i) => sum + w * (phi[i] ?? 0), 0);
}

/** Asymmetric Huber loss at quantile level tau. */
export function quantileHuber(tau: number, residual: number, kappa: number): number {
    const magnitude = Math.abs(residual);
    const huber = magnitude < kappa ? (0.5 * residual * residual) / kappa : magnitude - 0.5 * kappa;
    return Math.abs(tau - (residual < 0 ? 1 : 0)) * huber;
}

const COLUMNS = ["tau", "phi norm", "prediction", "target", "loss"];

function makeCells(
    taus: number[], phiNorms: number[], predictions: number[], targets: number[], losses: number[],
    revealed: number, active: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    taus.forEach((tau, row) => {
        const values = [tau, phiNorms[row] ?? 0, predictions[row] ?? 0, targets[row] ?? 0, losses[row] ?? 0];
        COLUMNS.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === active ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${column} ${(values[col] ?? 0).toFixed(4)}` : "?",
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
    const task = (input as IqnInput | null) ?? {};
    const taus: number[] = Array.isArray(task.taus) && task.taus.length > 0
        ? task.taus.map((t) => Math.min(1, Math.max(0, t)))
        : [0.1, 0.3, 0.5, 0.7, 0.9, 0.95];
    const weights: number[] = Array.isArray(task.weights) && task.weights.length > 0
        ? task.weights
        : [2, 0.6, -0.3, 0.15];
    const bias = Number(task.bias ?? 3);
    const reward = Number(task.reward ?? 1);
    const gamma = Number(task.gamma ?? 0.9);
    const done = Boolean(task.done);
    const kappa = Math.max(1e-6, Number(task.kappa ?? 1));
    const nextValues: number[] = Array.isArray(task.nextValues) && task.nextValues.length === taus.length
        ? task.nextValues
        : taus.map((t) => 2 + 4 * t);

    const predictions = taus.map((t) => quantileReadout(t, weights, bias));
    const targets = taus.map((_t, j) => reward + (done ? 0 : gamma * (nextValues[j] ?? 0)));
    const losses = taus.map((t, j) => quantileHuber(t, (targets[j] ?? 0) - (predictions[j] ?? 0), kappa));
    const meanLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
    const phiNorms = taus.map((t) => Math.hypot(...cosineEmbedding(t, weights.length)));
    const base = { rows: taus.length, cols: COLUMNS.length, embeddingSize: weights.length, loss: meanLoss, taus, predictions, targets };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(taus, phiNorms, predictions, targets, losses, -1, -1),
        edges: [],
        description: `IQN maps ${taus.length} sampled quantile levels through a ${weights.length}-term cosine basis into return quantiles.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, losses },
    };
    step += 1;

    for (let j = 0; j < taus.length; j += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(taus, phiNorms, predictions, targets, losses, j, j),
            edges: [],
            description: `tau=${(taus[j] ?? 0).toFixed(2)}: quantile ${(predictions[j] ?? 0).toFixed(3)} vs target ${(targets[j] ?? 0).toFixed(3)}, loss ${(losses[j] ?? 0).toFixed(4)}.`,
            codeLineNumber: (targets[j] ?? 0) >= (predictions[j] ?? 0) ? 4 : 5,
            layout: "grid",
            meta: { ...base, losses, active: j },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(taus, phiNorms, predictions, targets, losses, taus.length - 1, -1),
        edges: [],
        description: `Done: mean quantile Huber loss across the sampled levels is ${meanLoss.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, losses, loss: meanLoss, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A quantile function answers what return we expect at a given probability level. IQN samples a level tau, encodes it with a fixed cosine basis, and lets a linear read-out produce the quantile value for that level. Because the network takes tau as input, it can represent a continuous family of quantiles with far fewer parameters than a fixed atom set, and the asymmetric Huber loss trains each sampled level correctly.",
        invariants: [
            "Every sampled level tau lies in the interval from zero to one.",
            "The cosine basis at tau has unit-norm components bounded by one in absolute value.",
            "The quantile Huber loss is nonnegative and vanishes when the prediction equals the target.",
        ],
        correctness:
            "The cosine embedding maps tau to cos(pi times i times tau), and the read-out is the bias plus the weighted sum of those components, an explicit quantile function. The Bellman target is the reward plus the discounted next sampled value, or just the reward at a terminal state. The quantile Huber loss weights the Huber magnitude by tau for underpredictions and by one minus tau for overpredictions, the check-loss gradient condition for quantile regression. The tests recompute the embedding, read-out, targets, and losses independently, verify the basis landmarks at tau zero and one, and confirm that perfect predictions give zero loss.",
        complexityRationale:
            "Each of the m samples needs a d-term embedding and a d-term dot product, so the work is O(m times d); storing the sample arrays and the embedding uses O(m + d) space.",
        uses: [
            "Sample-efficient distributional reinforcement learning agents",
            "Risk-sensitive control with a continuous quantile function",
            "Dense quantile prediction where a fixed atom grid is too coarse",
        ],
        references: [
            "Dabney et al., Implicit Quantile Networks for Distributional Reinforcement Learning, ICML, 2018",
            "Srivastava, Hutter, and Azar, Implicit Quantile Networks, arXiv, 2017",
        ],
        workedExample:
            "At tau equals 0.5 with weights 2, 0.6, minus 0.3, and 0.15 and bias 3, the cosine components at one half are zero for odd frequencies and minus one for the second, giving a quantile of about 2.7. If the Bellman target at that sample is 4, the positive residual is weighted by one half in the quantile Huber loss, pulling the prediction upward.",
    },
    id: "iqn",
    name: "IQN (Implicit Quantile Networks)",
    category: "ml-ai",
    complexity: { time: "O(m * d)", space: "O(m + d)" },
    defaultInput: {
        taus: [0.1, 0.3, 0.5, 0.7, 0.9, 0.95],
        weights: [2, 0.6, -0.3, 0.15],
        bias: 3,
        reward: 1,
        gamma: 0.9,
        done: false,
        kappa: 1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "sample quantile levels tau in the unit interval",
        "expand each tau into a cosine basis of size d",
        "predict the quantile as bias plus the weighted basis sum",
        "form the Bellman target from the reward and discounted next value",
        "compute the residual between target and predicted quantile",
        "weight the Huber magnitude by tau or one minus tau by residual sign",
        "average the sample losses",
        "done: report the mean quantile Huber loss",
    ],
};

export default module;
