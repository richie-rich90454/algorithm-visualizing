/**
 * markov-inequality.ts - Markov Inequality Tail Bound
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Markov's inequality bounds the upper tail of any nonnegative random
 * variable using only its mean: P(X >= a) <= E[X] / a. This module computes
 * the empirical mean from observed samples, derives the bound at several
 * thresholds, and checks that the observed tail never exceeds it.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + t*n) for n samples and t thresholds
 *   Space: O(t) for the reported bounds and tails
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per threshold.
 *   - Columns show the threshold, Markov bound, observed tail, and a flag.
 *   - A flag of one means the inequality held at that threshold.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    samples?: number[];
    thresholds?: number[];
}

function makeCells(
    thresholds: number[],
    bounds: number[],
    tails: number[],
    holds: number[],
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < thresholds.length; row += 1) {
        const columns = [thresholds[row] ?? 0, bounds[row] ?? 0, tails[row] ?? 0, holds[row] ?? 0];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (done) state = holds[row] === 1 ? "sorted" : "error";
            else if (row === current) state = "comparing";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: (columns[col] ?? 0).toFixed(3),
                value: columns[col] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const rawSamples = Array.isArray(task.samples) ? task.samples.map(Number).filter(Number.isFinite) : [];
    const samples = (rawSamples.length > 0 ? rawSamples : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).map((v) => Math.max(0, v));
    const thresholds = Array.isArray(task.thresholds) && task.thresholds.length > 0
        ? task.thresholds.map(Number).filter((v) => v > 0)
        : [2, 4, 6, 8, 10, 12];

    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const tails = thresholds.map((a) => samples.filter((value) => value >= a).length / samples.length);
    const bounds = thresholds.map((a) => mean / a);
    const holds = tails.map((tail, i) => (tail <= Math.min(1, bounds[i] ?? 0) + 1e-12 ? 1 : 0));
    const valid = holds.every((flag) => flag === 1);

    const metaAll = {
        family: "markov",
        rows: thresholds.length,
        cols: 4,
        n: samples.length,
        mean: Number(mean.toFixed(6)),
        thresholds: thresholds.map((v) => Number(v.toFixed(6))),
        bounds: bounds.map((v) => Number(v.toFixed(6))),
        tails: tails.map((v) => Number(v.toFixed(6))),
        holds,
        valid,
    };

    yield {
        stepNumber: 0,
        entities: makeCells(thresholds, bounds, tails, holds, -1, false),
        edges: [],
        description: `Markov bound from ${samples.length} nonnegative samples with empirical mean ${mean.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: metaAll,
    };

    let step = 1;
    for (let i = 0; i < thresholds.length; i += 1) {
        const a = thresholds[i] ?? 0;
        const bound = bounds[i] ?? 0;
        const tail = tails[i] ?? 0;
        yield {
            stepNumber: step,
            entities: makeCells(thresholds, bounds, tails, holds, i, false),
            edges: [],
            description: `a=${a.toFixed(2)}: observed tail ${(tail * 100).toFixed(1)}% versus Markov bound ${(Math.min(1, bound) * 100).toFixed(1)}%.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { ...metaAll, current: i, currentThreshold: a, currentBound: bound, currentTail: tail },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(thresholds, bounds, tails, holds, -1, true),
        edges: [],
        description: valid
            ? `All ${thresholds.length} observed tails respect the Markov bound.`
            : `The bound was violated at one or more thresholds; check the inputs.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaAll, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If you know only the average of a nonnegative quantity, you can still say something about extreme values. A value cannot exceed the mean too often, because each large value spends a large part of the total sum. Markov's inequality turns that idea into a simple recipe: the fraction at or above a threshold is at most the mean divided by that threshold.",
        invariants: [
            "All sample values are nonnegative, as Markov's inequality requires.",
            "The empirical tail counts samples greater than or equal to the threshold.",
            "The reported bound mean/a is never below the observed tail.",
        ],
        correctness:
            "For a nonnegative sample, mean = (1/n) * sum x_i >= (1/n) * sum_{x_i >= a} x_i >= (1/n) * (count of x_i >= a) * a = a * tail. Dividing by the positive threshold gives tail <= mean/a, so the inequality holds for every threshold. The module reports a one whenever the observed tail satisfies this, and a zero would expose a violation.",
        complexityRationale:
            "Computing the mean scans the n samples once. Each of the t thresholds scans all n samples to count the tail, giving O(t*n) time in total. Only the t bounds, tails, and flags are stored, so space is O(t).",
        uses: [
            "Bounding failure probabilities when only an average cost is known",
            "Deriving Chebyshev and Chernoff bounds as refinements",
            "Quick worst-case checks in randomized algorithm analysis",
        ],
        references: [
            "Grimmett and Stirzaker, Probability and Random Processes, Chapter 3",
            "Mitzenmacher and Upfal, Probability and Computing, Chapter 3",
        ],
        workedExample:
            "For samples 0 through 9 the mean is 4.5. At threshold 9 the bound is 4.5/9 = 0.5 while the observed tail is one sample out of ten, or 0.1. At threshold 2 the bound exceeds one and the observed tail is 0.8, so the inequality holds at both thresholds.",
    },
    id: "markov-inequality",
    name: "Markov Inequality",
    category: "statistics-probability",
    complexity: { time: "O(t * n)", space: "O(t)" },
    defaultInput: { samples: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], thresholds: [2, 4, 6, 8, 10, 12] },
    visualType: "grid",
    run,
    pseudocode: [
        "read nonnegative samples and the thresholds",
        "sum the samples and divide by the count to get the mean",
        "for each threshold count samples at least as large as it",
        "divide that count by the sample count to get the tail",
        "set the Markov bound to the mean divided by the threshold",
        "record whether the tail is at most the capped bound",
        "done: report all bounds, tails, and validity flags",
    ],
};

export default module;
