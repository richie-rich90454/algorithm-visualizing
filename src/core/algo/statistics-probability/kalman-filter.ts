/**
 * kalman-filter.ts - One-Dimensional Kalman Filter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Kalman filter estimates a scalar state from a stream of noisy
 * measurements by alternating a prediction and an update. Prediction inflates
 * the uncertainty by the process noise, and the update blends the prediction
 * with the new measurement using the Kalman gain, then shrinks the uncertainty.
 * With constant noise the estimate converges to a weighted running average.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n measurements
 *   Space: O(n) for the displayed trace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The top row of cells holds the raw measurements.
 *   - The bottom row holds the filter's estimate after each update.
 *   - The current column is highlighted; finished columns turn green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface KalmanInput {
    measurements?: number[];
    initialEstimate?: number;
    initialP?: number;
    Q?: number;
    R?: number;
}

/** Build a two-row grid: measurements above estimates. */
function makeCells(
    measurements: number[],
    estimates: Array<number | null>,
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    measurements.forEach((measurement, i) => {
        const estimate = estimates[i] ?? null;
        for (let row = 0; row < 2; row += 1) {
            const isEstimate = row === 1;
            const value = isEstimate ? estimate : measurement;
            let state: EntityState = "idle";
            if (done || i < current) {
                state = "sorted";
            } else if (i === current) {
                state = "comparing";
            }
            entities.push({
                id: `cell-${row}-${i}`,
                type: "cell" as const,
                label: value === null ? "-" : value.toFixed(3),
                value: value ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col: i, measurement, estimate: estimate ?? 0, kind: isEstimate ? "estimate" : "measurement" },
            });
        }
    });
    return entities;
}

/** The Kalman filter generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as KalmanInput | null) ?? {};
    const measurements: number[] = Array.isArray(task.measurements)
        ? [...task.measurements]
        : [10.2, 9.8, 10.5, 9.9, 10.1, 10.3, 9.7, 10.0];
    const Q = typeof task.Q === "number" ? Math.max(0, task.Q) : 0.01;
    const R = typeof task.R === "number" ? Math.max(1e-9, task.R) : 0.5;
    let estimate = typeof task.initialEstimate === "number" ? task.initialEstimate : 10;
    let P = typeof task.initialP === "number" ? Math.max(0, task.initialP) : 1;
    const estimates: Array<number | null> = new Array<number | null>(measurements.length).fill(null);
    const gains: number[] = [];
    const errors: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeCells(measurements, estimates, -1, false),
        edges: [],
        description: `Kalman filter over ${measurements.length} measurement(s) with Q=${Q} and R=${R}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols: measurements.length, estimates: [], gains, errors, Q, R },
    };
    let step = 1;

    for (let i = 0; i < measurements.length; i += 1) {
        const z = measurements[i] ?? 0;
        const predictedP = P + Q;
        const K = predictedP / (predictedP + R);
        estimate = estimate + K * (z - estimate);
        P = (1 - K) * predictedP;
        estimates[i] = estimate;
        gains.push(K);
        errors.push(P);
        yield {
            stepNumber: step,
            entities: makeCells(measurements, estimates, i, false),
            edges: [],
            description: `Step ${i}: measurement ${z.toFixed(3)}, gain ${K.toFixed(4)}, estimate ${estimate.toFixed(4)}, uncertainty ${P.toFixed(6)}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {
                rows: 2,
                cols: measurements.length,
                estimates: estimates.map((v) => v ?? 0),
                gains: [...gains],
                errors: [...errors],
                Q,
                R,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(measurements, estimates, -1, true),
        edges: [],
        description: `Filter complete: final estimate ${estimate.toFixed(4)} with uncertainty ${P.toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 2, cols: measurements.length, estimates: estimates.map((v) => v ?? 0), gains, errors, Q, R, finalEstimate: estimate },
    };
}

/** The Kalman filter module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The filter keeps a guess and a measure of how unsure it is. When a new reading arrives, a gain decides how much to trust it: a trustworthy guess and noisy reading produce a small gain, while an uncertain guess and clean reading produce a large one. After blending, the uncertainty always drops, so the filter becomes steadier over time.",
        invariants: [
            "The Kalman gain always lies strictly between zero and one for positive noises.",
            "The updated uncertainty is smaller than the predicted uncertainty.",
            "With constant noises the estimate is a weighted running average of all readings.",
        ],
        correctness:
            "Prediction adds the process noise to the variance because independent uncertainties add. The gain minimizes the posterior variance by setting it to the predicted variance over the sum of predicted and measurement variances, which is the optimal linear blend of two independent Gaussian estimates. Substituting that gain into the variance update yields P times R over predicted variance plus R, which is smaller than P, so the recursion is the exact Kalman update for the scalar model.",
        complexityRationale:
            "Each measurement requires a constant number of arithmetic operations, so n readings take O(n) time. The two-row trace stores a measurement and an estimate per step, using O(n) space.",
        uses: [
            "Smoothing noisy sensor readings in robotics",
            "Tracking position and velocity from GPS samples",
            "Estimating hidden quantities in control systems",
        ],
        references: [
            "Kalman, A New Approach to Linear Filtering and Prediction Problems, 1960",
            "Welch and Bishop, An Introduction to the Kalman Filter, 2006",
        ],
        workedExample:
            "Starting from an estimate of 10 with uncertainty 1, process noise 0.01 and measurement noise 0.5 give a gain near 0.67. A first reading of 10.2 moves the estimate to about 10.13 and cuts the uncertainty to about 0.33, so later readings are blended more cautiously.",
    },
    id: "kalman-filter",
    name: "Kalman Filter",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        measurements: [10.2, 9.8, 10.5, 9.9, 10.1, 10.3, 9.7, 10.0],
        initialEstimate: 10,
        initialP: 1,
        Q: 0.01,
        R: 0.5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the state estimate and its uncertainty",
        "for each incoming measurement",
        "predict by adding process noise to the uncertainty",
        "compute the gain from predicted and measurement noises",
        "blend the prediction with the measurement using the gain",
        "shrink the uncertainty using the gain",
        "record the new estimate and continue",
        "done: report the final estimate and its uncertainty",
    ],
};

export default module;
