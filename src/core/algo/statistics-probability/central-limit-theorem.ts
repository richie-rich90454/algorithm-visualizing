/**
 * central-limit-theorem.ts - Central Limit Theorem
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The central limit theorem says the sum of many independent, identically
 * distributed variables is approximately normal, whatever the original
 * distribution. This module takes the sum of n fair dice and computes its
 * exact probability mass by repeated convolution. It then overlays the normal
 * density with the same mean and variance and reports a discretized total
 * variation distance, which shrinks as n grows.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * sides^2 * maxN) to convolve up to maxN dice
 *   Space: O(maxN * sides) for the stored distributions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per achievable sum shows its exact probability.
 *   - The current n is highlighted; the finished n is green.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Exact pmf of the sum of n dice with faces 1 through sides. */
function dicePmf(sides: number, n: number): number[] {
    let pmf = new Array<number>(n * sides + 1).fill(0);
    for (let face = 1; face <= sides; face += 1) {
        pmf[face] = 1 / sides;
    }
    for (let added = 2; added <= n; added += 1) {
        const next = new Array<number>(added * sides + 1).fill(0);
        for (let sum = 0; sum < pmf.length; sum += 1) {
            const weight = pmf[sum] ?? 0;
            if (weight === 0) {
                continue;
            }
            for (let face = 1; face <= sides; face += 1) {
                next[sum + face] = (next[sum + face] ?? 0) + weight / sides;
            }
        }
        pmf = next;
    }
    return pmf;
}

/** Normal density with the matching mean and variance, evaluated at integers. */
function normalCurve(mean: number, variance: number, length: number): number[] {
    const scale = 1 / Math.sqrt(2 * Math.PI * variance);
    return Array.from({ length }, (_, k) => scale * Math.exp(-((k - mean) ** 2) / (2 * variance)));
}

function distance(a: number[], b: number[]): number {
    let total = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
        total += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    }
    return total / 2;
}

function makeBars(pmf: number[], current: number, done: boolean): VisualEntity[] {
    return pmf.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${index}: ${value.toFixed(4)}`,
        value,
        state: done ? ("sorted" as const) : index === current ? ("comparing" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, k: index },
    }));
}

/** The central limit theorem generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { sides?: number; maxN?: number } | null) ?? {};
    const sides = typeof task.sides === "number" ? Math.min(10, Math.max(2, Math.floor(task.sides))) : 6;
    const maxN = typeof task.maxN === "number" ? Math.min(8, Math.max(1, Math.floor(task.maxN))) : 4;

    const exact: number[][] = [];
    const normals: number[][] = [];
    const means: number[] = [];
    const variances: number[] = [];
    const distances: number[] = [];

    let step = 0;
    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `Summing up to ${maxN} dice with ${sides} faces; each new sum distribution is the convolution of the previous one with one die.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { sides, maxN, n: 0, pmf: [], normal: [], mean: 0, variance: 0, distance: 0, distances: [] },
    };
    step += 1;

    for (let n = 1; n <= maxN; n += 1) {
        const pmf = dicePmf(sides, n);
        const mean = (n * (sides + 1)) / 2;
        const variance = (n * (sides * sides - 1)) / 12;
        const normal = normalCurve(mean, variance, pmf.length);
        const tv = distance(pmf, normal);
        exact.push(pmf);
        normals.push(normal);
        means.push(mean);
        variances.push(variance);
        distances.push(tv);
        yield {
            stepNumber: step,
            entities: makeBars(pmf, pmf.length - 1, false),
            edges: [],
            description: `With ${n} dice: ${pmf.length} possible sums, mean ${mean.toFixed(2)}, variance ${variance.toFixed(2)}; discretized distance to the normal curve is ${tv.toFixed(4)}.`,
            codeLineNumber: n === 1 ? 1 : 3,
            layout: "array",
            meta: { sides, maxN, n, pmf: [...pmf], normal: [...normal], mean, variance, distance: tv, distances: [...distances] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(exact[exact.length - 1] ?? [], 0, true),
        edges: [],
        description: `After ${maxN} dice the exact sum distribution has mean ${means[maxN - 1]?.toFixed(2)} and is close to the normal curve (distance ${distances[maxN - 1]?.toFixed(4)}).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { sides, maxN, n: maxN, pmf: [...(exact[maxN - 1] ?? [])], normal: [...(normals[maxN - 1] ?? [])], mean: means[maxN - 1] ?? 0, variance: variances[maxN - 1] ?? 0, distance: distances[maxN - 1] ?? 0, distances: [...distances] },
    };
}

/** The central limit theorem module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Add a handful of random quantities and the total starts to look bell-shaped even when each individual quantity is not. Rolling several dice is the classic example: one die is flat, two make a triangle, and by four or five rolls the histogram is already a smooth mound. Convolving the exact distributions shows the convergence directly.",
        invariants: [
            "Each sum distribution is the convolution of the previous one with a single die.",
            "Every exact probability lies in zero to one and the row sums to one.",
            "The mean grows linearly with n and the variance grows linearly with n.",
        ],
        correctness:
            "Convolution is the exact distribution of a sum of independent variables: the probability that the new total equals s is the sum over faces of the old probability at s minus the face times one over sides. By induction this yields the true pmf of the sum of n dice. The central limit theorem guarantees that after standardizing by the mean and standard deviation, this pmf converges to the standard normal density, so the measured distance shrinks.",
        complexityRationale:
            "Convolving a row of length O(n * sides) with sides faces is O(n * sides^2); doing it for every n from one to maxN gives O(n * sides^2 * maxN). Storing each row costs O(maxN * sides) space.",
        uses: [
            "Approximating sums of many small independent effects with a normal model",
            "Justifying normal error models in measurement and polling",
            "A first demonstration of convergence in distribution for students",
        ],
        references: [
            "Casella and Berger, Statistical Inference, Chapter 5",
            "Billingsley, Probability and Measure, Section 27",
        ],
        workedExample:
            "With two six-sided dice there are 36 equally likely ordered outcomes and seven appears six ways, so its probability is 6/36. The exact triangle of probabilities from two through twelve has mean 7 and variance 35/12, and convolving once more with a third die already produces a noticeably bell-shaped row.",
    },
    id: "central-limit-theorem",
    name: "Central Limit Theorem (Dice Convolution)",
    category: "statistics-probability",
    complexity: { time: "O(n * sides^2 * maxN)", space: "O(maxN * sides)" },
    defaultInput: { sides: 6, maxN: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "read the number of faces and the largest dice count",
        "start with the pmf of one fair die",
        "for each additional die convolve with one die",
        "compute the mean and variance of the new sum",
        "evaluate the matching normal density on the support",
        "measure discretized total variation distance",
        "done: report exact pmf and normal approximation",
    ],
};

export default module;
