/**
 * conservative-q-learning.ts - Conservative Q-Learning Penalty
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Conservative Q-Learning adds a regularizer to the Bellman error that pushes
 * down Q-values for actions absent from the dataset and keeps in-distribution
 * values anchored. The penalty is the log-sum-exp of all action Q-values minus
 * the mean Q-value of the dataset actions. Because log-sum-exp exceeds the
 * mean whenever values differ, the penalty is nonnegative and grows when out-
 * of-distribution actions are overestimated, which is the failure mode offline
 * reinforcement learning must avoid.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(a) for a candidate actions including dataset actions
 *   Space: O(a) for the combined Q-value list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show dataset Q-values and out-of-distribution Q-values.
 *   - Dataset actions are green; out-of-distribution actions are highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    inDistribution?: number[];
    outOfDistribution?: number[];
    targets?: number[];
    alpha?: number;
}

function logSumExp(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    const max = Math.max(...values);
    return max + Math.log(values.reduce((sum, value) => sum + Math.exp(value - max), 0));
}

function makeBars(inDist: number[], ood: number[]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    inDist.forEach((value, i) => {
        entities.push({
            id: `bar-data-${i}`,
            type: "bar",
            label: value.toFixed(2),
            value,
            state: "sorted",
            x: i,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, source: "data", value },
        });
    });
    ood.forEach((value, i) => {
        entities.push({
            id: `bar-ood-${i}`,
            type: "bar",
            label: value.toFixed(2),
            value,
            state: "highlight",
            x: inDist.length + i,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: inDist.length + i, source: "ood", value },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const inDist = (task.inDistribution ?? [1, 2, 3]).slice();
    const ood = (task.outOfDistribution ?? [5, 6]).slice();
    const targets = (task.targets ?? [1.5, 2.5, 2.8]).slice();
    const alpha = typeof task.alpha === "number" ? task.alpha : 1;
    const all = [...inDist, ...ood];
    const lse = logSumExp(all);
    const dataMean = inDist.length > 0 ? inDist.reduce((a, v) => a + v, 0) / inDist.length : 0;
    const penalty = lse - dataMean;
    let squaredError = 0;
    const mseCount = Math.min(inDist.length, targets.length);
    for (let i = 0; i < mseCount; i += 1) {
        squaredError += ((inDist[i] ?? 0) - (targets[i] ?? 0)) ** 2;
    }
    const mse = mseCount > 0 ? squaredError / mseCount : 0;
    const loss = mse + alpha * penalty;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(inDist, ood),
        edges: [],
        description: `Evaluate the conservative penalty on ${inDist.length} dataset and ${ood.length} unseen actions.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: all.length, alpha, actions: all.length, lse: 0, penalty: 0, mse: 0, loss: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(inDist, ood),
        edges: [],
        description: `Log-sum-exp over all ${all.length} candidate Q-values is ${lse.toFixed(4)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { rows: 1, cols: all.length, alpha, lse: Number(lse.toFixed(6)), penalty: 0, mse: 0, loss: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(inDist, ood),
        edges: [],
        description: `Subtract the dataset mean ${dataMean.toFixed(4)} for a conservative penalty of ${penalty.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { rows: 1, cols: all.length, alpha, lse: Number(lse.toFixed(6)), dataMean: Number(dataMean.toFixed(6)), penalty: Number(penalty.toFixed(6)), mse: 0, loss: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(inDist, ood),
        edges: [],
        description: `Bellman mean-squared error is ${mse.toFixed(4)} against the dataset targets.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { rows: 1, cols: all.length, alpha, penalty: Number(penalty.toFixed(6)), mse: Number(mse.toFixed(6)), loss: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(inDist, ood),
        edges: [],
        description: `Done: total loss ${loss.toFixed(4)} equals the Bellman error plus alpha times the conservative penalty.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { rows: 1, cols: all.length, alpha, lse: Number(lse.toFixed(6)), penalty: Number(penalty.toFixed(6)), mse: Number(mse.toFixed(6)), loss: Number(loss.toFixed(6)) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Offline reinforcement learning cannot try new actions, so a learned critic often assigns huge values to actions it never saw. Conservative Q-Learning fights this by adding a soft maximum over all actions and subtracting the average value of the actions actually in the data. Overestimated unseen actions raise the soft maximum and are pushed down, making the critic pessimistic where evidence is missing.",
        invariants: [
            "Log-sum-exp is always at least the maximum and at least the arithmetic mean of its inputs.",
            "The conservative penalty is nonnegative whenever Q-values are not all identical.",
            "The total loss is the Bellman mean-squared error plus alpha times the penalty.",
        ],
        correctness:
            "Writing m for the maximum Q-value, log-sum-exp equals m plus log of a sum of at least one term equal to one, so it is at least m and therefore at least the dataset mean when the unseen actions are larger. Raising an out-of-distribution Q-value increases log-sum-exp and hence the loss, so gradient descent lowers exactly those unsupported values. When all Q-values are equal, log-sum-exp equals that value plus log(a) and the penalty reduces to a constant offset.",
        complexityRationale:
            "The stabilized log-sum-exp scans all a candidate Q-values once for the maximum and once for the exponential sum; the Bellman error scans the dataset actions once, so the whole penalty evaluation is O(a) time and O(a) space for the combined list.",
        uses: [
            "Offline reinforcement learning from fixed logs",
            "Safe policy improvement in recommendation systems",
            "Robot learning from recorded demonstrations",
        ],
        references: [
            "Kumar et al., Conservative Q-Learning for Offline Reinforcement Learning, NeurIPS 2020",
            "Sutton & Barto, Reinforcement Learning: An Introduction, Chapter 11",
        ],
        workedExample:
            "With dataset Q-values [1, 2, 3] and unseen Q-values [5, 6], log-sum-exp is about 6.14 and the dataset mean is 2, giving a penalty near 4.14. With alpha 1 and a Bellman error near 0.06 the total loss is about 4.20; lowering the unseen values toward the dataset range shrinks the penalty and the loss.",
    },
    id: "conservative-q-learning",
    name: "Conservative Q-Learning",
    category: "ml-ai",
    complexity: { time: "O(a)", space: "O(a)" },
    defaultInput: {
        inDistribution: [1, 2, 3],
        outOfDistribution: [5, 6],
        targets: [1.5, 2.5, 2.8],
        alpha: 1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "collect Q-values for dataset and unseen actions",
        "compute log-sum-exp over all candidate Q-values",
        "subtract the mean dataset Q-value for the penalty",
        "compute the Bellman mean-squared error on the data",
        "add alpha times the penalty to the Bellman error",
        "done: return the conservative Q-learning loss",
    ],
};

export default module;
