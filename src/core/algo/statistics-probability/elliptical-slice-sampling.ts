/**
 * elliptical-slice-sampling.ts - Elliptical Slice Sampling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Elliptical slice sampling draws from a posterior whose prior is multivariate
 * normal by moving around an ellipse defined by the current state and a fresh
 * prior draw. A slice of the likelihood along that ellipse is located by
 * bracketing and shrinking an angle interval, then a point on the slice is
 * chosen. Every accepted move leaves the target posterior invariant, so the
 * chain explores correlated Gaussian posteriors efficiently without tuning a
 * step size.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(samples * bracketingIterations * dimension)
 *   Space: O(samples) for the collected chain
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each retained state is drawn at its two-dimensional coordinates.
 *   - The earliest burn-in states are dim; retained states are highlighted.
 *   - The final frame reports the sample mean and the analytic posterior mean.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Vec2 = [number, number];

function makeRng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function standardNormal(rng: () => number): number {
    const u1 = Math.max(1e-12, rng());
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Lower-triangular Cholesky factor entries of a 2x2 positive-definite matrix. */
function cholesky2(a: number, b: number, d: number): [number, number, number] {
    const l00 = Math.sqrt(a);
    const l10 = b / l00;
    const l11 = Math.sqrt(d - l10 * l10);
    return [l00, l10, l11];
}

function logLikelihood(x: Vec2, mean: Vec2, precision: number): number {
    const dx0 = x[0] - mean[0];
    const dx1 = x[1] - mean[1];
    return -0.5 * precision * (dx0 * dx0 + dx1 * dx1);
}

/** One elliptical slice step with bracket-and-shrink on the angle. */
function sliceStep(x: Vec2, e: Vec2, logY: number, mean: Vec2, precision: number, rng: () => number): Vec2 {
    let theta = rng() * 2 * Math.PI;
    let lower = theta - 2 * Math.PI;
    let upper = theta;
    for (let iter = 0; iter < 200; iter += 1) {
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        const candidate: Vec2 = [x[0] * c + e[0] * s, x[1] * c + e[1] * s];
        if (logLikelihood(candidate, mean, precision) >= logY) return candidate;
        if (theta < 0) lower = theta;
        else upper = theta;
        theta = lower + rng() * (upper - lower);
    }
    return x;
}

function makeEntities(points: Vec2[], current: number, burnIn: number): VisualEntity[] {
    return points.map((point, index) => ({
        id: `state-${index}`,
        type: "node" as const,
        label: index < burnIn ? "" : "S",
        value: point,
        state: index > current ? "unvisited" : index < burnIn ? "idle" : "sorted",
        x: point[0],
        y: point[1],
        width: 0,
        height: 0,
        metadata: { index, x: point[0], y: point[1], burnIn: index < burnIn },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; samples?: number; burnIn?: number } | null) ?? {};
    const seed = typeof task.seed === "number" ? task.seed : 77;
    const samples = typeof task.samples === "number"
        ? Math.max(10, Math.min(20000, Math.floor(task.samples))) : 3000;
    const burnIn = typeof task.burnIn === "number" ? Math.max(0, Math.min(samples - 1, Math.floor(task.burnIn))) : 200;
    const rng = makeRng(seed);

    const priorA = 1;
    const priorB = 0.6;
    const priorD = 1;
    const [l00, l10, l11] = cholesky2(priorA, priorB, priorD);
    const likelihoodMean: Vec2 = [1, -1];
    const likelihoodPrecision = 2;

    const det = priorA * priorD - priorB * priorB;
    const priorInvA = priorD / det;
    const priorInvB = -priorB / det;
    const priorInvD = priorA / det;
    const postA = priorInvA + likelihoodPrecision;
    const postB = priorInvB;
    const postD = priorInvD + likelihoodPrecision;
    const postDet = postA * postD - postB * postB;
    const posteriorMean: Vec2 = [
        ((postD * likelihoodPrecision * likelihoodMean[0]) - (postB * likelihoodPrecision * likelihoodMean[1])) / postDet,
        ((-postB * likelihoodPrecision * likelihoodMean[0]) + (postA * likelihoodPrecision * likelihoodMean[1])) / postDet,
    ];

    let currentState: Vec2 = [0, 0];
    const chain: Vec2[] = [];
    for (let i = 0; i < samples + burnIn; i += 1) {
        const nu: Vec2 = [standardNormal(rng), standardNormal(rng)];
        const e: Vec2 = [l00 * nu[0], l10! * nu[0] + l11! * nu[1]];
        const logY = logLikelihood(currentState, likelihoodMean, likelihoodPrecision) + Math.log(Math.max(1e-12, rng()));
        currentState = sliceStep(currentState, e, logY, likelihoodMean, likelihoodPrecision, rng);
        if (i >= burnIn) chain.push(currentState);
    }

    const sumX = chain.reduce((acc, p) => acc + p[0], 0);
    const sumY = chain.reduce((acc, p) => acc + p[1], 0);
    const sampleMean: Vec2 = [sumX / chain.length, sumY / chain.length];

    yield {
        stepNumber: 0,
        entities: [],
        edges: [],
        description: `Sampling ${samples} states with elliptical slice sampling after ${burnIn} burn-in steps.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { seed, samples, burnIn, sampleMean: [0, 0], posteriorMean, chain: [], complete: false },
    };
    let step = 1;
    const stride = Math.max(1, Math.floor(chain.length / 40));
    const shown: Vec2[] = [];
    for (let i = 0; i < chain.length; i += 1) {
        shown.push(chain[i]!);
        if (i % stride === stride - 1 || i === chain.length - 1) {
            yield {
                stepNumber: step,
                entities: makeEntities(shown.slice(), i, 0),
                edges: [],
                description: `Retained state ${i + 1}: position (${chain[i]![0].toFixed(3)}, ${chain[i]![1].toFixed(3)}).`,
                codeLineNumber: 3,
                layout: "point",
                meta: { seed, samples, burnIn, sampleMean: [0, 0], posteriorMean, chain: shown.slice(), complete: false },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities(chain, chain.length - 1, 0),
        edges: [],
        description: `Sample mean (${sampleMean[0].toFixed(3)}, ${sampleMean[1].toFixed(3)}) versus analytic posterior mean (${posteriorMean[0].toFixed(3)}, ${posteriorMean[1].toFixed(3)}).`,
        codeLineNumber: 6,
        layout: "point",
        meta: { seed, samples, burnIn, sampleMean, posteriorMean, chain, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "With a Gaussian prior, a fresh prior draw and the current state span an ellipse that lies inside the prior's typical set. Slice sampling finds an interval of angles along that ellipse whose likelihood exceeds a random threshold, then picks an angle in the interval. Moving to the corresponding point preserves the posterior exactly and needs no step-size tuning.",
        invariants: [
            "Every proposal lies on the ellipse defined by the current state and a prior draw.",
            "The bracket always contains angle zero, which is the current state.",
            "Each accepted move keeps the slice level at or below the current log likelihood.",
        ],
        correctness:
            "Elliptical slice sampling is a slice sampler in disguise: the angle parametrizes a one-dimensional slice of the joint density, and the bracketing procedure draws uniformly from the region above the slice level. Slice sampling leaves the target distribution invariant, so the Markov chain has the Gaussian posterior as its stationary law. The bracketing shrinks an interval that always contains angle zero, where the likelihood is at least the threshold, guaranteeing termination with a valid slice point.",
        complexityRationale:
            "Each iteration draws a two-dimensional prior vector, then repeats a cheap likelihood evaluation and angle update until the bracket is found; in practice a handful of iterations suffice. Time is O(samples times iterations times dimension) and space is O(samples).",
        uses: [
            "Sampling Gaussian-process posteriors in machine learning",
            "Bayesian inference with correlated normal priors",
            "Replacing tuned random-walk Metropolis in high dimensions",
        ],
        references: [
            "Murray, Adams, and MacKay, Elliptical Slice Sampling, 2010",
            "Neal, Slice Sampling, Annals of Statistics, 2003",
        ],
        workedExample:
            "Take a standard correlated normal prior and a likelihood centered at (1, -1) with precision two. The posterior mean is about (0.44, -0.44). Starting at the origin, an ellipse draw proposes points around the prior; the slice step keeps those with sufficiently high likelihood, and after a few thousand iterations the sample mean lands close to that analytic value.",
    },
    id: "elliptical-slice-sampling",
    name: "Elliptical Slice Sampling",
    category: "statistics-probability",
    complexity: { time: "O(samples * iterations * d)", space: "O(samples)" },
    defaultInput: { seed: 77, samples: 3000, burnIn: 200 },
    visualType: "point",
    run,
    pseudocode: [
        "read sample count and burn-in length",
        "compute the Cholesky factor of the normal prior",
        "start the chain at the origin",
        "for each iteration draw a prior direction and form the ellipse",
        "set the slice level to current likelihood times a uniform draw",
        "bracket an angle interval and shrink until a slice point is found",
        "move to the accepted point and retain it after burn-in",
        "done: report the sample mean and analytic posterior mean",
    ],
};

export default module;
