/**
 * lowess-smoothing.ts - LOWESS Locally Weighted Regression
 *
 * LOWESS fits a low-degree polynomial at each point using nearby samples with
 * tricube weights, then repeats with robustness weights that downweight
 * outliers. This produces a smooth curve that follows the data without assuming
 * a global parametric form. The frames reveal the fitted curve point by point.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface LowessInput {
    x?: number[];
    y?: number[];
    frac?: number;
    iterations?: number;
}

interface Sample {
    x: number;
    y: number;
}

/** Tricube weight for a distance within bandwidth h. */
function tricube(distance: number, h: number): number {
    if (h <= 0) return distance === 0 ? 1 : 0;
    const u = Math.min(1, distance / h);
    return (1 - u ** 3) ** 3;
}

/** Weighted least-squares line at a target x, returned as the fitted value. */
function fitAt(target: number, samples: Sample[], bandwidth: number, robust: number[]): number {
    let sw = 0;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (let j = 0; j < samples.length; j += 1) {
        const sample = samples[j]!;
        const w = tricube(Math.abs(sample.x - target), bandwidth) * (robust[j] ?? 1);
        if (w <= 0) continue;
        const dx = sample.x - target;
        sw += w;
        sx += w * dx;
        sy += w * sample.y;
        sxx += w * dx * dx;
        sxy += w * dx * sample.y;
    }
    if (sw <= 0) return sy / Math.max(1, samples.length);
    const denominator = sw * sxx - sx * sx;
    if (Math.abs(denominator) < 1e-14) return sy / sw;
    const slope = (sw * sxy - sx * sy) / denominator;
    return (sy - slope * sx) / sw;
}

/** Median of an array of numbers. */
function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
        ? sorted[mid]!
        : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Cleveland's LOWESS with robustness iterations on samples sorted by x. */
function lowess(samples: Sample[], frac: number, iterations: number): number[] {
    const n = samples.length;
    const r = Math.max(2, Math.min(n, Math.ceil(frac * n)));
    const robust = new Array<number>(n).fill(1);
    let fitted = new Array<number>(n).fill(0);
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        fitted = samples.map((sample, i) => {
            const distances = samples.map((s) => Math.abs(s.x - sample.x)).sort((a, b) => a - b);
            const bandwidth = distances[Math.min(n - 1, r - 1)] ?? 1;
            return fitAt(sample.x, samples, bandwidth, robust);
        });
        const residuals = samples.map((sample, i) => sample.y - (fitted[i] ?? 0));
        const scale = median(residuals.map((res) => Math.abs(res)));
        if (scale <= 1e-12) break;
        for (let i = 0; i < n; i += 1) {
            const u = (residuals[i] ?? 0) / (6 * scale);
            const clipped = Math.min(1, Math.max(-1, u));
            robust[i] = (1 - clipped ** 2) ** 2;
        }
    }
    return fitted;
}

function makePoints(samples: Sample[], fitted: number[], revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    samples.forEach((sample, i) => {
        entities.push({
            id: `raw-${i}`,
            type: "node" as const,
            label: `(${sample.x.toFixed(1)},${sample.y.toFixed(1)})`,
            value: sample.y,
            state: "idle",
            x: sample.x,
            y: sample.y,
            width: 0,
            height: 0,
            metadata: { row: i, role: "raw" },
        });
        entities.push({
            id: `fit-${i}`,
            type: "node" as const,
            label: (fitted[i] ?? 0).toFixed(3),
            value: fitted[i] ?? 0,
            state: i < revealed ? "sorted" : "unvisited",
            x: sample.x,
            y: fitted[i] ?? 0,
            width: 0,
            height: 0,
            metadata: { row: i, role: "fitted" },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LowessInput | null) ?? {};
    const xs = Array.isArray(task.x) ? task.x.map(Number).filter(Number.isFinite) : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const ys = Array.isArray(task.y) ? task.y.map(Number).filter(Number.isFinite) : xs.map((x) => x + Math.sin(x));
    const count = Math.min(xs.length, ys.length);
    const samples: Sample[] = Array.from({ length: count }, (_, i) => ({ x: xs[i]!, y: ys[i]! }))
        .sort((a, b) => a.x - b.x);
    const frac = Math.min(1, Math.max(0.1, Number(task.frac ?? 0.5) || 0.5));
    const iterations = Math.min(6, Math.max(1, Math.floor(Number(task.iterations ?? 2)) || 2));
    const fitted = lowess(samples, frac, iterations);

    yield {
        stepNumber: 0,
        entities: makePoints(samples, fitted, 0),
        edges: [],
        description: `LOWESS on ${samples.length} points with span ${frac} and ${iterations} robustness iteration(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n: samples.length, frac, iterations, fitted: fitted.map(() => 0), revealed: 0 },
    };

    // Batch large data sets so the precomputed frame buffer stays small.
    const batch = Math.max(1, Math.ceil(samples.length / 40));
    let step = 1;
    for (let i = 0; i < samples.length; i += batch) {
        const upto = Math.min(samples.length, i + batch);
        yield {
            stepNumber: step,
            entities: makePoints(samples, fitted, upto),
            edges: [],
            description: `At x = ${samples[i]!.x.toFixed(3)} the local weighted line predicts ${(fitted[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { n: samples.length, frac, iterations, fitted: fitted.slice(0, upto), revealed: upto },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makePoints(samples, fitted, samples.length),
        edges: [],
        description: `Fitted ${samples.length} smoothed values; robustness weights downweight residuals after each pass.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { n: samples.length, frac, iterations, fitted: [...fitted], revealed: samples.length, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "LOWESS builds a smooth curve by fitting a simple line near each data point and using only nearby observations, with the closest ones counting most. After the first pass it looks at the residuals and reduces the influence of points that do not fit the local pattern, which protects the curve from outliers.",
        invariants: [
            "Samples are processed in nondecreasing x order.",
            "Tricube weights are nonnegative and vanish beyond the local bandwidth.",
            "A globally linear data set is reproduced exactly by the local linear fits.",
        ],
        correctness:
            "At each target the bandwidth is the distance to the r-th nearest neighbor, so every fit uses a comparable number of points. Weighted least squares finds the line minimizing the weighted squared error, and because a straight line is in the fitted family, data lying on any line is recovered exactly regardless of the weights. The bisquare robustness weights are a bounded redescending function of the scaled residuals, so a single extreme observation cannot dominate later passes.",
        complexityRationale:
            "Each of the n targets sorts n distances and solves a two-parameter weighted regression, O(n squared log n) per robustness pass; storage is O(n) for the fitted values and weights.",
        uses: [
            "Exploring scatterplots with a flexible trend line",
            "Removing slow drift from time-series measurements",
            "Robust regression when outliers are expected",
        ],
        references: [
            "Cleveland, Robust Locally Weighted Regression and Smoothing Scatterplots, 1979",
            "Cleveland and Devlin, Locally Weighted Regression, 1988",
        ],
        workedExample:
            "For points lying on y = 2x + 1, every local weighted line has slope two and intercept one, so LOWESS returns the same values to machine precision. Adding one extreme outlier in the middle barely moves the nearby fitted values after the robustness reweighting pass.",
    },
    id: "lowess-smoothing",
    name: "LOWESS Smoothing",
    category: "statistics-probability",
    complexity: { time: "O(t n^2 log n)", space: "O(n)" },
    defaultInput: {
        x: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        y: [0, 1.8, 2.2, 3.1, 3.8, 5.2, 5.9, 7.1, 8],
        frac: 0.5,
        iterations: 2,
    },
    visualType: "point",
    run,
    pseudocode: [
        "sort the observations by their x values",
        "choose the span and set all robustness weights to one",
        "for each target x find the distance to the r-th nearest neighbor",
        "fit a weighted line with tricube times robustness weights",
        "evaluate the fitted line at the target and store the value",
        "recompute bisquare robustness weights from the residuals",
        "repeat for the requested number of passes",
        "done: report the smoothed values",
    ],
};

export default module;
