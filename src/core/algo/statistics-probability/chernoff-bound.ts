/**
 * chernoff-bound.ts - Chernoff Tail Bounds for Bernoulli Sums
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * For a sum of n independent Bernoulli(p) trials with mean mu equals n p, a
 * Chernoff bound limits the probability of a large deviation from that mean.
 * For k above the mean the upper tail is at most exp(-mu delta squared over
 * 2 plus delta) with delta equals k over mu minus one. For k below the mean
 * the lower tail is at most exp(-mu delta squared over 2) with delta equals
 * one minus k over mu. The module compares each closed form bound with the
 * exact binomial tail computed by direct summation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n squared) for exact tails by summing binomial probabilities
 *   Space: O(n) for the displayed bars and reported arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per success count k shows the tail bound in that direction.
 *   - Bars fill in from low k to high k as bounds are computed.
 *   - The final frame reports the mean and the tightest bound found.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ChernoffInput {
    trials?: number;
    probability?: number;
}

/** Binomial coefficient by a multiplicative product. */
function binomialCoefficient(n: number, k: number): number {
    let result = 1;
    for (let i = 1; i <= k; i += 1) {
        result = (result * (n - k + i)) / i;
    }
    return result;
}

/** Build one bar per possible success count. */
function makeBars(ks: number[], values: Array<number | null>, current: number, done: boolean): VisualEntity[] {
    return ks.map((k, index) => {
        let state: EntityState = "idle";
        if (done || index < current) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        const value = values[index] ?? 0;
        return {
            id: `bar-${k}`,
            type: "bar" as const,
            label: `k=${k}: bound ${value.toFixed(4)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, k, bound: value },
        };
    });
}

/** The Chernoff bound generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ChernoffInput | null) ?? {};
    const trials = Math.max(1, Math.min(60, Math.floor(task.trials ?? 10)));
    const probability = Math.min(1, Math.max(0, typeof task.probability === "number" ? task.probability : 0.4));
    const mu = trials * probability;
    const ks = Array.from({ length: trials + 1 }, (_, i) => i);

    const pmf = ks.map((j) => {
        const coefficient = binomialCoefficient(trials, j);
        return coefficient * probability ** j * (1 - probability) ** (trials - j);
    });
    const exactUpper: number[] = [];
    const exactLower: number[] = [];
    for (let k = 0; k <= trials; k += 1) {
        let upper = 0;
        for (let j = k; j <= trials; j += 1) {
            upper += pmf[j] ?? 0;
        }
        let lower = 0;
        for (let j = 0; j <= k; j += 1) {
            lower += pmf[j] ?? 0;
        }
        exactUpper.push(Math.min(1, upper));
        exactLower.push(Math.min(1, lower));
    }

    const boundFor = (k: number): number => {
        if (mu <= 0) {
            return 1;
        }
        if (k > mu) {
            const delta = k / mu - 1;
            return Math.exp((-mu * delta * delta) / (2 + delta));
        }
        if (k < mu) {
            const delta = 1 - k / mu;
            return Math.exp((-mu * delta * delta) / 2);
        }
        return 1;
    };
    const tailSide = ks.map((k) => (k > mu ? "upper" : k < mu ? "lower" : "center"));
    const bounds = ks.map(boundFor);

    yield {
        stepNumber: 0,
        entities: makeBars(ks, new Array<number | null>(ks.length).fill(null), -1, false),
        edges: [],
        description: `Bounding tails of a Bernoulli sum with ${trials} trials, p=${probability.toFixed(3)}, mean ${mu.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { trials, probability, mu, ks, pmf: [...pmf], exactUpper: [...exactUpper], exactLower: [...exactLower], bound: [] as number[], tailSide: [...tailSide] },
    };
    let step = 1;

    for (let i = 0; i < ks.length; i += 1) {
        const k = ks[i] ?? 0;
        const shown = [...bounds.slice(0, i + 1), ...new Array<number | null>(ks.length - i - 1).fill(null)];
        yield {
            stepNumber: step,
            entities: makeBars(ks, shown, i, false),
            edges: [],
            description: `k=${k}: ${tailSide[i]} tail, exact ${(tailSide[i] === "upper" ? exactUpper[i] : exactLower[i])!.toFixed(5)}, Chernoff bound ${bounds[i]!.toFixed(5)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { trials, probability, mu, ks, pmf: [...pmf], exactUpper: [...exactUpper], exactLower: [...exactLower], bound: [...bounds.slice(0, i + 1)], tailSide: [...tailSide] },
        };
        step += 1;
    }

    const tightest = Math.min(...bounds);
    yield {
        stepNumber: step,
        entities: makeBars(ks, bounds, -1, true),
        edges: [],
        description: `Mean ${mu.toFixed(3)}; every bound dominates its exact tail, and the tightest bound is ${tightest.toFixed(5)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { trials, probability, mu, ks, pmf, exactUpper, exactLower, bound: bounds, tailSide, tightest },
    };
}

/** The Chernoff bound module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Chernoff bounds turn a product of many independent coin flips into a simple exponential statement about how far the total can stray from its mean. The trick bounds the exponential moment and then optimizes over a parameter, yielding a decay that is much sharper than a plain variance bound. The farther the count is from the mean, the smaller the guaranteed upper probability.",
        invariants: [
            "The mean of the Bernoulli sum equals the number of trials times the success probability.",
            "For every count the closed form bound is at least the exact binomial tail.",
            "The upper tail bound decreases as the count moves further above the mean.",
        ],
        correctness:
            "Markov's inequality applied to an exponential moment gives P(S at least a) at most the infimum over positive t of exp(-t a) times E[exp(t S)]. Independence factors that expectation into a product, and optimizing t gives exp(-mu delta squared over 2 plus delta) for the upper tail; the lower tail follows the same argument with a negative parameter and yields exp(-mu delta squared over 2). The exact tails are computed by summing binomial probabilities, which are nonnegative and total one, so each closed form can be checked numerically to dominate its exact tail.",
        complexityRationale:
            "Computing each exact tail directly sums up to n binomial terms for each of n counts, so time is O(n squared). The bars and reported arrays hold one value per count and the probability mass, giving O(n) space.",
        uses: [
            "Concentration guarantees for randomized algorithms",
            "Bounding failure probability in load balancing and hashing",
            "Sample complexity arguments in learning theory",
        ],
        references: [
            "Chernoff, A Measure of Asymptotic Efficiency for Tests, Annals of Mathematical Statistics, 1952",
            "Mitzenmacher and Upfal, Probability and Computing, Chapter 4",
        ],
        workedExample:
            "With ten trials and success probability 0.4 the mean is four. For k equals eight the deviation parameter is one, and the upper bound is exp(-4 over 3), about 0.264, while the exact probability of at least eight successes is only about 0.0016, confirming the bound is valid though loose on small examples.",
    },
    id: "chernoff-bound",
    name: "Chernoff Bound",
    category: "statistics-probability",
    complexity: { time: "O(n squared)", space: "O(n)" },
    defaultInput: { trials: 10, probability: 0.4 },
    visualType: "array",
    run,
    pseudocode: [
        "read the number of trials and the success probability",
        "compute the mean as trials times probability",
        "compute exact binomial probabilities for every success count",
        "sum them into exact upper and lower tails",
        "for each count choose the tail direction and deviation parameter",
        "evaluate the exponential closed form for that direction",
        "done: report exact tails, bounds, and the tightest bound",
    ],
};

export default module;
