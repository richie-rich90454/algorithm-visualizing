/**
 * method-of-moments.ts - Method of Moments Estimation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The method of moments estimates distribution parameters by equating sample
 * moments to theoretical moments. This module handles four families. For an
 * exponential law lambda is one over the mean; for a normal law the mean and
 * variance estimate mu and sigma squared; for a uniform law on [0, theta] the
 * estimate is twice the mean; for a gamma law the scale is variance over mean
 * and the shape is mean squared over variance. Data may be supplied directly or
 * generated from known parameters with a deterministic seeded generator.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(count) to accumulate moments and O(count) to generate the sample
 *   Space: O(count) for the retained data
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the observed data values, downsampled when there are many.
 *   - The bar at the current chunk boundary is yellow; processed ones are green.
 *   - Each frame reports the running moment estimates for the chosen family.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Family = "exponential" | "normal" | "uniform" | "gamma";

interface MoMInput {
    family?: Family;
    data?: number[];
    lambda?: number;
    mu?: number;
    sigma?: number;
    theta?: number;
    alpha?: number;
    beta?: number;
    seed?: number;
    count?: number;
}

interface Estimates {
    lambdaHat: number;
    muHat: number;
    sigmaHat: number;
    thetaHat: number;
    shapeHat: number;
    scaleHat: number;
}

function makeUniform(seed: number): () => number {
    let state = (seed >>> 0) || 1;
    return () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return (state + 0.5) / 4294967296;
    };
}

/** Box-Muller normal generator driven by one uniform stream. */
function makeNormal(uniform: () => number): () => number {
    return () => {
        const u1 = Math.max(1e-12, uniform());
        const u2 = uniform();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };
}

/** Marsaglia-Tsang gamma sampler with shape and scale. */
function gammaSample(
    shape: number,
    scale: number,
    normal: () => number,
    uniform: () => number,
): number {
    if (shape < 1) {
        return gammaSample(shape + 1, scale, normal, uniform) * Math.pow(Math.max(1e-12, uniform()), 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (let iteration = 0; iteration < 1000; iteration += 1) {
        const x = normal();
        const base = 1 + c * x;
        if (base <= 0) continue;
        const v = base * base * base;
        const u = uniform();
        if (u < 1 - 0.0331 * x * x * x * x) return scale * d * v;
        if (Math.log(Math.max(1e-12, u)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return scale * d * v;
    }
    return scale * shape;
}

function estimate(family: Family, mean: number, variance: number): Estimates {
    const empty: Estimates = { lambdaHat: 0, muHat: 0, sigmaHat: 0, thetaHat: 0, shapeHat: 0, scaleHat: 0 };
    if (!Number.isFinite(mean) || !Number.isFinite(variance)) return empty;
    if (family === "exponential") {
        return { ...empty, lambdaHat: mean > 0 ? 1 / mean : 0 };
    }
    if (family === "normal") {
        return { ...empty, muHat: mean, sigmaHat: Math.sqrt(Math.max(0, variance)) };
    }
    if (family === "uniform") {
        return { ...empty, thetaHat: 2 * mean };
    }
    if (mean > 0 && variance > 0) {
        return { ...empty, shapeHat: (mean * mean) / variance, scaleHat: variance / mean };
    }
    return empty;
}

function makeBars(data: number[], stepSize: number): VisualEntity[] {
    return data.map((value, index) => {
        let state: EntityState = "idle";
        if (stepSize > 0 && index < stepSize) state = "sorted";
        else if (stepSize > 0 && index === stepSize) state = "comparing";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value },
        };
    });
}

/** The method of moments generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MoMInput | null) ?? {};
    const family: Family = task.family === "normal" || task.family === "uniform" || task.family === "gamma"
        ? task.family
        : "exponential";
    const seed = typeof task.seed === "number" ? (task.seed >>> 0) : 777;
    const count = typeof task.count === "number" ? Math.max(1, Math.min(50000, Math.floor(task.count))) : 2000;
    const uniform = makeUniform(seed);
    const normal = makeNormal(uniform);
    const lambda = typeof task.lambda === "number" && task.lambda > 0 ? task.lambda : 0.5;
    const mu = typeof task.mu === "number" ? task.mu : 2;
    const sigma = typeof task.sigma === "number" && task.sigma > 0 ? task.sigma : 3;
    const theta = typeof task.theta === "number" && task.theta > 0 ? task.theta : 10;
    const alpha = typeof task.alpha === "number" && task.alpha > 0 ? task.alpha : 2;
    const beta = typeof task.beta === "number" && task.beta > 0 ? task.beta : 2;

    let data: number[] = [];
    if (Array.isArray(task.data) && task.data.length > 0) {
        data = task.data.map((value) => Number(value) || 0);
    } else {
        for (let i = 0; i < count; i += 1) {
            if (family === "exponential") {
                data.push(-Math.log(Math.max(1e-12, uniform())) / lambda);
            } else if (family === "normal") {
                data.push(mu + sigma * normal());
            } else if (family === "uniform") {
                data.push(theta * uniform());
            } else {
                data.push(gammaSample(alpha, beta, normal, uniform));
            }
        }
    }
    const truthLabel = family === "exponential" ? "lambda" : family === "uniform" ? "theta" : family === "gamma" ? "shape" : "mu";
    const truthValue = family === "exponential" ? lambda : family === "uniform" ? theta : family === "gamma" ? alpha : mu;

    const display = data.length > 60 ? data.filter((_value, index) => index % Math.ceil(data.length / 60) === 0) : data;
    const chunk = Math.max(1, Math.floor(data.length / 24));
    let runningSum = 0;
    let runningSquares = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(display, 0),
        edges: [],
        description: `Estimating ${family} parameters by matching sample moments on ${data.length} observations.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { family, count: data.length, mean: 0, variance: 0, lambdaHat: 0, muHat: 0, sigmaHat: 0, thetaHat: 0, shapeHat: 0, scaleHat: 0, truthLabel, truthValue, complete: false },
    };
    let step = 1;

    for (let i = 0; i < data.length; i += 1) {
        runningSum += data[i] as number;
        runningSquares += (data[i] as number) * (data[i] as number);
        const seen = i + 1;
        if (seen % chunk !== 0 && seen !== data.length) continue;
        const mean = runningSum / seen;
        const variance = Math.max(0, runningSquares / seen - mean * mean);
        const result = estimate(family, mean, variance);
        const boundary = Math.min(display.length, Math.ceil((seen / data.length) * display.length));
        yield {
            stepNumber: step,
            entities: makeBars(display, boundary),
            edges: [],
            description: `After ${seen} observations: mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}; current estimate ${result[family === "exponential" ? "lambdaHat" : family === "normal" ? "muHat" : family === "uniform" ? "thetaHat" : "shapeHat"].toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { family, count: data.length, mean, variance, ...result, truthLabel, truthValue, complete: false },
        };
        step += 1;
    }

    const mean = runningSum / data.length;
    const variance = Math.max(0, runningSquares / data.length - mean * mean);
    const result = estimate(family, mean, variance);
    yield {
        stepNumber: step,
        entities: makeBars(display, 0),
        edges: [],
        description: `Method of moments: ${truthLabel} estimate ${result[family === "exponential" ? "lambdaHat" : family === "normal" ? "muHat" : family === "uniform" ? "thetaHat" : "shapeHat"].toFixed(4)} against true ${truthValue.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { family, count: data.length, mean, variance, ...result, truthLabel, truthValue, complete: true },
    };
}

/** The method of moments module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A distribution's theoretical moments are formulas in its parameters, such as the exponential mean being one over its rate. Replace the theoretical mean and variance with the ones measured from data, then solve those equations for the parameters. It is often the quickest way to get a usable starting estimate before a more expensive fit.",
        invariants: [
            "The sample mean is the average of all observations seen so far.",
            "The sample variance is the mean of squares minus the square of the mean.",
            "Each estimate solves the moment equation exactly for its family.",
            "For a gamma fit both the shape and scale must be positive.",
        ],
        correctness:
            "For each family the theoretical moments are invertible functions of the parameters on the valid domain. The exponential mean 1/lambda gives lambda = 1/mean; a uniform on [0, theta] has mean theta/2 giving theta = 2 times the mean; a normal has mean mu and variance sigma squared; and a gamma has mean shape times scale and variance shape times scale squared, giving scale = variance/mean and shape = mean squared/variance. Substituting the sample moments therefore yields parameters whose implied moments match the sample by construction, and the law of large numbers makes those sample moments converge to the truth.",
        complexityRationale:
            "Generating the sample costs one random draw per observation, and accumulating the sum and sum of squares is constant work each, so generation and fitting are both O(count). Only the retained data array is stored, giving O(count) space.",
        uses: [
            "Initializing parameters before maximum likelihood search",
            "Quick parameter fitting for quality control and reliability data",
            "Teaching the link between moments and distribution parameters",
        ],
        references: [
            "Casella and Berger, Statistical Inference, Chapter 9",
            "Pearson, Contributions to the Mathematical Theory of Evolution, 1894",
        ],
        workedExample:
            "For observations 1, 2, 3, 4, 5 the sample mean is 3 and the variance is 2. An exponential fit gives lambda = 1/3 about 0.333. A uniform fit on [0, theta] gives theta = 6. A normal fit gives mu = 3 and sigma = sqrt(2) about 1.414. A gamma fit gives scale = 2/3 and shape = 9/2 = 4.5.",
    },
    id: "method-of-moments",
    name: "Method of Moments",
    category: "statistics-probability",
    complexity: { time: "O(count)", space: "O(count)" },
    defaultInput: { family: "exponential", lambda: 0.5, seed: 777, count: 2000 },
    visualType: "array",
    run,
    pseudocode: [
        "read the family and either data or generator parameters",
        "accumulate the running sum and sum of squares of the observations",
        "compute the sample mean and sample variance",
        "exponential: set lambda to one over the mean",
        "uniform: set theta to twice the mean; normal: use mean and variance",
        "gamma: set scale to variance over mean and shape to mean squared over variance",
        "done: report the parameter estimates for the chosen family",
    ],
};

export default module;
