/**
 * akaike-information-criterion.ts - Akaike Information Criterion
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AIC scores competing statistical models by balancing goodness of fit against
 * model complexity. It equals twice the number of estimated parameters minus
 * twice the maximized log-likelihood, so a better fit lowers the score while
 * each extra parameter penalizes it. The model with the smallest AIC is
 * preferred. When a sample size is supplied, the finite-sample correction AICc
 * is also reported.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(M) for M candidate models
 *   Space: O(M) for the score table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per model shows its AIC score (lower is better).
 *   - The model being scored is BLUE (active); the winner is GREEN.
 *   - The final frame names the selected model and its AIC in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Model {
    name: string;
    k: number;
    logLikelihood: number;
}

const DEFAULT_MODELS: Model[] = [
    { name: "linear", k: 2, logLikelihood: -120.4 },
    { name: "quadratic", k: 3, logLikelihood: -118.1 },
    { name: "cubic", k: 4, logLikelihood: -117.9 },
];

function makeBars(
    models: Model[],
    aics: number[],
    states: Map<number, EntityState>,
): VisualEntity[] {
    return models.map((model, index) => ({
        id: `bar-model-${index}`,
        type: "bar" as const,
        label: model.name,
        value: aics[index] ?? 0,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { name: model.name, k: model.k, logLikelihood: model.logLikelihood, aic: aics[index] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { models?: Model[]; sampleSize?: number } | null) ?? {};
    const models: Model[] = task.models ?? DEFAULT_MODELS;
    const sampleSize = typeof task.sampleSize === "number" ? task.sampleSize : undefined;

    const aics = models.map((model) => 2 * model.k - 2 * model.logLikelihood);
    const aiccs = models.map((model, index) => {
        const denominator = sampleSize === undefined ? 0 : sampleSize - model.k - 1;
        if (denominator <= 0) {
            return Number.POSITIVE_INFINITY;
        }
        return (aics[index] ?? 0) + (2 * model.k * (model.k + 1)) / denominator;
    });

    let bestIndex = 0;
    for (let i = 1; i < aics.length; i += 1) {
        if ((aics[i] ?? 0) < (aics[bestIndex] ?? 0)) {
            bestIndex = i;
        }
    }
    let bestAiccIndex = 0;
    for (let i = 1; i < aiccs.length; i += 1) {
        if ((aiccs[i] ?? Number.POSITIVE_INFINITY) < (aiccs[bestAiccIndex] ?? Number.POSITIVE_INFINITY)) {
            bestAiccIndex = i;
        }
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(models, aics, new Map()),
        edges: [],
        description: `Scoring ${models.length} candidate model(s) with 2k minus 2 times log-likelihood.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { models: models.length, sampleSize: sampleSize ?? 0 },
    };
    step += 1;

    const states = new Map<number, EntityState>();
    for (let index = 0; index < models.length; index += 1) {
        const model = models[index];
        if (!model) {
            continue;
        }
        states.set(index, "active");
        yield {
            stepNumber: step,
            entities: makeBars(models, aics, states),
            edges: [],
            description: `Model ${model.name}: k=${model.k}, log-likelihood=${model.logLikelihood.toFixed(3)}, AIC=${(aics[index] ?? 0).toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { name: model.name, k: model.k, logLikelihood: model.logLikelihood, aic: aics[index] ?? 0 },
        };
        step += 1;
        states.set(index, "idle");
    }

    states.set(bestIndex, "sorted");
    const winner = models[bestIndex];
    yield {
        stepNumber: step,
        entities: makeBars(models, aics, states),
        edges: [],
        description: `Lowest AIC is ${(aics[bestIndex] ?? 0).toFixed(3)} for model ${winner?.name ?? "none"}; smaller scores are preferred.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            bestIndex,
            bestName: winner?.name ?? "",
            bestAic: aics[bestIndex] ?? 0,
            aics,
            aiccs,
            bestAiccIndex,
            sampleSize: sampleSize ?? 0,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A model with more parameters can almost always fit the training data better, but that extra flexibility may not generalize. AIC prices each parameter so that only a worthwhile improvement in log-likelihood wins. Among the candidates, choose the smallest score.",
        invariants: [
            "Adding a parameter raises AIC by two unless log-likelihood improves by more than one.",
            "Doubling the log-likelihood contribution always lowers AIC.",
            "The selected model has the minimum AIC among the candidates.",
        ],
        correctness:
            "AIC is an asymptotically unbiased estimate of the Kullback-Leibler information lost when a fitted model approximates the true data-generating process. Deriving the expected optimism of the maximized log-likelihood shows it is approximately k, so twice the optimism gives 2k minus 2 log-likelihood. Minimizing this criterion therefore minimizes estimated information loss, and AICc adds a correction that removes remaining small-sample bias.",
        complexityRationale:
            "Each model is scored with constant work and the minimum is found in one linear scan, so time is linear in the number of models and space is linear for the score arrays.",
        uses: [
            "Selecting predictor subsets in regression",
            "Choosing the order of a time-series model",
            "Comparing competing ecological or biological models",
        ],
        references: [
            "Akaike, A New Look at the Statistical Model Identification, IEEE TAC, 1974",
            "Burnham and Anderson, Model Selection and Multimodel Inference, 2002",
        ],
        workedExample:
            "A two-parameter model with log-likelihood -120.4 scores 4 + 240.8 = 244.8. A three-parameter model at -118.1 scores 6 + 236.2 = 242.2, which is lower. A four-parameter model at -117.9 scores 8 + 235.8 = 243.8, so the quadratic model wins.",
    },
    id: "akaike-information-criterion",
    name: "Akaike Information Criterion",
    category: "statistics-probability",
    complexity: { time: "O(M)", space: "O(M)" },
    defaultInput: { models: DEFAULT_MODELS, sampleSize: 100 },
    visualType: "array",
    run,
    pseudocode: [
        "for each candidate model note its parameter count k and log-likelihood",
        "compute AIC as 2k minus 2 times log-likelihood",
        "if a sample size is given compute the corrected AICc",
        "track the model with the smallest AIC",
        "report the selected model and its score",
    ],
};

export default module;
