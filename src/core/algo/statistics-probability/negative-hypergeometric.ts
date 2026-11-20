/**
 * negative-hypergeometric.ts - Negative Hypergeometric Distribution
 *
 * Draw items one at a time without replacement from a population with K
 * successes out of N items, stopping when r successes have appeared. This
 * module computes the mass function of the number of failures observed before
 * that stopping time. It differs from the ordinary hypergeometric, which fixes
 * the number of draws instead of the number of successes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const LANCZOS = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953,
];

function logGamma(z: number): number {
    let y = z;
    let t = z + 5.5;
    t -= (z + 0.5) * Math.log(t);
    let ser = 1.000000000190015;
    for (const c of LANCZOS) {
        y += 1;
        ser += c / y;
    }
    return -t + Math.log((2.5066282746310005 * ser) / z);
}

function logChoose(n: number, k: number): number {
    if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
    return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

/** P(failures before the r-th success = k). */
function pmf(k: number, N: number, K: number, r: number): number {
    const logP = logChoose(k + r - 1, r - 1) + logChoose(N - k - r, K - r) - logChoose(N, K);
    if (!Number.isFinite(logP)) return 0;
    return Math.exp(logP);
}

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((p, k) => {
        let state: EntityState = "idle";
        if (done) state = "sorted";
        else if (k === active) state = "comparing";
        else if (k < active) state = "visited";
        return {
            id: `bar-${k}`,
            type: "bar" as const,
            label: p.toFixed(5),
            value: p,
            state,
            x: k,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: k, probability: p },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { N?: number; K?: number; r?: number } | null) ?? {};
    const N = Math.min(60, Math.max(2, Math.floor(Number(task.N ?? 12)) || 12));
    const r = Math.min(N, Math.max(1, Math.floor(Number(task.r ?? 3)) || 3));
    const K = Math.min(N, Math.max(r, Math.floor(Number(task.K ?? 6)) || 6));
    const maxFailures = N - K;
    const values = Array.from({ length: maxFailures + 1 }, (_, k) => pmf(k, N, K, r));
    const mean = (r * (N - K)) / (K + 1);
    const total = values.reduce((sum, p) => sum + p, 0);

    yield {
        stepNumber: 0,
        entities: makeBars(values.map(() => 0), -1, false),
        edges: [],
        description: `Negative hypergeometric: draw without replacement from ${N} items with ${K} successes until ${r} successes appear.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { N, K, r, mean, total, pmf: values.map(() => 0) },
    };

    let step = 1;
    for (let k = 0; k <= maxFailures; k += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(values, k, false),
            edges: [],
            description: `P(${k} failures before success ${r}) = C(${k + r - 1},${r - 1}) C(${N - k - r},${K - r}) / C(${N},${K}) = ${values[k]!.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { N, K, r, mean, total, pmf: values.slice(0, k + 1) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(values, -1, true),
        edges: [],
        description: `The masses over 0..${maxFailures} failures sum to ${total.toFixed(9)}; expected failures are ${mean.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { N, K, r, mean, total, pmf: [...values], done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "This distribution answers a stopping question: how many failures will we see before collecting a fixed number of successes, when we draw without replacement? Because the pool shrinks as we draw, the odds change each time, which is what separates it from the negative binomial with its constant success chance.",
        invariants: [
            "The support is zero through N minus K failures.",
            "The masses are nonnegative and sum to one by Vandermonde's identity.",
            "The expected number of failures is r times N minus K over K plus one.",
        ],
        correctness:
            "For exactly k failures before the r-th success, the last draw must be a success, the preceding k plus r minus one draws contain r minus one successes and k failures, and the remaining unobserved positions hold the leftover successes. Counting those position choices and dividing by all C(N, K) placements gives the mass. Summing over k is Vandermonde's convolution, so the masses total one, and the mean follows from the known expected stopping time r times N plus one over K plus one.",
        complexityRationale:
            "There are N minus K plus one support points, each needing a constant number of log-gamma calls, so time and displayed space are both O(N).",
        uses: [
            "Quality control when sampling until a quota of good items is found",
            "Analysis of contests that stop after a fixed number of wins",
            "Ranking and order-statistics identities in finite populations",
        ],
        references: [
            "Johnson, Kotz and Balakrishnan, Discrete Distributions, Chapter on negative hypergeometric",
            "Guenther, Optimal Stopping Rules with Finite Populations, 1975",
        ],
        workedExample:
            "With N = 12, K = 6 and r = 3, the expected number of failures before the third success is 3 times 6 over 7, about 2.57. The chance of no failures at all is C(2,2) C(9,3) over C(12,6), about 0.0909.",
    },
    id: "negative-hypergeometric",
    name: "Negative Hypergeometric Distribution",
    category: "statistics-probability",
    complexity: { time: "O(N)", space: "O(N)" },
    defaultInput: { N: 12, K: 6, r: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "read the population N, success count K, and target r",
        "set the support to zero through N minus K failures",
        "for each failure count k in the support",
        "compute C(k+r-1, r-1) times C(N-k-r, K-r)",
        "divide by C(N, K) using log-gamma arithmetic",
        "accumulate the expected number of failures",
        "done: report the failure-count mass function",
    ],
};

export default module;
