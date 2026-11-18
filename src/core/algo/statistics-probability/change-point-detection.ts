/**
 * change-point-detection.ts - Single Change Point by Segment Splitting
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A single change point divides a time series into two stretches with
 * different levels. This module scores every admissible split by the between
 * segment sum of squares: how much of the total variation is explained by
 * giving each side its own mean. The split with the largest explained
 * variation, equivalently the smallest residual sum of squares, is reported.
 * Prefix sums of values and squared values make each candidate constant time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) with prefix sums over n observations
 *   Space: O(n) for the prefix arrays, scores, and displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per observation shows its value.
 *   - The left segment of the current split is green, the right is idle.
 *   - The final frame colors both segments and reports the detected index.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ChangePointInput {
    series?: number[];
    minLen?: number;
}

/** Build one bar per observation with the current split boundary marked. */
function makeBars(series: number[], split: number, done: boolean): VisualEntity[] {
    return series.map((value, index) => {
        let state: EntityState = "idle";
        if (index < split) {
            state = "sorted";
        } else if (done) {
            state = "visited";
        } else if (index === split) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `t=${index}: ${value.toFixed(2)}${index === split ? " boundary" : ""}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value, leftOfSplit: index < split },
        };
    });
}

/** Sum of squared deviations for a segment described by prefix sums. */
function segmentSse(n: number, sum: number, sumSquares: number): number {
    if (n <= 0) {
        return 0;
    }
    return Math.max(0, sumSquares - (sum * sum) / n);
}

/** The single change point generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ChangePointInput | null) ?? {};
    const series: number[] = Array.isArray(task.series) && task.series.length > 0
        ? task.series.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : [1, 2, 2, 1, 9, 10, 9, 10, 8];
    const n = series.length;
    const minLen = Math.max(1, Math.floor(task.minLen ?? 2));

    yield {
        stepNumber: 0,
        entities: makeBars(series, -1, false),
        edges: [],
        description: `Scanning ${n} observations for a level shift with at least ${minLen} points per side.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, minLen, series: [...series], splits: [] as number[], scores: [] as number[], split: -1, bestScore: 0 },
    };
    let step = 1;

    if (n < 2 * minLen) {
        yield {
            stepNumber: step,
            entities: makeBars(series, -1, true),
            edges: [],
            description: `Only ${n} observations cannot form two segments of length ${minLen}; no change point exists.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { n, minLen, series: [...series], splits: [], scores: [], split: -1, bestScore: 0 },
        };
        return;
    }

    const prefixSum: number[] = [0];
    const prefixSquares: number[] = [0];
    for (const value of series) {
        prefixSum.push((prefixSum[prefixSum.length - 1] ?? 0) + value);
        prefixSquares.push((prefixSquares[prefixSquares.length - 1] ?? 0) + value * value);
    }

    const splits: number[] = [];
    const scores: number[] = [];
    let bestSplit = minLen;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let k = minLen; k <= n - minLen; k += 1) {
        const leftN = k;
        const rightN = n - k;
        const leftSum = prefixSum[k] ?? 0;
        const rightSum = (prefixSum[n] ?? 0) - leftSum;
        const leftSquares = prefixSquares[k] ?? 0;
        const rightSquares = (prefixSquares[n] ?? 0) - leftSquares;
        const sse = segmentSse(leftN, leftSum, leftSquares) + segmentSse(rightN, rightSum, rightSquares);
        const totalSse = segmentSse(n, prefixSum[n] ?? 0, prefixSquares[n] ?? 0);
        const score = totalSse - sse;
        splits.push(k);
        scores.push(score);
        if (score > bestScore + 1e-12) {
            bestScore = score;
            bestSplit = k;
        }
        yield {
            stepNumber: step,
            entities: makeBars(series, k, false),
            edges: [],
            description: `Split at ${k}: left mean ${(leftSum / leftN).toFixed(3)}, right mean ${(rightSum / rightN).toFixed(3)}, explained variation ${score.toFixed(3)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, minLen, series: [...series], splits: [...splits], scores: [...scores], split: k, bestScore, candidateSse: sse },
        };
        step += 1;
    }

    const leftMean = (prefixSum[bestSplit] ?? 0) / bestSplit;
    const rightMean = ((prefixSum[n] ?? 0) - (prefixSum[bestSplit] ?? 0)) / (n - bestSplit);
    yield {
        stepNumber: step,
        entities: makeBars(series, bestSplit, true),
        edges: [],
        description: `Change point at index ${bestSplit}: left mean ${leftMean.toFixed(3)}, right mean ${rightMean.toFixed(3)}, explained variation ${bestScore.toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, minLen, series: [...series], splits, scores, split: bestSplit, bestScore, leftMean, rightMean },
    };
}

/** The change point detection module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If a series changes level partway through, splitting it at the right place makes the two pieces each nearly constant. Giving each side its own mean removes variation, and the best split is the one that removes the most. Prefix sums let the score of any split be computed without rescanning the data.",
        invariants: [
            "Both segments contain at least minLen observations.",
            "Explained variation equals total variation minus the residual sum of squares of the two segments.",
            "The reported split has the largest explained variation among all candidates.",
        ],
        correctness:
            "For a segment the sum of squared deviations from its mean equals the sum of squares minus the squared sum divided by the count, which follows by expanding the square. The total sum of squares splits into a between segment part and a within segment part, so maximizing explained variation is exactly minimizing the residual sum of squares. Evaluating every admissible split therefore finds the global best two segment fit, and prefix sums compute each score correctly in constant time.",
        complexityRationale:
            "Building the two prefix arrays takes O(n), and each of the O(n) candidate splits uses a constant number of prefix lookups, so the total time is O(n). Storing the prefix arrays, scores, and bars uses O(n) space.",
        uses: [
            "Detecting a level shift in sensor readings",
            "Finding a regime change in a financial time series",
            "Segmenting a signal before fitting separate models",
        ],
        references: [
            "Page, Continuous Inspection Schemes, Biometrika, 1954",
            "Basseville and Nikiforov, Detection of Abrupt Changes, 1993",
        ],
        workedExample:
            "For the series 1, 2, 2, 1, 9, 10, 9, 10, 8 with minLen two, a split at four gives left mean 1.5 and right mean 9.2. The residual scatter on each side is tiny, so this split explains almost all the variation and beats splits that cut through the jump.",
    },
    id: "change-point-detection",
    name: "Change Point Detection",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { series: [1, 2, 2, 1, 9, 10, 9, 10, 8], minLen: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "read the series and the minimum segment length",
        "build prefix sums of values and of squared values",
        "for every split with enough points on each side",
        "compute each segment mean from its prefix sum",
        "score the split by between-segment explained variation",
        "track the split with the largest score",
        "done: report the change point and both segment means",
    ],
};

export default module;
