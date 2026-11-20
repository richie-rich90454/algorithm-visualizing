/**
 * compound-poisson-distribution.ts - Compound Poisson Distribution (Panjer Recursion)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A compound Poisson random variable sums a Poisson-distributed number of
 * independent integer-valued claims. The aggregate loss distribution can be
 * computed exactly by the Panjer recursion: starting at the probability of no
 * claims, each successive probability is a weighted sum of earlier ones. This
 * module builds that distribution and reports its exact mean and variance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(maxS * claimSupport) for the recursion
 *   Space: O(maxS) for the aggregate mass function
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per aggregate loss s shows P(S = s).
 *   - The current value is highlighted while the recursion advances.
 *   - The final frame reports the aggregate mean and variance.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(6),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lambda?: number; claims?: number[]; maxS?: number } | null) ?? {};
    const lambda = typeof task.lambda === "number" && task.lambda > 0 ? task.lambda : 3;
    const rawClaims = task.claims ?? [0.5, 0.3, 0.2];
    const claimSum = rawClaims.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const claims = rawClaims.map((c) => Math.max(0, c) / claimSum);
    const support = claims.length;
    const maxS = typeof task.maxS === "number" ? Math.max(5, Math.min(300, Math.floor(task.maxS))) : 24;

    let claimMean = 0;
    let claimSecond = 0;
    for (let j = 0; j < support; j += 1) {
        claimMean += (j + 1) * (claims[j] as number);
        claimSecond += (j + 1) * (j + 1) * (claims[j] as number);
    }
    const mean = lambda * claimMean;
    const variance = lambda * claimSecond;

    const pmf = new Array<number>(maxS + 1).fill(0);
    pmf[0] = Math.exp(-lambda);

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(maxS + 1).fill(0), -1, false),
        edges: [],
        description: `Starting the Panjer recursion for a compound Poisson model with rate ${lambda}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lambda, claims, support, maxS, pmf: [], mean, variance, complete: false },
    };
    let step = 1;
    for (let s = 1; s <= maxS; s += 1) {
        let sum = 0;
        for (let j = 1; j <= Math.min(s, support); j += 1) {
            sum += j * (claims[j - 1] as number) * (pmf[s - j] as number);
        }
        pmf[s] = (lambda / s) * sum;
        yield {
            stepNumber: step,
            entities: makeBars([...pmf], s, false),
            edges: [],
            description: `Aggregate loss ${s}: probability ${(pmf[s] as number).toFixed(6)} from the Panjer recursion.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { lambda, claims, support, maxS, pmf: [...pmf], mean, variance, complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(pmf, maxS + 1, true),
        edges: [],
        description: `Recursion complete: aggregate mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}, total mass ${pmf.reduce((a, b) => a + b, 0).toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { lambda, claims, support, maxS, pmf, mean, variance, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An insurer's total loss is the sum of a random number of individual claims. When the count is Poisson and each claim is a positive integer, the distribution of the total can be built one value at a time instead of enumerating every possible collection of claims. The Panjer recursion expresses each probability in terms of earlier ones, giving an exact and efficient calculation.",
        invariants: [
            "The probability of zero aggregate loss is exp(-lambda).",
            "Each aggregate probability is nonnegative.",
            "The aggregate mean is lambda times the mean claim size.",
        ],
        correctness:
            "Conditioning on the total number of claims and differentiating the probability generating function of the compound sum yields the Panjer recurrence f(s) = (lambda/s) times the sum over j of j g(j) f(s-j), with f(0) = exp(-lambda). For a Poisson count this recurrence is exact for every s. Wald's identities give mean lambda times E[X] and variance lambda times E[X squared].",
        complexityRationale:
            "Each aggregate value s sums at most the claim support size, so the recursion is O(maxS * support) time and O(maxS) space for the probability array and bars.",
        uses: [
            "Computing aggregate loss distributions in actuarial science",
            "Evaluating stop-loss reinsurance premiums",
            "Modeling total demand or burst sizes in network traffic",
        ],
        references: [
            "Panjer, Recursive Evaluation of a Family of Compound Distributions, Astin Bulletin 12, 1981",
            "Klugman, Panjer, and Willmot, Loss Models, Chapter 4",
        ],
        workedExample:
            "With lambda = 2 and claim sizes 1 and 2 equally likely, f(0) = exp(-2). Then f(1) = (2/1)(1*0.5*f(0)) = exp(-2), and f(2) = (2/2)(1*0.5*f(1) + 2*0.5*f(0)) = 1.5 exp(-2). The mean is 2 times 1.5, or 3, and the variance is 2 times 2.5, or 5.",
    },
    id: "compound-poisson-distribution",
    name: "Compound Poisson Distribution (Panjer Recursion)",
    category: "statistics-probability",
    complexity: { time: "O(maxS * support)", space: "O(maxS)" },
    defaultInput: { lambda: 3, claims: [0.5, 0.3, 0.2], maxS: 24 },
    visualType: "array",
    run,
    pseudocode: [
        "read Poisson rate lambda, claim probabilities, and largest total maxS",
        "normalize the claim probabilities and compute claim moments",
        "set aggregate probability at zero to exp(-lambda)",
        "for each total s from 1 to maxS initialize the weighted sum to zero",
        "add j times claim probability g(j) times f(s-j) for each claim size j",
        "set f(s) to (lambda/s) times the weighted sum",
        "set the mean to lambda times the claim mean and variance to lambda times the claim second moment",
        "done: report the aggregate mass function, mean, and variance",
    ],
};

export default module;
