/**
 * adaboost.ts - AdaBoost with Decision Stumps
 *
 * A binary AdaBoost demo using depth-one decision stumps. Each round finds the
 * axis-aligned threshold with the lowest weighted error, then reweights the
 * training points so later stumps focus on the previously misclassified ones.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Stump {
    feature: number;
    threshold: number;
    polarity: number;
    prediction: number;
    error: number;
    alpha: number;
    weightSum: number;
    accuracy: number;
}

function predict(stump: Stump, point: number[]): number {
    const value = point[stump.feature] ?? 0;
    return stump.polarity * (value >= stump.threshold ? 1 : -1);
}

function makePoints(points: number[][], labels: number[], correct: boolean[]): VisualEntity[] {
    return points.map((point, index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: (labels[index] ?? 0) > 0 ? "+" : "-",
        value: point,
        state: (correct[index] ? "sorted" : "swapped") as "sorted" | "swapped",
        x: point[0] ?? 0,
        y: point[1] ?? 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: number[][]; labels?: number[]; rounds?: number } | null) ?? {};
    const points: number[][] = task.points ?? [
        [1, 2],
        [2, 1],
        [3, 2],
        [4, 1],
        [5, 2],
        [6, 1],
    ];
    const labels: number[] = task.labels ?? [1, 1, 1, -1, -1, -1];
    const rounds = Math.max(1, Math.floor(typeof task.rounds === "number" ? task.rounds : 5));
    const n = Math.min(points.length, labels.length);
    const weights = new Array<number>(n).fill(1 / Math.max(1, n));
    const ensemble: Stump[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makePoints(points.slice(0, n), labels, new Array(n).fill(false)),
        edges: [],
        description: `Boosting ${n} points for up to ${rounds} round(s) with decision stumps.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { round: 0, weightedError: 0, alpha: 0, accuracy: 0, weightSum: 1 },
    };
    step += 1;

    for (let round = 0; round < rounds; round += 1) {
        let best: Stump | null = null;
        for (let feature = 0; feature < 2; feature += 1) {
            const values = [...new Set(points.slice(0, n).map((p) => p[feature] ?? 0))].sort((a, b) => a - b);
            for (let i = 0; i + 1 < values.length; i += 1) {
                const threshold = (values[i] ?? 0) + ((values[i + 1] ?? 0) - (values[i] ?? 0)) / 2;
                for (const polarity of [1, -1]) {
                    let error = 0;
                    for (let k = 0; k < n; k += 1) {
                        const prediction = polarity * ((points[k]?.[feature] ?? 0) >= threshold ? 1 : -1);
                        if (prediction !== labels[k]) {
                            error += weights[k] ?? 0;
                        }
                    }
                    if (!best || error < best.error) {
                        best = { feature, threshold, polarity, prediction: 0, error, alpha: 0, weightSum: 1, accuracy: 0 };
                    }
                }
            }
        }
        if (!best) {
            break;
        }
        const chosen = best;
        if (chosen.error >= 0.5 - 1e-12) {
            break;
        }
        const clipped = Math.min(1 - 1e-10, Math.max(1e-10, chosen.error));
        const alpha = 0.5 * Math.log((1 - clipped) / clipped);
        chosen.alpha = alpha;
        ensemble.push(chosen);

        let total = 0;
        for (let k = 0; k < n; k += 1) {
            const h = chosen.polarity * ((points[k]?.[chosen.feature] ?? 0) >= chosen.threshold ? 1 : -1);
            weights[k] = (weights[k] ?? 0) * Math.exp(-alpha * (labels[k] ?? 0) * h);
            total += weights[k] ?? 0;
        }
        if (total > 0) {
            for (let k = 0; k < n; k += 1) {
                weights[k] = (weights[k] ?? 0) / total;
            }
        }
        let normalizedTotal = 0;
        for (let k = 0; k < n; k += 1) {
            normalizedTotal += weights[k] ?? 0;
        }

        const correct: boolean[] = [];
        let hits = 0;
        for (let k = 0; k < n; k += 1) {
            let vote = 0;
            for (const stump of ensemble) {
                vote += stump.alpha * (stump.polarity * ((points[k]?.[stump.feature] ?? 0) >= stump.threshold ? 1 : -1));
            }
            const ok = (vote >= 0 ? 1 : -1) === labels[k];
            correct.push(ok);
            if (ok) {
                hits += 1;
            }
        }
        const accuracy = hits / Math.max(1, n);
        yield {
            stepNumber: step,
            entities: makePoints(points.slice(0, n), labels, correct),
            edges: [],
            description: `Round ${round + 1}: stump on feature ${chosen.feature} at ${chosen.threshold.toFixed(2)} has weighted error ${chosen.error.toFixed(3)} and alpha ${alpha.toFixed(3)}; accuracy ${(accuracy * 100).toFixed(0)}%.`,
            codeLineNumber: 4,
            layout: "point",
            meta: {
                round: round + 1,
                weightedError: Number(chosen.error.toFixed(6)),
                alpha: Number(alpha.toFixed(6)),
                accuracy: Number(accuracy.toFixed(6)),
                weightSum: Number(normalizedTotal.toFixed(6)),
                feature: chosen.feature,
                threshold: Number(chosen.threshold.toFixed(6)),
                polarity: chosen.polarity,
            },
        };
        step += 1;
        if (chosen.error <= 1e-12) {
            break;
        }
    }

    const finalCorrect: boolean[] = [];
    let hits = 0;
    for (let k = 0; k < n; k += 1) {
        let vote = 0;
        for (const stump of ensemble) {
            vote += stump.alpha * (stump.polarity * ((points[k]?.[stump.feature] ?? 0) >= stump.threshold ? 1 : -1));
        }
        const ok = (vote >= 0 ? 1 : -1) === labels[k];
        finalCorrect.push(ok);
        if (ok) {
            hits += 1;
        }
    }
    yield {
        stepNumber: step,
        entities: makePoints(points.slice(0, n), labels, finalCorrect),
        edges: [],
        description: `Final ensemble of ${ensemble.length} stump(s) classifies ${hits} of ${n} points correctly.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { round: ensemble.length, accuracy: Number((hits / Math.max(1, n)).toFixed(6)), learners: ensemble.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A weak learner is only slightly better than guessing, but AdaBoost chains many of them together. After each round it increases the weight of misclassified points so the next learner pays more attention to them, and gives more accurate learners a larger vote in the final decision.",
        invariants: [
            "The weights across all training points sum to one after every update.",
            "A stump is accepted only when its weighted error is below one half.",
            "The vote weight alpha grows as the weighted error falls.",
        ],
        correctness:
            "For each round the weighted error is minimized by an exhaustive scan of feature thresholds and both polarities. The update multiplies a point's weight by exp(-alpha * y * h), which raises the weight of errors when alpha is positive, and the subsequent normalization keeps a probability distribution. The final sign of the weighted vote is the ensemble prediction.",
        complexityRationale:
            "With T rounds, two features, at most n thresholds each, and n points, scanning and updating cost O(T * n log n) time; the ensemble and weights use O(T + n) space.",
        uses: [
            "Face detection with cascades of simple features",
            "Binary classification ensembles in classical machine learning",
            "A teaching example of boosting and margin maximization",
        ],
        references: [
            "Freund and Schapire, A Decision-Theoretic Generalization of On-Line Learning, 1997",
            "Schapire, A Brief Introduction to Boosting, 1999",
        ],
        workedExample:
            "With points at x = 1 through 6 labeled +,+,+,-,-,-, the best stump splits at 3.5 with polarity -1 and gets zero error, so it receives a large alpha and the ensemble classifies all six points correctly after one round.",
    },
    id: "adaboost",
    name: "AdaBoost",
    category: "ml-ai",
    complexity: { time: "O(T * n log n)", space: "O(T + n)" },
    defaultInput: {
        points: [
            [1, 2],
            [2, 1],
            [3, 2],
            [4, 1],
            [5, 2],
            [6, 1],
        ],
        labels: [1, 1, 1, -1, -1, -1],
        rounds: 5,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize every point weight to one over n",
        "for each boosting round",
        "find the stump with the smallest weighted error",
        "set alpha to one half the log of (one minus error) over error",
        "multiply each wrong point weight by exp of minus alpha times label times prediction",
        "normalize the weights to sum to one",
        "done: predict by the sign of the weighted stump votes",
    ],
};

export default module;
