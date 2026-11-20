/**
 * bayesian-model-averaging.ts - Bayesian Model Averaging from BIC Scores
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Instead of committing to a single "best" model, Bayesian model averaging
 * weights every candidate model by its posterior probability given the data.
 * A convenient approximation turns each model's BIC into a log marginal
 * likelihood (minus one half of BIC), adds a log prior, and normalizes with a
 * log-sum-exp for numerical stability. A quantity of interest is then the
 * posterior-weighted average of the per-model estimates.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k candidate models
 *   Space: O(k) for the weights and displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per model shows its posterior weight.
 *   - Weights fill in from left to right as models are processed.
 *   - The final frame reports the averaged estimate and the favored model.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BmaModel {
    name: string;
    bic: number;
    estimate: number;
    prior?: number;
}

interface BmaInput {
    models?: BmaModel[];
}

/** Build one bar per model showing its posterior weight. */
function makeBars(names: string[], weights: number[], current: number, done: boolean): VisualEntity[] {
    return names.map((name, index) => {
        let state: EntityState = "idle";
        if (done || index < current) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        const weight = weights[index] ?? 0;
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${name}: weight ${weight.toFixed(3)}`,
            value: weight,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, name, weight },
        };
    });
}

/** Run Bayesian model averaging over the supplied candidate models. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BmaInput | null) ?? {};
    const models: BmaModel[] = (task.models ?? []).filter(
        (m) => m && typeof m.bic === "number" && typeof m.estimate === "number",
    );
    const names = models.map((m, i) => m.name || `model-${i}`);
    const bics = models.map((m) => m.bic);
    const estimates = models.map((m) => m.estimate);

    if (models.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "No candidate models were supplied; there is nothing to average.",
            codeLineNumber: 0,
            layout: "array",
            meta: { weights: [], estimate: 0, best: "", count: 0 },
        };
        return;
    }

    // log weight = log prior - 0.5 * BIC; normalize with a log-sum-exp.
    const logWeights = models.map((m) => {
        const prior = typeof m.prior === "number" && m.prior > 0 ? m.prior : 1;
        return Math.log(prior) - 0.5 * m.bic;
    });
    const maxLog = Math.max(...logWeights);
    const unnormalized = logWeights.map((v) => Math.exp(v - maxLog));
    const total = unnormalized.reduce((a, b) => a + b, 0);
    const weights = unnormalized.map((v) => v / total);
    const estimate = weights.reduce((acc, w, i) => acc + w * (estimates[i] ?? 0), 0);
    let bestIndex = 0;
    for (let i = 1; i < weights.length; i += 1) {
        if ((weights[i] ?? 0) > (weights[bestIndex] ?? 0)) {
            bestIndex = i;
        }
    }
    const best = names[bestIndex] ?? "";

    yield {
        stepNumber: 0,
        entities: makeBars(names, weights, -1, false),
        edges: [],
        description: `Averaging ${models.length} candidate models from their BIC scores.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { names, bics, weights, estimate, best, count: models.length },
    };
    let step = 1;

    for (let i = 0; i < names.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(names, weights, i, false),
            edges: [],
            description: `${names[i]}: BIC ${bics[i]!.toFixed(2)} gives posterior weight ${(weights[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: i === 0 ? 2 : 4,
            layout: "array",
            meta: { names, bics, weights, estimate, best, count: models.length, revealed: i + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(names, weights, -1, true),
        edges: [],
        description: `Posterior weights sum to one; the averaged estimate is ${estimate.toFixed(4)}, favored model ${best}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { names, bics, weights, estimate, best, count: models.length },
    };
}

/** The Bayesian model averaging module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Picking the single model with the best score throws away uncertainty about which model is right. Bayesian model averaging keeps every candidate and weights it by how plausible the data make it. The final prediction is a blend, so models that are nearly tied share the influence instead of one winning arbitrarily.",
        invariants: [
            "Each posterior weight is nonnegative and all of them sum to one.",
            "Adding the same constant to every BIC leaves the weights unchanged.",
            "A lower BIC never receives a larger posterior weight than a higher BIC under equal priors.",
        ],
        correctness:
            "Bayes' rule gives p(M_k | D) proportional to p(D | M_k) p(M_k). Schwarz's approximation p(D | M_k) about exp(-BIC_k / 2) converts each score into a likelihood on a common scale. Normalizing those products makes them a probability distribution, and the posterior expectation of any quantity is the weighted sum of its per-model values. The log-sum-exp shift subtracts the maximum log weight and cancels in the normalization, so it changes no weight.",
        complexityRationale:
            "Each model needs one exponential and one multiplication, so averaging k models is O(k) time. Storing the scores, weights, and bars is linear in k, giving O(k) space.",
        uses: [
            "Ensemble forecasting where several plausible models compete",
            "Variable selection with uncertain predictor subsets",
            "Scientific reporting that must reflect model uncertainty",
        ],
        references: [
            "Hoeting, Madigan, Raftery and Volinsky, Bayesian Model Averaging, Statistical Science, 1999",
            "Schwarz, Estimating the Dimension of a Model, Annals of Statistics, 1978",
        ],
        workedExample:
            "Two models have BIC 10 and 12 with equal priors. Their unnormalized weights are exp(-5) and exp(-6), about 0.00674 and 0.00248. Normalizing gives roughly 0.731 and 0.269, so if the models predict 4 and 8 the averaged estimate is about 5.08, closer to the better-scoring model but not equal to it.",
    },
    id: "bayesian-model-averaging",
    name: "Bayesian Model Averaging",
    category: "statistics-probability",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: {
        models: [
            { name: "linear", bic: 10, estimate: 4 },
            { name: "quadratic", bic: 12, estimate: 8 },
            { name: "cubic", bic: 15, estimate: 11 },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read each model's BIC, estimate, and optional prior",
        "convert each BIC into a log marginal likelihood",
        "add the log prior to form an unnormalized log weight",
        "subtract the largest log weight for stability",
        "exponentiate and normalize into posterior model weights",
        "average the per-model estimates using those weights",
        "done: report the weights, averaged estimate, and best model",
    ],
};

export default module;
