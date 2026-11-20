/**
 * gradient-boosting.ts - Gradient Boosting With Residual Weak Learners
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gradient boosting builds an additive model one weak learner at a time. Each
 * new learner is fit to the residuals, that is, the part of the target the
 * current model still gets wrong. This demo uses the simplest weak learner, a
 * scaled copy of the residual itself, which makes every update exact while
 * still showing the core boosting idea: repeatedly correct the remaining error.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * n) for n training samples
 *   Space: O(n) for the prediction and residual vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per sample holds its current predicted value.
 *   - The description reports the residual and the update each round.
 *   - A falling mean squared error confirms progress.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface BoostInput {
    y?: number[];
    rounds?: number;
    learningRate?: number;
}

/** One bar per sample prediction. */
function bars(values: number[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `pred-${index}`,
        type: "bar" as const,
        label: value.toFixed(2),
        value: Number(value.toFixed(6)),
        state: "sorted" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function mse(predictions: number[], y: number[]): number {
    let total = 0;
    for (let i = 0; i < y.length; i += 1) {
        const error = (y[i] ?? 0) - (predictions[i] ?? 0);
        total += error * error;
    }
    return y.length > 0 ? total / y.length : 0;
}

/** Boost an additive model by fitting scaled residuals each round. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BoostInput | null) ?? {};
    const y: number[] = Array.isArray(task.y) && task.y.length > 0 ? task.y.slice() : [2, 4, 6, 8];
    const rounds = Math.max(1, Math.min(typeof task.rounds === "number" ? task.rounds : 4, 50));
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.5;
    const mean = y.reduce((sum, value) => sum + value, 0) / y.length;
    const predictions = new Array<number>(y.length).fill(mean);
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(predictions),
        edges: [],
        description: `Initial model predicts the mean ${mean.toFixed(3)} for all ${y.length} samples.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            predictions: predictions.map((v) => Number(v.toFixed(6))),
            residuals: y.map((v) => Number((v - mean).toFixed(6))),
            round: 0,
            mse: Number(mse(predictions, y).toFixed(8)),
        },
    };
    step += 1;

    for (let round = 0; round < rounds; round += 1) {
        const residuals = y.map((value, index) => value - (predictions[index] ?? 0));
        for (let i = 0; i < y.length; i += 1) {
            predictions[i] = (predictions[i] ?? 0) + lr * (residuals[i] ?? 0);
        }
        yield {
            stepNumber: step,
            entities: bars(predictions),
            edges: [],
            description: `Round ${round + 1}: fit residuals and add ${lr} times each; mean squared error is now ${mse(predictions, y).toFixed(4)}.`,
            codeLineNumber: round === rounds - 1 ? 6 : 4,
            layout: "array",
            meta: {
                predictions: predictions.map((v) => Number(v.toFixed(6))),
                residuals: residuals.map((v) => Number(v.toFixed(6))),
                round: round + 1,
                mse: Number(mse(predictions, y).toFixed(8)),
            },
        };
        step += 1;
    }
}

/** The gradient boosting module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Boosting does not try to fit the answer in one shot. It starts with a rough guess, looks at what is still wrong, and trains a small learner to correct that remaining error. Adding these corrections one at a time turns several weak models into a strong one.",
        invariants: [
            "The initial prediction for every sample is the mean of the targets.",
            "Each residual is the target minus the current prediction for that sample.",
            "The new prediction is the old prediction plus the learning rate times the residual.",
        ],
        correctness:
            "With a squared-error loss, the negative gradient with respect to each prediction is exactly that sample's residual. Fitting a learner to the residual and adding a scaled copy is one step of gradient descent in prediction space, so the loss decreases monotonically for a learning rate in the range from zero to one.",
        complexityRationale:
            "A round scans all n samples once to form residuals and once to update predictions, costing O(n) per round and O(rounds times n) overall. Only the prediction and residual vectors are stored, so space is O(n).",
        uses: [
            "Tabular prediction with gradient boosted decision trees",
            "Ranking and search relevance models",
            "A teaching baseline for residual-based ensemble methods",
        ],
        references: [
            "Friedman, Greedy Function Approximation: A Gradient Boosting Machine, 2001",
            "Hastie, Tibshirani, and Friedman, The Elements of Statistical Learning, 2009",
        ],
        workedExample:
            "For targets 2, 4, 6, 8 the first guess is the mean 5, leaving residuals -3, -1, 1, 3. With learning rate 0.5, one boosting round moves predictions to 3.5, 4.5, 5.5, 6.5 and cuts the mean squared error from 5 to 1.25. Further rounds keep shrinking the gap.",
    },
    id: "gradient-boosting",
    name: "Gradient Boosting",
    category: "ml-ai",
    complexity: { time: "O(rounds * n)", space: "O(n)" },
    defaultInput: { y: [2, 4, 6, 8], rounds: 4, learningRate: 0.5 },
    visualType: "array",
    run,
    pseudocode: [
        "start with the mean target as every prediction",
        "for each boosting round",
        "compute each residual as target minus prediction",
        "fit a weak learner to the residuals",
        "add the learning rate times that learner to each prediction",
        "record the mean squared error",
        "done: report the final predictions",
    ],
};

export default module;
