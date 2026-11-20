/**
 * geweke-diagnostic.ts - Geweke Convergence Diagnostic
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Geweke diagnostic checks whether a Markov chain has settled by comparing
 * the mean of an early segment with the mean of a late segment. It scales the
 * mean difference by the standard error of the two segment means, producing a
 * z score. When the absolute score is below a threshold such as two, the two
 * parts of the chain look drawn from the same distribution and the run is
 * treated as converged.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) to summarize both segments
 *   Space: O(n) for the emitted bar entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per chain draw shows the sampled value.
 *   - The early segment is highlighted first, then the late segment.
 *   - The final frame reports the z score and the convergence verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(chain: number[], start: number, end: number, done: boolean): VisualEntity[] {
    return chain.map((value, index) => {
        let state: EntityState = "idle";
        if (done) state = "sorted";
        else if (index >= start && index < end) state = "active";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(4),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, draw: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { chain?: number[]; firstFraction?: number; lastFraction?: number; threshold?: number } | null) ?? {};
    const chain: number[] = Array.isArray(task.chain) ? task.chain.filter((value) => Number.isFinite(value)) : Array.from({ length: 200 }, (_, i) => Math.sin(i / 7) + 0.2 * Math.cos(i / 3));
    const firstFraction = typeof task.firstFraction === "number" && task.firstFraction > 0 && task.firstFraction <= 0.5 ? task.firstFraction : 0.1;
    const lastFraction = typeof task.lastFraction === "number" && task.lastFraction > 0 && task.lastFraction <= 0.5 ? task.lastFraction : 0.5;
    const threshold = typeof task.threshold === "number" && task.threshold > 0 ? task.threshold : 2;
    const n = chain.length;
    const nA = Math.max(2, Math.min(n - 2, Math.floor(n * firstFraction)));
    const nB = Math.max(2, Math.min(n - nA, Math.floor(n * lastFraction)));

    const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = (values: number[], mu: number): number => {
        if (values.length < 2) return 0;
        return values.reduce((sum, value) => sum + (value - mu) * (value - mu), 0) / (values.length - 1);
    };
    const first = chain.slice(0, nA);
    const last = chain.slice(n - nB);
    const meanA = mean(first);
    const meanB = mean(last);
    const varA = variance(first, meanA);
    const varB = variance(last, meanB);
    const standardError = Math.sqrt(varA / nA + varB / nB);
    const zScore = standardError > 0 ? (meanA - meanB) / standardError : 0;
    const converged = Math.abs(zScore) < threshold;

    yield {
        stepNumber: 0,
        entities: makeBars(chain, 0, 0, false),
        edges: [],
        description: `Checking convergence of a chain with ${n} draw(s) using the Geweke diagnostic.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, nA, nB, meanA, meanB, varA, varB, zScore, converged, threshold, complete: false },
    };
    yield {
        stepNumber: 1,
        entities: makeBars(chain, 0, nA, false),
        edges: [],
        description: `Early segment: ${nA} draw(s) with mean ${meanA.toFixed(4)} and variance ${varA.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { n, nA, nB, meanA, meanB, varA, varB, zScore, converged, threshold, complete: false },
    };
    yield {
        stepNumber: 2,
        entities: makeBars(chain, n - nB, n, false),
        edges: [],
        description: `Late segment: ${nB} draw(s) with mean ${meanB.toFixed(4)} and variance ${varB.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, nA, nB, meanA, meanB, varA, varB, zScore, converged, threshold, complete: false },
    };
    yield {
        stepNumber: 3,
        entities: makeBars(chain, 0, 0, true),
        edges: [],
        description: `Geweke z score ${zScore.toFixed(4)} versus threshold ${threshold}; ${converged ? "converged" : "not converged"}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, nA, nB, meanA, meanB, varA, varB, zScore, converged, threshold, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A converged chain should look the same at the beginning and at the end. The Geweke test takes a short early slice and a longer late slice, compares their averages, and measures the gap in standard error units. A gap of only a couple of standard errors is normal sampling noise; a large gap means the chain was still moving when the samples were collected.",
        invariants: [
            "The z score is the mean difference divided by the combined standard error.",
            "A constant chain has zero variance in both segments and a zero score.",
            "Reversing the chain swaps the segments and flips the sign of the score.",
        ],
        correctness:
            "The two segment means are approximately normal with variances varA/nA and varB/nB once the chain is in its stationary regime, so their difference has standard error equal to the square root of the sum of those variances. The ratio of the observed difference to that standard error is a standard normal z statistic under the null of equal means, and comparing its magnitude with a threshold such as two is the Geweke convergence test. Degenerate zero-variance segments give a score of zero rather than a division by zero.",
        complexityRationale:
            "The two segment means and variances are found by single passes over the slices, so the diagnostic takes O(n) time. The bar entities mirror the chain and use O(n) space.",
        uses: [
            "Checking burn-in of Markov chain Monte Carlo output",
            "Diagnosing convergence before reporting posterior summaries",
            "Comparing early and late windows of a long simulation run",
        ],
        references: [
            "Geweke, Evaluating the Accuracy of Sampling-Based Approaches to the Calculation of Posterior Moments, 1992",
            "Gelman et al., Bayesian Data Analysis, Third Edition, Chapter 11",
        ],
        workedExample:
            "Take a chain of values that drifts from 0 early to 10 late with small noise. The early mean is near 0 and the late mean near 10, so the z score is large and negative and the run is flagged. A stationary chain with both means near 0 gives a z score near zero and passes.",
    },
    id: "geweke-diagnostic",
    name: "Geweke Diagnostic",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {},
    visualType: "array",
    run,
    pseudocode: [
        "read the chain and the early and late fraction sizes",
        "select an early prefix and a late suffix of the chain",
        "compute each segment mean and sample variance",
        "combine the variances over segment sizes into a standard error",
        "set the z score to the mean difference over that error",
        "declare convergence when the absolute score is below the threshold",
        "done: report the segments, z score, and verdict",
    ],
};

export default module;
