/**
 * leave-one-out-cross-validation.ts - Leave-One-Out Cross-Validation (LOOCV)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * LOOCV estimates the prediction error of a model. For n labeled points it
 * refits a simple linear regression n times, each time holding out one
 * observation, predicts the held-out response, and averages the squared
 * prediction errors. The hat-matrix shortcut computes the same held-out
 * residual from the single full fit as r_i / (1 - h_i), where h_i is the
 * leverage of point i.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) with the leverage shortcut, O(n^2) by brute-force refitting
 *   Space: O(n) for the predictions and residuals
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid holds x, y, held-out prediction, and residual per observation.
 *   - The held-out column is highlighted while each fold is explained.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

export interface Fit {
    slope: number;
    intercept: number;
}

/** Fit y = slope * x + intercept by ordinary least squares. */
export function fitLine(points: Point[]): Fit {
    const n = points.length;
    if (n === 0) {
        return { slope: 0, intercept: 0 };
    }
    let sx = 0;
    let sy = 0;
    for (const p of points) {
        sx += p[0];
        sy += p[1];
    }
    const mx = sx / n;
    const my = sy / n;
    let sxx = 0;
    let sxy = 0;
    for (const p of points) {
        const dx = p[0] - mx;
        sxx += dx * dx;
        sxy += dx * (p[1] - my);
    }
    const slope = sxx > 1e-12 ? sxy / sxx : 0;
    return { slope, intercept: my - slope * mx };
}

/** Predict the response at x from a fitted line. */
export function predict(fit: Fit, x: number): number {
    return fit.slope * x + fit.intercept;
}

function makeCells(
    points: Point[],
    predictions: number[],
    residuals: number[],
    active: number,
    done: boolean,
): VisualEntity[] {
    const labels = ["x", "y", "pred", "resid"];
    const rows: number[][] = [
        points.map((p) => p[0]),
        points.map((p) => p[1]),
        predictions,
        residuals,
    ];
    const cells: VisualEntity[] = [];
    for (let r = 0; r < labels.length; r += 1) {
        for (let c = 0; c < points.length; c += 1) {
            const value = rows[r]?.[c] ?? 0;
            let state: EntityState = "idle";
            if (done) {
                state = "sorted";
            } else if (c === active) {
                state = "comparing";
            } else if (c < active) {
                state = "visited";
            }
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: `${labels[r]}=${value.toFixed(2)}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, field: labels[r] },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[] } | null) ?? {};
    const points: Point[] =
        Array.isArray(task.points) && task.points.length >= 3
            ? task.points.map((p) => [Number(p?.[0]) || 0, Number(p?.[1]) || 0] as Point)
            : ([
                  [1, 2.1],
                  [2, 3.9],
                  [3, 6.2],
                  [4, 7.8],
                  [5, 10.1],
              ] as Point[]);
    const n = points.length;
    const full = fitLine(points);
    let mx = 0;
    for (const p of points) {
        mx += p[0];
    }
    mx /= n;
    let sxx = 0;
    for (const p of points) {
        sxx += (p[0] - mx) * (p[0] - mx);
    }

    const predictions: number[] = new Array(n).fill(0);
    const residuals: number[] = new Array(n).fill(0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(points, predictions, residuals, -1, false),
        edges: [],
        description: `LOOCV on ${n} points; full fit slope ${full.slope.toFixed(3)}, intercept ${full.intercept.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 4, cols: n, n, slope: full.slope, intercept: full.intercept, loocvMse: 0 },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const reduced: Point[] = [];
        for (let j = 0; j < n; j += 1) {
            if (j !== i) {
                reduced.push(points[j] as Point);
            }
        }
        const fit = fitLine(reduced);
        const heldOut = points[i] as Point;
        const pred = predict(fit, heldOut[0]);
        predictions[i] = pred;
        residuals[i] = heldOut[1] - pred;
        yield {
            stepNumber: step,
            entities: makeCells(points, predictions, residuals, i, false),
            edges: [],
            description: `Fold ${i + 1}: refit without point ${i}, predict y=${heldOut[1].toFixed(2)} as ${pred.toFixed(3)}, residual ${residuals[i]?.toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {
                rows: 4,
                cols: n,
                n,
                heldOut: i,
                prediction: pred,
                residual: residuals[i] ?? 0,
                predictions: [...predictions],
                residuals: [...residuals],
            },
        };
        step += 1;
    }

    let bruteMse = 0;
    let shortcutMse = 0;
    for (let i = 0; i < n; i += 1) {
        bruteMse += (residuals[i] ?? 0) * (residuals[i] ?? 0);
        const point = points[i] as Point;
        const fullResidual = point[1] - predict(full, point[0]);
        const leverage = 1 / n + ((point[0] - mx) * (point[0] - mx)) / (sxx > 1e-12 ? sxx : 1);
        const shortcutResidual = fullResidual / (1 - leverage);
        shortcutMse += shortcutResidual * shortcutResidual;
    }
    bruteMse /= n;
    shortcutMse /= n;

    yield {
        stepNumber: step,
        entities: makeCells(points, predictions, residuals, -1, true),
        edges: [],
        description: `LOOCV mean squared error ${bruteMse.toFixed(4)}; leverage shortcut gives ${shortcutMse.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 4,
            cols: n,
            n,
            slope: full.slope,
            intercept: full.intercept,
            loocvMse: bruteMse,
            shortcutMse,
            predictions,
            residuals,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A model that has seen a point cannot fairly be tested on it. Leave-one-out cross-validation removes one observation, fits the model on the rest, and asks how well it predicts the missing answer. Doing this for every observation gives an almost unbiased estimate of prediction error, and a leverage formula lets you get the same answer from a single fit.",
        invariants: [
            "Each fold trains on exactly n - 1 observations and tests on the one held out.",
            "The held-out residual is the observed response minus the reduced-fit prediction.",
            "The shortcut residual equals the full-fit residual divided by one minus the leverage.",
        ],
        correctness:
            "For ordinary least squares the fitted values satisfy y-hat = H y for the hat matrix H. Deleting observation i and refitting gives a held-out error equal to e_i / (1 - h_i), where e_i is the residual from the full fit and h_i is the i-th diagonal of H. For simple regression h_i = 1/n + (x_i - x-bar)^2 / sum_j (x_j - x-bar)^2, so the shortcut reproduces every brute-force residual and both routes average to the same LOOCV estimate.",
        complexityRationale:
            "The shortcut needs one fit plus n leverage terms, so it runs in O(n) time and O(n) space. Refitting from scratch each fold costs O(n) per fold, or O(n^2) total, which the visualization performs to demonstrate equivalence.",
        uses: [
            "Estimating generalization error on small data sets",
            "Choosing between competing regression models or tuning parameters",
            "Detecting influential observations through large held-out errors",
        ],
        references: [
            "Hastie, Tibshirani and Friedman, The Elements of Statistical Learning, Chapter 7",
            "Stone, Cross-Validatory Choice and Assessment of Statistical Predictions, 1974",
        ],
        workedExample:
            "For points (1,2.1), (2,3.9), (3,6.2), (4,7.8), (5,10.1), holding out the third point fits a line on the other four and predicts roughly 6.0 for x=3. The residual near 0.2 is divided by one minus its leverage to obtain the same number from the full fit, and the five squared residuals are averaged.",
    },
    id: "leave-one-out-cross-validation",
    name: "Leave-One-Out Cross-Validation",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        points: [
            [1, 2.1],
            [2, 3.9],
            [3, 6.2],
            [4, 7.8],
            [5, 10.1],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "fit the regression on all n observations and compute each leverage",
        "for every observation i from zero to n minus one",
        "refit the model using all observations except i",
        "predict the held-out response from the reduced fit",
        "record the squared prediction error for fold i",
        "equivalently divide the full-fit residual by one minus leverage",
        "average all squared errors for the LOOCV estimate",
    ],
};

export default module;
