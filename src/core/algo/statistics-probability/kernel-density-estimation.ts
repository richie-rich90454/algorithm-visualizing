/**
 * kernel-density-estimation.ts - Gaussian Kernel Density Estimation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Kernel density estimation builds a smooth curve from a finite sample by
 * placing a small bump on every observation and adding the bumps together.
 * This module uses the Gaussian kernel: each query point receives a weighted
 * sum of bell curves centered on the data, scaled so the whole curve integrates
 * to one. The bandwidth controls the amount of smoothing.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * m) for n sample values and m query points
 *   Space: O(m) for the displayed density bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each query point is drawn as a bar whose height is the estimated density.
 *   - The bar currently being evaluated is highlighted.
 *   - The final frame is green and reports the whole density profile.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const SQRT_TWO_PI = Math.sqrt(2 * Math.PI);

function densityAt(query: number, values: number[], bandwidth: number): number {
    let total = 0;
    for (const value of values) {
        const z = (query - value) / bandwidth;
        total += Math.exp(-0.5 * z * z);
    }
    return total / (values.length * bandwidth * SQRT_TWO_PI);
}

function makeBars(query: number[], densities: number[], active: number, done: boolean): VisualEntity[] {
    return query.map((point, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: (densities[index] ?? 0).toFixed(4),
        value: densities[index] ?? 0,
        state: done ? "sorted" : (index === active ? "comparing" : "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, query: point, density: densities[index] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; bandwidth?: number; query?: number[] } | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map((v) => Number(v) || 0)
        : [1, 2, 3, 4, 5];
    const bandwidth = typeof task.bandwidth === "number" && task.bandwidth > 0 ? task.bandwidth : 1;
    let query: number[];
    if (Array.isArray(task.query) && task.query.length > 0) {
        query = task.query.map((q) => Number(q) || 0);
    } else {
        const lo = Math.min(...values) - bandwidth;
        const hi = Math.max(...values) + bandwidth;
        query = Array.from({ length: 21 }, (_, i) => lo + ((hi - lo) * i) / 20);
    }
    const densities = query.map((point) => densityAt(point, values, bandwidth));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(query, densities, -1, false),
        edges: [],
        description: `Estimating a density from ${values.length} sample value(s) with bandwidth ${bandwidth.toFixed(3)} at ${query.length} query point(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: values.length, bandwidth, points: query.length, query, densities: [0] },
    };
    step += 1;

    for (let i = 0; i < query.length; i += 1) {
        const point = query[i] ?? 0;
        const density = densities[i] ?? 0;
        yield {
            stepNumber: step,
            entities: makeBars(query, densities, i, false),
            edges: [],
            description: `At ${point.toFixed(3)} the ${values.length} Gaussian kernels sum to density ${density.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n: values.length, bandwidth, points: query.length, current: i, queryPoint: point, density },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(query, densities, -1, true),
        edges: [],
        description: `Complete density profile: ${query.length} point(s) evaluated, peak density ${Math.max(...densities).toFixed(5)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n: values.length, bandwidth, points: query.length, query, densities, peak: Math.max(...densities) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A histogram chunks data into bins and loses detail inside each bin. Kernel density estimation instead lays a tiny bell curve on every observation and adds them, producing a smooth curve that follows where the data cluster. A small bandwidth follows every wiggle; a large one washes out detail.",
        invariants: [
            "Each Gaussian kernel integrates to one, so the average of the kernels also integrates to one.",
            "The estimate is smooth and nonnegative everywhere.",
            "For symmetric data the estimated curve is symmetric about the center of the sample.",
        ],
        correctness:
            "The Gaussian kernel K(u) is exp(-u squared / 2) divided by sqrt(2 pi), which integrates to one. Substituting u = (x - x_i) / h gives a kernel centered at x_i with total area one when scaled by 1/h. Averaging over the n observations keeps the total area at one and yields the standard estimator. Each query value is computed directly from that definition, and a fine-grid trapezoidal sum recovers a value arbitrarily close to one.",
        complexityRationale:
            "Every one of the m query points evaluates a Gaussian at each of the n observations, so the time is O(n * m). Only the m density values and their bars are stored, giving O(m) space beyond the input.",
        uses: [
            "Visualizing the shape of a data set without choosing histogram bins",
            "Estimating probability density for anomaly detection",
            "Smoothing spatial point patterns such as crime or disease incidents",
        ],
        references: [
            "Rosenblatt, Remarks on Some Nonparametric Estimates of a Density Function, 1956",
            "Parzen, On Estimation of a Probability Density Function, 1962",
        ],
        workedExample:
            "With the sample 1, 2 and bandwidth 1, the density at 1.5 is the average of two Gaussian bells centered at 1 and 2. Each contributes exp(-0.125) divided by sqrt(2 pi), so the sum divided by two is about 0.3525, slightly higher than the density at 0 because two centers are nearby.",
    },
    id: "kernel-density-estimation",
    name: "Kernel Density Estimation",
    category: "statistics-probability",
    complexity: { time: "O(n * m)", space: "O(m)" },
    defaultInput: { values: [1, 2, 3, 4, 5], bandwidth: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "read the sample, bandwidth, and query points",
        "for each query point set the density accumulator to zero",
        "for each sample add exp(-((q-x)/h)^2 / 2) to the accumulator",
        "divide by sample size times bandwidth times sqrt(2 pi)",
        "store the resulting density for the query point",
        "report the density at every query point",
    ],
};

export default module;
