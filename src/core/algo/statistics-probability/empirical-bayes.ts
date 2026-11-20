/**
 * empirical-bayes.ts - Normal-Normal Empirical Bayes (DerSimonian-Laird)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Empirical Bayes estimates a prior from the data instead of fixing it by
 * hand. In the normal-normal model each group observes a mean y_j with known
 * sampling variance s_j squared, while the true effects come from a common
 * prior with mean mu and variance tau squared. The marginal spread of the y_j
 * beyond sampling noise yields a method-of-moments estimate of tau squared.
 * Each effect is then shrunk toward the estimated grand mean by a factor that
 * depends on how noisy that group is.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(j) for j groups
 *   Space: O(j) for the group arrays and bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per group shows its shrunk empirical-Bayes estimate.
 *   - Bars fill in as each group is shrunk.
 *   - The final frame reports the grand mean, prior variance, and estimates.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface EbGroup {
    y: number;
    variance: number;
}

interface EbInput {
    groups?: EbGroup[];
}

/** Build one bar per group showing its shrunk estimate. */
function makeBars(groups: EbGroup[], shrunk: number[], current: number, done: boolean): VisualEntity[] {
    return groups.map((group, index) => {
        let state: EntityState = "idle";
        if (done || index < current) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        const value = shrunk[index] ?? group.y;
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `group ${index}: ${group.y.toFixed(2)} to ${value.toFixed(2)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, raw: group.y, shrunk: value },
        };
    });
}

/** Estimate the prior and shrink each group toward the grand mean. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as EbInput | null) ?? {};
    const groups: EbGroup[] = (task.groups ?? []).filter(
        (g) => g && typeof g.y === "number" && typeof g.variance === "number" && g.variance > 0,
    );
    const j = groups.length;

    if (j === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "No groups were supplied; there is nothing to shrink.",
            codeLineNumber: 0,
            layout: "array",
            meta: { mu: 0, tau2: 0, shrunk: [], count: 0 },
        };
        return;
    }

    const w = groups.map((g) => 1 / g.variance);
    const sumW = w.reduce((a, b) => a + b, 0);
    const ybarW = groups.reduce((acc, g, i) => acc + w[i]! * g.y, 0) / sumW;
    const q = groups.reduce((acc, g) => acc + (g.y - ybarW) ** 2 / g.variance, 0);
    const sumW2 = w.reduce((acc, v) => acc + v * v, 0);
    const denominator = sumW - sumW2 / sumW;
    const tau2 = denominator > 0 ? Math.max(0, (q - (j - 1)) / denominator) : 0;

    const wTau = groups.map((g) => 1 / (g.variance + tau2));
    const sumWTau = wTau.reduce((a, b) => a + b, 0);
    const mu = groups.reduce((acc, g, i) => acc + wTau[i]! * g.y, 0) / sumWTau;
    const shrunk = groups.map((g, i) => {
        const b = tau2 / (tau2 + g.variance);
        return mu + b * (g.y - mu);
    });
    const bFactors = groups.map((g) => tau2 / (tau2 + g.variance));

    yield {
        stepNumber: 0,
        entities: makeBars(groups, shrunk, -1, false),
        edges: [],
        description: `Estimating a shared prior from ${j} groups by marginal moment matching.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { mu, tau2, shrunk, bFactors, q, count: j },
    };
    let step = 1;

    for (let i = 0; i < j; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(groups, shrunk, i, false),
            edges: [],
            description: `Group ${i}: observed ${groups[i]!.y.toFixed(3)}, shrink factor ${bFactors[i]!.toFixed(3)}, estimate ${shrunk[i]!.toFixed(3)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { mu, tau2, shrunk, bFactors, q, count: j, revealed: i + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(groups, shrunk, -1, true),
        edges: [],
        description: `Grand mean ${mu.toFixed(3)}, prior variance ${tau2.toFixed(3)}; all ${j} effects shrunk toward the mean.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { mu, tau2, shrunk, bFactors, q, count: j },
    };
}

/** The empirical Bayes module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "When many groups are measured with noise, their raw averages overstate the differences between groups. Empirical Bayes looks at how spread out those averages are, subtracts the spread explainable by measurement noise, and uses what is left as the variance of a shared prior. Noisy groups are then pulled strongly toward the overall mean, while precise groups keep their own value.",
        invariants: [
            "The estimated prior variance tau squared is never negative.",
            "Every shrink factor lies between zero and one.",
            "A group's shrunk estimate lies between the raw observation and the grand mean.",
        ],
        correctness:
            "Under the model y_j equals theta_j plus independent noise of variance s_j squared, with theta_j drawn from N(mu, tau squared), the marginal variance of y_j is s_j squared plus tau squared. The weighted sum of squared deviations from the inverse-variance mean has expectation (j minus one) plus tau squared times a known constant. Solving that moment equation gives the DerSimonian-Laird estimate of tau squared, truncated at zero. Conditioning on the estimated prior makes the posterior mean of each theta_j a shrinkage estimate with factor tau squared over tau squared plus s_j squared, which is the optimal linear predictor under squared error.",
        complexityRationale:
            "Computing the weighted mean, the moment statistic, and the shrink factors each scan the j groups once, so time is O(j). The group arrays and bars occupy O(j) space.",
        uses: [
            "Combining effect sizes in a meta-analysis",
            "Small-area estimation and disease-rate smoothing",
            "Shrinking noisy A/B test estimates toward an overall mean",
        ],
        references: [
            "DerSimonian and Laird, Meta-analysis in Clinical Trials, Controlled Clinical Trials, 1986",
            "Efron and Morris, Stein's Estimation Rule and Its Competitors, JASA, 1973",
        ],
        workedExample:
            "Three groups have means 10, 12 and 14 each with variance 4. Their inverse-variance grand mean is 12 and the weighted spread implies a positive tau squared, so each estimate moves partway toward 12. The group at 10 might shrink to 10.8 and the group at 14 to 13.2, reducing the apparent spread while preserving the ordering.",
    },
    id: "empirical-bayes",
    name: "Empirical Bayes Estimation",
    category: "statistics-probability",
    complexity: { time: "O(j)", space: "O(j)" },
    defaultInput: {
        groups: [
            { y: 10, variance: 4 },
            { y: 12, variance: 4 },
            { y: 14, variance: 4 },
            { y: 9, variance: 9 },
            { y: 16, variance: 9 },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read each group's observed mean and sampling variance",
        "compute the inverse-variance weighted grand mean",
        "measure the weighted spread of observations about that mean",
        "solve for the prior variance and clamp it at zero",
        "shrink each observation toward the reweighted grand mean",
        "report the prior, shrink factors, and adjusted effects",
        "done: every group has an empirical-Bayes estimate",
    ],
};

export default module;
