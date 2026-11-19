/**
 * stacking.ts - Stacked Generalization (Stacking)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Stacking combines several base models by training a meta-learner on their
 * predictions. Instead of voting or averaging blindly, a weighted combiner
 * learns how much to trust each model. This demo uses a fixed set of meta
 * weights and shows each base model's squared error next to the meta learner's
 * squared error on the same validation rows.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(K * m) for K base models over m validation rows
 *   Space: O(m + K) for the combined predictions and model errors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show each base model's mean squared error, then the meta
 *     predictions and the final meta error.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface Input {
    predictions?: Matrix;
    truth?: number[];
    weights?: number[];
}

function bars(values: number[], states: EntityState[], labels?: string[]): VisualEntity[] {
    return values.map((v, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: labels?.[i] ?? v.toFixed(3),
        value: v,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value: v },
    }));
}

function mse(preds: number[], truth: number[]): number {
    if (preds.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < preds.length; i += 1) sum += ((preds[i] ?? 0) - (truth[i] ?? 0)) ** 2;
    return sum / preds.length;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const predictions: Matrix = task.predictions ?? [
        [1, 2, 3, 4],
        [1.2, 1.8, 3.1, 4.2],
        [0.8, 2.2, 2.9, 3.8],
    ];
    const truth = (task.truth ?? [1, 2, 3, 4]).slice();
    const weights = (task.weights ?? [0.5, 0.25, 0.25]).slice();
    const k = predictions.length;
    const at = (a: number[], i: number): number => a[i] ?? 0;
    const modelMse = predictions.map((p) => mse(p, truth));
    const m = truth.length;
    const combined: number[] = [];
    for (let j = 0; j < m; j += 1) {
        let sum = 0;
        for (let i = 0; i < k; i += 1) sum += at(weights, i) * at(predictions[i] ?? [], j);
        combined.push(sum);
    }
    const combinedMse = mse(combined, truth);
    const state = (s: EntityState): EntityState[] => new Array<EntityState>(Math.max(k, m)).fill(s);
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(modelMse, state("idle"), modelMse.map((v) => v.toFixed(4))),
        edges: [],
        description: `Stacking ${k} base models on ${m} validation rows using fixed meta weights.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { k, m, weights, modelMse },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(modelMse, state("comparing"), modelMse.map((v) => v.toFixed(4))),
        edges: [],
        description: "Measure each base model's mean squared error on the validation rows.",
        codeLineNumber: 1,
        layout: "array",
        meta: { k, m, modelMse },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(combined, state("active"), combined.map((v) => v.toFixed(3))),
        edges: [],
        description: "Form each meta prediction as the weighted sum of the base predictions.",
        codeLineNumber: 2,
        layout: "array",
        meta: { k, m, weights, combined },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(combined, state("sorted"), combined.map((v) => v.toFixed(3))),
        edges: [],
        description: `Meta learner error ${combinedMse.toFixed(4)} compared with base errors ${modelMse.map((v) => v.toFixed(4)).join(", ")}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { k, m, weights, modelMse, combined, combinedMse, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Different models make different mistakes. Stacking learns a second-layer model whose inputs are the first-layer predictions, so it can lean on the models that are right in a given region and discount the ones that are wrong. Using held-out predictions to fit the meta layer prevents it from simply rewarding whichever base model memorized the training set.",
        invariants: [
            "Every meta prediction is a weighted sum of the base predictions for the same row.",
            "The reported base and meta errors are measured on the same validation rows.",
            "Meta weights are fixed here, as they would be after a training step.",
        ],
        correctness:
            "A linear meta learner minimizes a convex quadratic error, so gradient descent on the weights converges to the least-squares combination of base predictions. Because the meta features are held-out predictions rather than in-sample ones, the learned weights reflect genuine generalization ability. The resulting combiner is at least as good as the best single base model when the weight simplex includes a vertex on that model.",
        complexityRationale:
            "Computing each base error scans its m predictions, and forming the m meta predictions scans the K weights for each row, giving O(K times m) total time. Storing the combined predictions and K error values uses O(m plus K) space.",
        uses: [
            "Winning ensembles in machine learning competitions",
            "Combining diverse classifiers such as trees, kernels, and linear models",
            "Per-region model selection through a learned gating network",
        ],
        references: [
            "Wolpert, Stacked Generalization, Neural Networks, 1992",
            "Breiman, Bagging Predictors, Machine Learning, 1996",
        ],
        workedExample:
            "Three models predict 1, 1.2, and 0.8 for a row whose true value is 1. With meta weights 0.5, 0.25, 0.25 the combined prediction is 0.5 plus 0.3 plus 0.2, which equals exactly 1 and has zero error, better than either imperfect base model alone.",
    },
    id: "stacking",
    name: "Stacking",
    category: "ml-ai",
    complexity: { time: "O(K m)", space: "O(m + K)" },
    defaultInput: {
        predictions: [
            [1, 2, 3, 4],
            [1.2, 1.8, 3.1, 4.2],
            [0.8, 2.2, 2.9, 3.8],
        ],
        truth: [1, 2, 3, 4],
        weights: [0.5, 0.25, 0.25],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read base model predictions, true values, and meta weights",
        "compute each base model's mean squared error",
        "form each meta prediction as the weighted sum of base predictions",
        "measure the meta learner's mean squared error",
        "compare the meta error with the base errors",
        "done: emit meta predictions and all errors",
    ],
};

export default module;
