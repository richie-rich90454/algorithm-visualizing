/**
 * peaks-over-threshold.ts - Peaks Over Threshold Extreme Value Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The peaks-over-threshold method models only observations that exceed a high
 * threshold. Exceedances are fitted with a generalized Pareto distribution,
 * whose shape controls the tail heaviness and whose scale sets the spread.
 * The fitted law is then inverted to obtain return levels for chosen return
 * periods, the central product of extreme value analysis.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(exceedances + points + returnPeriods)
 *   Space: O(exceedances + points) for the tail and fitted curve
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per exceedance shows the observed excess over the threshold.
 *   - A second curve shows the fitted generalized Pareto survival function.
 *   - The final frame reports the fitted shape, scale, and return levels.
 */

import type { AlgorithmModule, MetaValue, VisualEntity, VisualFrame } from "@/types";

interface Fit {
    xi: number;
    sigma: number;
    rate: number;
}

/** Method-of-moments fit of a generalized Pareto to positive exceedances. */
function fitGpd(exceedances: number[], years: number): Fit {
    const n = exceedances.length;
    const mean = exceedances.reduce((a, b) => a + b, 0) / n;
    const variance = exceedances.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    let xi = 0;
    if (variance > 1e-12) xi = 0.5 * (1 - (mean * mean) / variance);
    xi = Math.max(-0.49, Math.min(0.49, xi));
    const sigma = Math.max(1e-9, mean * (1 - xi));
    return { xi, sigma, rate: n / Math.max(years, 1) };
}

/** Generalized Pareto survival S(z) = (1 + xi z / sigma)^(-1/xi). */
function gpdSurvival(z: number, xi: number, sigma: number): number {
    if (z <= 0) return 1;
    if (Math.abs(xi) < 1e-9) return Math.exp(-z / sigma);
    const base = 1 + (xi * z) / sigma;
    if (base <= 0) return 0;
    return Math.pow(base, -1 / xi);
}

/** Return level for a period of N years given exceedance rate zeta. */
function returnLevel(period: number, fit: Fit, threshold: number): number {
    const exposure = period * fit.rate;
    if (exposure <= 0) return threshold;
    if (Math.abs(fit.xi) < 1e-9) return threshold + fit.sigma * Math.log(exposure);
    return threshold + (fit.sigma / fit.xi) * (Math.pow(exposure, fit.xi) - 1);
}

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        exceedances?: number[]; threshold?: number; years?: number; returnPeriods?: number[]; points?: number;
    } | null) ?? {};
    const threshold = typeof task.threshold === "number" ? task.threshold : 10;
    const raw = Array.isArray(task.exceedances)
        ? task.exceedances.filter((v) => typeof v === "number" && v > threshold)
        : [];
    const exceedances = raw.length > 0 ? raw : [0.4, 0.9, 1.3, 0.2, 2.1, 1.7, 0.6, 3.2, 1.1, 0.8, 2.6, 0.5];
    const years = typeof task.years === "number" && task.years > 0 ? task.years : 10;
    const returnPeriods = Array.isArray(task.returnPeriods) && task.returnPeriods.length > 0
        ? task.returnPeriods : [2, 5, 10, 25, 50, 100];
    const points = typeof task.points === "number"
        ? Math.max(5, Math.min(200, Math.floor(task.points))) : 60;
    const fit = fitGpd(exceedances, years);
    const zMax = Math.max(...exceedances) * 1.8 + 1;
    const zs = Array.from({ length: points + 1 }, (_, i) => (zMax * i) / points);
    const levels: { period: number; level: number; annualExceedance: number }[] = returnPeriods.map((period) => ({
        period,
        level: returnLevel(period, fit, threshold),
        annualExceedance: 1 / period,
    }));

    yield {
        stepNumber: 0,
        entities: makeBars(exceedances, -1, false),
        edges: [],
        description: `Modeling ${exceedances.length} exceedances over threshold ${threshold} with a generalized Pareto tail.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            threshold, years, exceedances, xi: fit.xi, sigma: fit.sigma, rate: fit.rate,
            points, zs, survival: [], returnLevels: levels, complete: false,
        },
    };
    let step = 1;
    const survival: number[] = [];
    for (let i = 0; i < zs.length; i += 1) {
        const value = gpdSurvival(zs[i] as number, fit.xi, fit.sigma);
        survival.push(value);
        yield {
            stepNumber: step,
            entities: makeBars(survival, i, false),
            edges: [],
            description: `Fitted tail survival at excess ${(zs[i] as number).toFixed(3)} is ${value.toFixed(6)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                threshold, years, exceedances, xi: fit.xi, sigma: fit.sigma, rate: fit.rate,
                points, zs, survival: [...survival], returnLevels: levels, complete: false,
            },
        };
        step += 1;
    }

    const summary: MetaValue = { xi: fit.xi, sigma: fit.sigma, rate: fit.rate, levels };
    yield {
        stepNumber: step,
        entities: makeBars(survival, points + 1, true),
        edges: [],
        description: `Tail fitted: shape ${fit.xi.toFixed(4)}, scale ${fit.sigma.toFixed(4)}, ${levels.length} return level(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            threshold, years, exceedances, xi: fit.xi, sigma: fit.sigma, rate: fit.rate,
            points, zs, survival, returnLevels: levels, fit: summary, complete: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than throw away all but the annual maximum, keep every observation above a high threshold. Those excesses tend to follow a generalized Pareto law. Fit its shape and scale, then invert the survival function to find the level exceeded once every ten, fifty, or hundred years.",
        invariants: [
            "Exceedances are strictly positive excesses above the threshold.",
            "The fitted survival starts at one for zero excess and decreases.",
            "Longer return periods always give higher return levels.",
        ],
        correctness:
            "The pickands theorem states that, for a sufficiently high threshold, excesses converge to a generalized Pareto distribution with survival (1 + xi z / sigma)^(-1/xi). The method-of-moments estimates set the mean to sigma/(1-xi) and the variance to sigma squared over (1-xi) squared (1-2xi), which solve to xi = (1 - mean squared / variance)/2 and sigma = mean times (1-xi). A return level with annual exceedance rate zeta satisfies S(z) = 1/(N zeta), and inverting the survival gives the reported level, so evaluating the fitted survival at that level returns exactly 1/(N zeta).",
        complexityRationale:
            "Fitting scans the exceedances once for mean and variance, the curve evaluates the survival at each grid point, and each return level is a closed-form inversion. Total time is O(exceedances plus points plus periods) with linear space.",
        uses: [
            "Estimating flood, storm, and heat-wave return levels",
            "Setting engineering design thresholds for extreme loads",
            "Tail risk measurement in finance and insurance",
        ],
        references: [
            "Pickands, Statistical Inference Using Extreme Order Statistics, 1975",
            "Coles, An Introduction to Statistical Modeling of Extreme Values, 2001",
        ],
        workedExample:
            "Suppose twenty exceedances over ten years give a rate of two per year and a fitted shape of 0.1 with scale 1.5 above a threshold of 10. The two-year level solves (10 years times 2) to the shape power, giving roughly 10 plus 15 times (4 to the 0.1 minus 1), about 12.3. Evaluating the fitted survival at that excess returns one half, as required.",
    },
    id: "peaks-over-threshold",
    name: "Peaks Over Threshold Extreme Value Method",
    category: "statistics-probability",
    complexity: { time: "O(n + points + periods)", space: "O(n + points)" },
    defaultInput: {
        threshold: 10,
        years: 10,
        exceedances: [0.4, 0.9, 1.3, 0.2, 2.1, 1.7, 0.6, 3.2, 1.1, 0.8, 2.6, 0.5],
        returnPeriods: [2, 5, 10, 25, 50, 100],
        points: 60,
    },
    visualType: "array",
    run,
    pseudocode: [
        "collect observations that exceed the threshold",
        "compute the mean and variance of the excesses",
        "set shape to (1 - mean squared / variance) / 2",
        "set scale to mean times (1 - shape)",
        "set exceedance rate to count divided by years",
        "for each grid excess evaluate the Pareto survival",
        "for each return period invert the survival for its level",
        "done: report the fitted curve and return levels",
    ],
};

export default module;
