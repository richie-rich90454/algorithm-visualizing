/**
 * naive-bayes-classifier.ts - Gaussian Naive Bayes Classification
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gaussian naive Bayes learns, for every class, a mean and a variance for each
 * feature plus the class prior. To classify a query it multiplies the prior by
 * the Gaussian likelihood of each feature under every class. The "naive" part
 * is the assumption that features are independent given the class, which makes
 * training a single pass of counting and averaging.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * d) to fit, O(c * d) to classify, for n samples, c classes, d features
 *   Space: O(c * d) for the per-class statistics
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Training points are plotted with their class label.
 *   - A distinct pivot marker shows the query.
 *   - One marker per class shows its fitted mean as it is scored.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Sample = [number, number, number];

interface ClassStats {
    label: number;
    count: number;
    mean: [number, number];
    variance: [number, number];
    logPrior: number;
}

/** Fit per-class means, variances and priors with a small variance floor. */
function fit(samples: Sample[], labels: number[], epsilon: number): ClassStats[] {
    const n = Math.max(1, samples.length);
    return labels.map((label) => {
        const members = samples.filter((sample) => sample[2] === label);
        const count = members.length;
        const mean: [number, number] = [0, 0];
        for (const sample of members) {
            mean[0] += sample[0];
            mean[1] += sample[1];
        }
        if (count > 0) {
            mean[0] /= count;
            mean[1] /= count;
        }
        let varX = 0;
        let varY = 0;
        for (const sample of members) {
            varX += (sample[0] - mean[0]) ** 2;
            varY += (sample[1] - mean[1]) ** 2;
        }
        const variance: [number, number] = [
            Math.max(epsilon, count > 0 ? varX / count : epsilon),
            Math.max(epsilon, count > 0 ? varY / count : epsilon),
        ];
        return {
            label,
            count,
            mean,
            variance,
            logPrior: Math.log(Math.max(1e-15, count / n)),
        };
    });
}

/** Log of the naive Bayes posterior score for one class. */
function logScore(stats: ClassStats, x: number, y: number): number {
    const term = (value: number, mean: number, variance: number) =>
        -0.5 * Math.log(2 * Math.PI * variance) - ((value - mean) ** 2) / (2 * variance);
    return stats.logPrior + term(x, stats.mean[0], stats.variance[0]) + term(y, stats.mean[1], stats.variance[1]);
}

function makeEntities(
    samples: Sample[],
    query: [number, number],
    stats: ClassStats[],
    activeClass: number,
    prediction: number,
): VisualEntity[] {
    const entities: VisualEntity[] = samples.map(([x, y, label], index) => ({
        id: `sample-${index}`,
        type: "node" as const,
        label: `${label}`,
        value: [x, y, label],
        state: "unvisited" as EntityState,
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index, label },
    }));
    entities.push({
        id: "query",
        type: "node",
        label: "?",
        value: query,
        state: prediction >= 0 ? "sorted" : "pivot",
        x: query[0],
        y: query[1],
        width: 0,
        height: 0,
        metadata: { query: true, predicted: prediction },
    });
    for (const classStats of stats) {
        entities.push({
            id: `mean-${classStats.label}`,
            type: "node",
            label: `m${classStats.label}`,
            value: classStats.mean,
            state: (classStats.label === activeClass ? "active" : "idle") as EntityState,
            x: classStats.mean[0],
            y: classStats.mean[1],
            width: 0,
            height: 0,
            metadata: { meanOf: classStats.label, count: classStats.count },
        });
    }
    return entities;
}

/** The Gaussian naive Bayes generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { samples?: Sample[]; query?: [number, number]; epsilon?: number } | null
    ) ?? {};
    const samples: Sample[] = task.samples ?? [
        [0, 0, 0],
        [0.5, 0.3, 0],
        [0.2, 0.7, 0],
        [3, 3, 1],
        [3.4, 2.8, 1],
        [2.8, 3.3, 1],
        [0, 5, 2],
        [0.4, 5.2, 2],
        [0.3, 4.6, 2],
    ];
    const query: [number, number] = task.query ?? [0.2, 4.8];
    const epsilon =
        typeof task.epsilon === "number" && task.epsilon > 0 ? task.epsilon : 1e-6;
    const labels = Array.from(new Set(samples.map((sample) => sample[2]))).sort((a, b) => a - b);
    const stats = fit(samples, labels, epsilon);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(samples, query, stats, -1, -1),
        edges: [],
        description: `Fitted Gaussian naive Bayes on ${samples.length} points across ${labels.length} classes; classifying query (${query[0]}, ${query[1]}).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { sampleCount: samples.length, classCount: labels.length, scores: [], prediction: -1 },
    };
    step += 1;

    const scores: number[] = [];
    for (const classStats of stats) {
        const score = logScore(classStats, query[0], query[1]);
        scores.push(Number(score.toFixed(6)));
        yield {
            stepNumber: step,
            entities: makeEntities(samples, query, stats, classStats.label, -1),
            edges: [],
            description: `Class ${classStats.label}: prior ${Math.exp(classStats.logPrior).toFixed(2)}, mean (${classStats.mean[0].toFixed(2)}, ${classStats.mean[1].toFixed(2)}), log score ${score.toFixed(3)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: {
                sampleCount: samples.length,
                classCount: labels.length,
                scores: [...scores],
                activeClass: classStats.label,
            },
        };
        step += 1;
    }

    let prediction = stats[0]?.label ?? -1;
    let bestScore = -Infinity;
    for (let i = 0; i < scores.length; i += 1) {
        if ((scores[i] ?? -Infinity) > bestScore) {
            bestScore = scores[i] ?? -Infinity;
            prediction = stats[i]?.label ?? -1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities(samples, query, stats, -1, prediction),
        edges: [],
        description: `The largest log score selects class ${prediction} for query (${query[0]}, ${query[1]}).`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            sampleCount: samples.length,
            classCount: labels.length,
            scores,
            prediction,
            winningClass: prediction,
        },
    };
}

/** The Gaussian naive Bayes module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Learn what each class typically looks like by recording its average and spread on every feature. A new example is scored by how plausible its features are under each class, multiplied by how common that class is. Assuming features are independent makes that product cheap to compute and surprisingly effective.",
        invariants: [
            "Each class prior equals its training count divided by the total sample count.",
            "Each variance is the mean squared deviation of that class from its feature mean, with a small floor.",
            "The predicted class is the one with the largest log posterior score.",
        ],
        correctness:
            "Under the conditional independence assumption, Bayes' rule gives posterior probability proportional to prior times the product of feature likelihoods. Taking logs turns the product into a sum without changing the ordering, so choosing the largest log score is the same as choosing the most probable class.",
        complexityRationale:
            "Fitting scans each sample once per class to build sums and sums of squares, costing O(n * d) with a constant factor for class grouping. Classification scores c classes over d features, so space and per-query time are O(c * d).",
        uses: [
            "Spam and document classification with bag-of-words features",
            "A fast baseline for sensor and medical diagnosis data",
            "Hybrid systems that combine naive Bayes with other learners",
        ],
        references: [
            "Bayes, An Essay towards solving a Problem in the Doctrine of Chances, 1763",
            "Domingos and Pazzani, On the Optimality of the Simple Bayesian Classifier, 1997",
        ],
        workedExample:
            "With two points near (0,0) labeled 0, two near (3,3) labeled 1, and two near (0,5) labeled 2, a query at (0.2, 4.8) has feature means close to the third class. Its Gaussian log likelihood is highest there, so naive Bayes predicts class 2.",
    },
    id: "naive-bayes-classifier",
    name: "Naive Bayes Classifier",
    category: "ml-ai",
    complexity: { time: "O(n * d + c * d)", space: "O(c * d)" },
    defaultInput: {
        samples: [
            [0, 0, 0],
            [0.5, 0.3, 0],
            [0.2, 0.7, 0],
            [3, 3, 1],
            [3.4, 2.8, 1],
            [2.8, 3.3, 1],
            [0, 5, 2],
            [0.4, 5.2, 2],
            [0.3, 4.6, 2],
        ],
        query: [0.2, 4.8],
        epsilon: 1e-6,
    },
    visualType: "point",
    run,
    pseudocode: [
        "group training samples by class",
        "for each class compute the prior and per-feature mean",
        "compute per-feature variance with a small floor",
        "for each class score the query by prior times feature likelihoods",
        "sum log prior and log Gaussian terms for a stable score",
        "choose the class with the largest log score",
        "done: report the predicted class",
    ],
};

export default module;
