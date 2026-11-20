/**
 * gelman-rubin-diagnostic.ts - Gelman-Rubin R-hat Convergence Diagnostic
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * R-hat compares the variance within each Markov chain to the variance between
 * chain means. When several chains have all explored the same stationary
 * distribution, the between-chain spread is comparable to the within-chain
 * spread and R-hat approaches one. Values noticeably above one signal that the
 * chains have not mixed yet.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * n) for m chains of length n
 *   Space: O(m) for per-chain summaries
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per chain shows that chain's sample mean.
 *   - Bars turn BLUE while summarized, then GREEN on the verdict frame.
 *   - The final frame reports W, B, variance-plus and R-hat in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function chainStats(values: number[]): { mean: number; variance: number } {
    const n = values.length;
    if (n === 0) {
        return { mean: 0, variance: 0 };
    }
    let sum = 0;
    for (const value of values) {
        sum += value;
    }
    const mean = sum / n;
    if (n < 2) {
        return { mean, variance: 0 };
    }
    let sq = 0;
    for (const value of values) {
        sq += (value - mean) * (value - mean);
    }
    return { mean, variance: sq / (n - 1) };
}

function makeBars(
    stats: Array<{ mean: number; variance: number }>,
    states: Map<number, EntityState>,
): VisualEntity[] {
    return stats.map((stat, index) => ({
        id: `bar-chain-${index}`,
        type: "bar" as const,
        label: `C${index + 1}`,
        value: stat.mean,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { chain: index, mean: stat.mean, variance: stat.variance },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { chains?: number[][] } | null) ?? {};
    const chains: number[][] = task.chains ?? [
        [1.0, 1.1, 0.9, 1.0, 1.2, 0.8, 1.0, 1.1, 0.95, 1.05],
        [1.1, 0.9, 1.0, 1.2, 0.8, 1.0, 0.95, 1.05, 1.0, 1.1],
        [0.9, 1.0, 1.1, 0.8, 1.2, 1.0, 1.05, 0.95, 1.1, 1.0],
    ];
    const stats = chains.map((chain) => chainStats(chain));
    const m = stats.length;
    const n = chains[0]?.length ?? 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(stats, new Map()),
        edges: [],
        description: `Summarizing ${m} chain(s) of length ${n} to compute the Gelman-Rubin diagnostic.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { chains: m, length: n, rHat: 0, converged: false },
    };
    step += 1;

    const states = new Map<number, EntityState>();
    for (let index = 0; index < stats.length; index += 1) {
        const stat = stats[index];
        if (!stat) {
            continue;
        }
        states.set(index, "active");
        yield {
            stepNumber: step,
            entities: makeBars(stats, states),
            edges: [],
            description: `Chain ${index + 1}: mean ${stat.mean.toFixed(4)}, within-chain variance ${stat.variance.toFixed(6)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { chain: index, mean: stat.mean, variance: stat.variance },
        };
        step += 1;
        states.set(index, "sorted");
    }

    const overallMean = m > 0 ? stats.reduce((sum, s) => sum + s.mean, 0) / m : 0;
    const W = m > 0 ? stats.reduce((sum, s) => sum + s.variance, 0) / m : 0;
    const B = m > 1 && n > 0
        ? (n / (m - 1)) * stats.reduce((sum, s) => sum + (s.mean - overallMean) ** 2, 0)
        : 0;
    const varPlus = n > 0 ? ((n - 1) / n) * W + B / n : 0;
    let rHat: number;
    if (W > 0) {
        rHat = Math.sqrt(varPlus / W);
    } else {
        rHat = B > 0 ? Number.POSITIVE_INFINITY : 1;
    }
    const converged = Number.isFinite(rHat) && rHat < 1.1;

    yield {
        stepNumber: step,
        entities: makeBars(stats, states),
        edges: [],
        description: `R-hat = ${Number.isFinite(rHat) ? rHat.toFixed(5) : "infinite"} (W=${W.toFixed(6)}, B=${B.toFixed(6)}); ${converged ? "chains appear mixed" : "chains need more samples"}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { chains: m, length: n, overallMean, W, B, varPlus, rHat, converged },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Run several chains from different starting points. If they are all sampling the same distribution, the spread of their averages should be no larger than the natural wobble inside each chain. R-hat is the ratio that compares those two spreads, scaled so a well-mixed set of chains gives a value near one.",
        invariants: [
            "Within-chain variance W is the average of the individual sample variances.",
            "Between-chain variance B scales the spread of chain means by n/(m-1).",
            "The variance estimate var-plus is nonnegative and R-hat is at least one whenever W is positive.",
        ],
        correctness:
            "Under a common stationary distribution the expected value of B equals the marginal variance, while W estimates the same variance from within chains. As chain length grows, B/n vanishes and the (n-1)/n factor corrects the small-sample bias in W, so var-plus tends to the marginal variance and R-hat tends to one. Persistently large between-chain spread means the chains have not reached the same distribution.",
        complexityRationale:
            "Each chain is scanned once for its mean and once for its variance, so the work is linear in total samples m*n. Only one summary per chain is retained, giving O(m) space.",
        uses: [
            "Checking convergence of Bayesian posterior samplers",
            "Diagnosing MCMC runs before reporting posterior summaries",
            "Automated stopping rules in probabilistic programming tools",
        ],
        references: [
            "Gelman and Rubin, Inference from Iterative Simulation Using Multiple Sequences, Statistical Science, 1992",
            "Vehtari et al., Rank-normalization, folding, and localization, Bayesian Analysis, 2021",
        ],
        workedExample:
            "For three ten-sample chains all centered near one with within variance about 0.015 and nearly equal means, W is about 0.015, B is near zero, var-plus is slightly below W, and R-hat rounds to about 0.99, indicating good mixing.",
    },
    id: "gelman-rubin-diagnostic",
    name: "Gelman-Rubin Diagnostic",
    category: "statistics-probability",
    complexity: { time: "O(m * n)", space: "O(m)" },
    defaultInput: {
        chains: [
            [1.0, 1.1, 0.9, 1.0, 1.2, 0.8, 1.0, 1.1, 0.95, 1.05],
            [1.1, 0.9, 1.0, 1.2, 0.8, 1.0, 0.95, 1.05, 1.0, 1.1],
            [0.9, 1.0, 1.1, 0.8, 1.2, 1.0, 1.05, 0.95, 1.1, 1.0],
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "for each chain compute its sample mean and variance",
        "set W to the average within-chain variance",
        "set B from the spread of the chain means",
        "set var-plus to (n-1)/n times W plus B/n",
        "report R-hat as the square root of var-plus over W",
    ],
};

export default module;
