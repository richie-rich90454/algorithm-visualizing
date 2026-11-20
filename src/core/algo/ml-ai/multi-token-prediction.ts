/**
 * multi-token-prediction.ts - Multi-Token Prediction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Multi-token prediction trains a language model to predict several future
 * tokens at once. A shared trunk produces a context vector, and a sequence of
 * lightweight heads consumes that context plus previously predicted tokens to
 * forecast the next token at each offset. The training loss averages the
 * cross-entropy of all heads, giving a denser signal than next-token-only
 * training.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(K * V) for K heads and a vocabulary of V scores
 *   Space: O(K) for the per-head losses
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the cross-entropy loss produced by each prediction head.
 *   - The final frame reports the mean loss across all heads.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MtpInput {
    logits?: number[][];
    targets?: number[];
}

/** Numerically stable softmax of a logit array. */
export function softmax(logits: number[]): number[] {
    if (logits.length === 0) return [];
    const max = Math.max(...logits);
    const exps = logits.map((v) => Math.exp(v - max));
    const total = exps.reduce((a, b) => a + b, 0);
    return total === 0 ? exps.map(() => 0) : exps.map((v) => v / total);
}

/** Cross-entropy of a single head's softmax against a target index. */
export function crossEntropy(logits: number[], target: number): number {
    const probs = softmax(logits);
    const p = probs[target] ?? 0;
    return -Math.log(Math.max(1e-12, p));
}

/** Per-head cross-entropies and their mean for multi-token prediction. */
export function mtpLoss(logitsPerHead: number[][], targets: number[]) {
    const perHead = logitsPerHead.map((logits, k) => crossEntropy(logits, targets[k] ?? 0));
    const mean = perHead.length === 0 ? 0 : perHead.reduce((a, b) => a + b, 0) / perHead.length;
    return { perHead, mean };
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `head-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MtpInput | null) ?? {};
    const logitsPerHead: number[][] = task.logits ?? [
        [2, 0.5, -1],
        [1, 3, 0],
        [0, 1, 4],
    ];
    const targets: number[] = task.targets ?? [0, 1, 2];
    const { perHead, mean } = mtpLoss(logitsPerHead, targets);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(logitsPerHead.map((l) => l.length), logitsPerHead.map(() => "idle")),
        edges: [],
        description: `${logitsPerHead.length} prediction heads forecast successive future tokens.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "setup", perHead: [], mean: 0, targets },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(perHead, perHead.map(() => "comparing")),
        edges: [],
        description: "Compute softmax cross-entropy for every head at its target token.",
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "loss", perHead, mean: 0, targets },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(perHead, perHead.map((_, i) => (i === perHead.indexOf(Math.min(...perHead)) ? "active" : "sorted"))),
        edges: [],
        description: `Mean multi-token loss across heads is ${mean.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "mean", perHead, mean, targets },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(perHead, perHead.map(() => "sorted")),
        edges: [],
        description: `Done: the shared trunk trains on all ${perHead.length} future-token losses.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "done", perHead, mean, targets, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Next-token training extracts only one bit of supervision per position. Multi-token prediction adds extra heads that must also guess the second, third and later tokens, all from a shared representation. The richer signal helps the model plan ahead and often improves both training efficiency and generation quality.",
        invariants: [
            "Each head has a softmax distribution over the full vocabulary.",
            "A head's loss is the negative log probability assigned to its target token.",
            "The reported loss is the arithmetic mean of all head losses.",
        ],
        correctness:
            "Softmax with a shifted maximum gives a valid probability distribution without overflow. Negative log of the target probability is the standard cross-entropy for a one-hot target. Averaging the per-head losses yields the multi-token objective, and the loss is minimized exactly when every head assigns probability one to its correct future token, so optimizing it drives all predictions toward their targets.",
        complexityRationale:
            "Each of the K heads exponentiates V logits and reduces them, costing O(V) per head and O(K V) overall. Only the K per-head losses need to be stored, using O(K) space.",
        uses: [
            "Dense supervision in large language model pretraining",
            "Improving long-horizon coherence in generation",
            "Auxiliary losses for faster convergence",
        ],
        references: [
            "Gloeckle et al., Better & Faster Large Language Models via Multi-token Prediction, NeurIPS 2024",
            "LeCun and Huang, Prediction-Based Learning, 2005",
        ],
        workedExample:
            "With three heads whose correct-token logits are 2, 3 and 4 against rivals near zero, the softmax probabilities are high, so cross-entropies are small, roughly 0.3, 0.2 and 0.1. Their mean is about 0.2, far lower than a head that assigns its target low probability.",
    },
    id: "multi-token-prediction",
    name: "Multi-Token Prediction",
    category: "ml-ai",
    complexity: { time: "O(K * V)", space: "O(K)" },
    defaultInput: {
        logits: [[2, 0.5, -1], [1, 3, 0], [0, 1, 4]],
        targets: [0, 1, 2],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the per-head logits and their target token indices",
        "have the shared trunk produce a context vector",
        "for each head form a softmax over the vocabulary",
        "take the negative log probability of its target token",
        "average the head losses into the training objective",
        "done: report every head loss and their mean",
    ],
};

export default module;
