/**
 * stein-estimation.ts - James-Stein Shrinkage Estimation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In three or more dimensions the raw vector of sample means is surprisingly
 * inefficient: the James-Stein rule shrinks the whole vector toward a target
 * and has strictly lower total squared-error risk no matter what the true
 * means are. The shrinkage factor is one minus (p minus two) divided by the
 * squared length of the observation. The positive-part variant clamps negative
 * factors to zero. Stein's unbiased risk estimate quantifies the improvement.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p) for p coordinates
 *   Space: O(p) for the coordinates and bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per coordinate shows its shrunk estimate.
 *   - The final frame reports the shrink factor and the two risk estimates.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SteinInput {
    values?: number[];
    target?: number[];
    positivePart?: boolean;
}

/** Build one bar per coordinate showing the shrunk estimate. */
function makeBars(shrunk: number[], current: number, done: boolean): VisualEntity[] {
    return shrunk.map((value, index) => {
        let state: EntityState = "idle";
        if (done || index < current) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `coord ${index}: ${value.toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, estimate: value },
        };
    });
}

/** Apply the James-Stein shrinkage rule to a vector of observations. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SteinInput | null) ?? {};
    const values: number[] = (task.values ?? []).filter((v) => typeof v === "number");
    const p = values.length;
    const target: number[] = (task.target ?? new Array<number>(p).fill(0)).slice(0, p);
    while (target.length < p) {
        target.push(0);
    }
    const positivePart = task.positivePart !== false;

    if (p < 3) {
        yield {
            stepNumber: 0,
            entities: makeBars(values, -1, true),
            edges: [],
            description: `Only ${p} coordinates; James-Stein shrinkage requires at least three.`,
            codeLineNumber: 0,
            layout: "array",
            meta: { shrink: 1, riskMean: p, riskStein: p, shrunk: [...values], p, degeneracy: true },
        };
        return;
    }

    const squaredNorm = values.reduce((acc, v, i) => acc + (v - (target[i] ?? 0)) ** 2, 0);
    let shrink = squaredNorm > 0 ? 1 - (p - 2) / squaredNorm : 1;
    if (positivePart) {
        shrink = Math.max(0, shrink);
    }
    const shrunk = values.map((v, i) => (target[i] ?? 0) + shrink * (v - (target[i] ?? 0)));
    const riskMean = p;
    const riskStein = p - ((p - 2) ** 2) / Math.max(squaredNorm, 1e-12);

    yield {
        stepNumber: 0,
        entities: makeBars(shrunk, -1, false),
        edges: [],
        description: `Shrinking ${p} coordinates toward the target with James-Stein's rule.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { shrink, riskMean, riskStein, shrunk, squaredNorm, p, positivePart },
    };
    let step = 1;

    for (let i = 0; i < p; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(shrunk, i, false),
            edges: [],
            description: `Coordinate ${i}: observed ${values[i]!.toFixed(3)}, shrunk ${shrunk[i]!.toFixed(3)} with factor ${shrink.toFixed(3)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { shrink, riskMean, riskStein, shrunk, squaredNorm, p, positivePart, revealed: i + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(shrunk, -1, true),
        edges: [],
        description: `Shrink factor ${shrink.toFixed(3)}; estimated risk ${riskStein.toFixed(3)} versus ${riskMean} for the raw mean.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { shrink, riskMean, riskStein, shrunk, squaredNorm, p, positivePart },
    };
}

/** The James-Stein estimation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Estimating several unrelated means at once feels like several separate problems, but treating them together can help. James and Stein showed that shrinking all estimates toward a common point lowers the total error whenever there are at least three quantities. The surprising part is that this holds even when the quantities truly have nothing in common: the reduction in variance outweighs any bias introduced.",
        invariants: [
            "The positive-part shrinkage factor always lies between zero and one.",
            "Every shrunk coordinate lies between its observation and the target.",
            "The estimated risk of the shrinkage rule is below the raw mean's risk of p.",
        ],
        correctness:
            "Writing the observation as the true mean plus standard normal noise, the total risk of the raw estimator is p. Stein's identity gives the unbiased risk estimate of the shrinkage rule as p minus (p minus two) squared divided by the squared norm, which is strictly less than p for p at least three. The positive-part variant only sets negative factors to zero, which cannot increase risk, so it dominates the raw estimator as well.",
        complexityRationale:
            "Computing the squared norm, the shrink factor, and each coordinate is a single pass over p values, so time is O(p). The coordinate arrays and bars use O(p) space.",
        uses: [
            "Simultaneous estimation of many treatment effects",
            "Smoothing estimates across related regions or categories",
            "A canonical demonstration of Stein's paradox in statistics",
        ],
        references: [
            "James and Stein, Estimation with Quadratic Loss, Berkeley Symposium, 1961",
            "Efron and Morris, Data Analysis Using Stein's Estimator, JASA, 1975",
        ],
        workedExample:
            "With three observations 1, 2 and 3 aimed at zero, the squared norm is 14 and the shrink factor is 1 minus 1 over 14, about 0.929. Each value moves slightly toward zero, giving about 0.93, 1.86 and 2.79. The estimated risk falls from 3 to about 2.93, a small but guaranteed gain.",
    },
    id: "stein-estimation",
    name: "James-Stein Estimation",
    category: "statistics-probability",
    complexity: { time: "O(p)", space: "O(p)" },
    defaultInput: {
        values: [1, 2, 3, 4, 2, 5],
        target: [0, 0, 0, 0, 0, 0],
        positivePart: true,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the observation vector and shrinkage target",
        "require at least three coordinates",
        "compute the squared distance from the target",
        "set the factor to one minus p minus two over that distance",
        "clamp a negative factor to zero in the positive-part variant",
        "shrink every coordinate toward the target",
        "done: report estimates and Stein's risk estimates",
    ],
};

export default module;
