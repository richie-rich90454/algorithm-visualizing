/**
 * zero-inflated-poisson.ts - Zero-Inflated Poisson Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A zero-inflated Poisson model mixes a point mass at zero with an ordinary
 * Poisson count distribution. With inflation probability pi, an observation is
 * a structural zero with probability pi, otherwise it is drawn from Poisson(lambda).
 * The module builds the probability mass function over k = 0..maxK and reports
 * the closed-form mean and variance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(maxK) for the mass function and cumulative curve
 *   Space: O(maxK) for the displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per count k shows P(X = k), with a tall bar at k = 0.
 *   - The bar currently being evaluated is highlighted.
 *   - The final frame reports the mean and variance of the mixture.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Factorial of a small nonnegative integer. */
function factorial(n: number): number {
    let result = 1;
    for (let i = 2; i <= n; i += 1) result *= i;
    return result;
}

/** Independent Poisson probability used to build the mixture. */
function poissonPmf(k: number, lambda: number): number {
    return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

/** Build mass-function bars, revealing the first `revealed` entries. */
function makeBars(pmf: number[], revealed: number): VisualEntity[] {
    return pmf.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(6),
        value,
        state: index === revealed ? "comparing" : index < revealed ? "sorted" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pi?: number; lambda?: number; maxK?: number } | null) ?? {};
    const pi = typeof task.pi === "number" ? Math.max(0, Math.min(1, task.pi)) : 0.3;
    const lambda = typeof task.lambda === "number" && task.lambda > 0 ? task.lambda : 2.5;
    const maxK = typeof task.maxK === "number" ? Math.max(5, Math.min(200, Math.floor(task.maxK))) : 20;

    const ks = Array.from({ length: maxK + 1 }, (_, i) => i);
    const pmf = ks.map((k) => (1 - pi) * poissonPmf(k, lambda));
    pmf[0] = (pmf[0] as number) + pi;
    const cdf: number[] = [];
    let running = 0;
    for (const value of pmf) {
        running += value;
        cdf.push(running);
    }
    const theoryMean = (1 - pi) * lambda;
    const theoryVariance = (1 - pi) * lambda * (1 + pi * lambda);

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(maxK + 1).fill(0), -1),
        edges: [],
        description: `Building a zero-inflated Poisson mass function with pi ${pi} and lambda ${lambda}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { pi, lambda, maxK, ks, pmf: [], cdf: [], theoryMean, theoryVariance, complete: false },
    };
    let step = 1;
    const shown = new Array<number>(maxK + 1).fill(0);
    for (let k = 0; k <= maxK; k += 1) {
        shown[k] = pmf[k] as number;
        yield {
            stepNumber: step,
            entities: makeBars([...shown], k),
            edges: [],
            description: `At k = ${k}: probability ${(pmf[k] as number).toFixed(6)}, cumulative ${(cdf[k] as number).toFixed(6)}.`,
            codeLineNumber: k === 0 ? 2 : 3,
            layout: "array",
            meta: { pi, lambda, maxK, ks, pmf: [...shown], cdf: [...cdf.slice(0, k + 1)], theoryMean, theoryVariance, complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(pmf, maxK + 1),
        edges: [],
        description: `Mass function complete: mean ${theoryMean.toFixed(4)}, variance ${theoryVariance.toFixed(4)}, mass at zero ${(pmf[0] as number).toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { pi, lambda, maxK, ks, pmf, cdf, theoryMean, theoryVariance, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Count data often contain far more zeros than a plain Poisson model can explain. A zero-inflated Poisson says each observation comes from one of two processes: a structural process that always produces zero, or a Poisson count process. Mixing them lifts the probability at zero while keeping the familiar Poisson shape for positive counts.",
        invariants: [
            "Every probability is nonnegative and the displayed mass sums to at most one.",
            "The mass at zero is pi plus (1 minus pi) times exp of minus lambda.",
            "For k greater than zero the mass is (1 minus pi) times the Poisson mass.",
        ],
        correctness:
            "The two generating processes are disjoint and cover all outcomes, so the total probability is pi plus (1 minus pi) times the full Poisson mass, which is one. The mean of a mixture is the weighted sum of component means, giving (1 minus pi) times lambda. The variance follows from the law of total variance and equals (1 minus pi) lambda times (1 plus pi lambda).",
        complexityRationale:
            "Each count k is computed with one multiplication of the previous Poisson term by lambda over k, so building the whole mass function takes O(maxK) time and O(maxK) space for the bars and cumulative array.",
        uses: [
            "Modeling counts of insurance claims with many policyholders who never claim",
            "Analyzing species counts with excess absences in ecology",
            "Quality control when a production line has intermittent zero-defect days",
        ],
        references: [
            "Lambert, Zero-Inflated Poisson Regression, Technometrics 34, 1992",
            "Cameron and Trivedi, Regression Analysis of Count Data, Chapter 4",
        ],
        workedExample:
            "With pi = 0.3 and lambda = 2.5, the mass at zero is 0.3 plus 0.7 times exp(-2.5), about 0.357. The mass at one is 0.7 times 2.5 exp(-2.5), about 0.160. The mean is 0.7 times 2.5, or 1.75, and the variance is 1.75 times 1.75, about 3.06.",
    },
    id: "zero-inflated-poisson",
    name: "Zero-Inflated Poisson Distribution",
    category: "statistics-probability",
    complexity: { time: "O(maxK)", space: "O(maxK)" },
    defaultInput: { pi: 0.3, lambda: 2.5, maxK: 20 },
    visualType: "array",
    run,
    pseudocode: [
        "read inflation probability pi, rate lambda, and largest count maxK",
        "compute the Poisson mass exp(-lambda) lambda^k / k! for each k",
        "set mass at zero to pi plus (1 - pi) times the Poisson mass at zero",
        "for k from 1 to maxK set mass to (1 - pi) times the Poisson mass",
        "accumulate the cumulative distribution from the masses",
        "set the mean to (1 - pi) lambda",
        "set the variance to (1 - pi) lambda (1 + pi lambda)",
        "done: report the mass function, cumulative curve, mean, and variance",
    ],
};

export default module;
