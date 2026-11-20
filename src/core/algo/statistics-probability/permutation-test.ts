/**
 * permutation-test.ts - Exact Two-Sample Permutation Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A permutation test asks how unusual an observed difference in group means
 * would be if the group labels were meaningless. It pools the two samples,
 * enumerates every way to split them back into groups of the original sizes,
 * and builds the exact distribution of the mean difference. The p-value is the
 * fraction of splits at least as extreme as the observed one.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(C(m, n1) * m) for m pooled values and group size n1
 *   Space: O(C(m, n1)) for the null distribution of differences
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per distinct mean difference shows how often it occurs.
 *   - The observed difference is red; the extreme tail is yellow.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TestInput {
    groupA?: number[];
    groupB?: number[];
}

function mean(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function binomial(n: number, k: number): number {
    let result = 1;
    for (let i = 0; i < k; i += 1) {
        result = (result * (n - i)) / (i + 1);
    }
    return Math.round(result);
}

function makeBars(diffs: number[], counts: number[], observed: number, current: number): VisualEntity[] {
    return diffs.map((diff, index) => {
        let state: EntityState = "idle";
        if (Math.abs(diff) >= Math.abs(observed) - 1e-12) {
            state = "comparing";
        }
        if (index === current) {
            state = "active";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${diff.toFixed(3)}: ${counts[index] ?? 0}`,
            value: counts[index] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, k: index, diff },
        };
    });
}

/** The exact permutation test generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TestInput | null) ?? {};
    const groupA = Array.isArray(task.groupA) && task.groupA.length > 0 ? [...task.groupA] : [1, 2, 3, 4];
    const groupB = Array.isArray(task.groupB) && task.groupB.length > 0 ? [...task.groupB] : [5, 6, 7, 8];
    const n1 = groupA.length;
    const n2 = groupB.length;
    const pooled = [...groupA, ...groupB];
    const m = pooled.length;
    const total = binomial(m, n1);
    const observed = mean(groupA) - mean(groupB);

    const histogram = new Map<number, number>();
    const addDifference = (value: number): void => {
        const key = Math.round(value * 1e9) / 1e9;
        histogram.set(key, (histogram.get(key) ?? 0) + 1);
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([], [], observed, -1),
        edges: [],
        description: `Permutation test on ${m} pooled values; there are C(${m}, ${n1}) = ${total} possible label splits.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { observed, pValue: 1, permutations: total, extreme: 0, diffs: [], counts: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([observed], [0], observed, 0),
        edges: [],
        description: `Observed difference of means is ${observed.toFixed(4)}. Now rebuild the null distribution.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { observed, pValue: 1, permutations: total, extreme: 0, diffs: [observed], counts: [0] },
    };
    step += 1;

    let processed = 0;
    let extreme = 0;
    const sortedKeys = (): number[] => [...histogram.keys()].sort((a, b) => a - b);
    for (let mask = 0; mask < 1 << m; mask += 1) {
        let count = 0;
        for (let i = 0; i < m; i += 1) {
            count += (mask >> i) & 1;
        }
        if (count !== n1) {
            continue;
        }
        let sumA = 0;
        let sumB = 0;
        for (let i = 0; i < m; i += 1) {
            if ((mask >> i) & 1) {
                sumA += pooled[i] ?? 0;
            } else {
                sumB += pooled[i] ?? 0;
            }
        }
        const diff = sumA / n1 - sumB / n2;
        addDifference(diff);
        if (Math.abs(diff) >= Math.abs(observed) - 1e-12) {
            extreme += 1;
        }
        processed += 1;
        const keys = sortedKeys();
        const counts = keys.map((key) => histogram.get(key) ?? 0);
        const pValue = extreme / processed;
        yield {
            stepNumber: step,
            entities: makeBars(keys, counts, observed, keys.indexOf(Math.round(diff * 1e9) / 1e9)),
            edges: [],
            description: `Split ${processed} of ${total}: difference ${diff.toFixed(4)}, running p-value ${pValue.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { observed, pValue, permutations: total, extreme, diffs: keys, counts },
        };
        step += 1;
    }

    const keys = sortedKeys();
    const counts = keys.map((key) => histogram.get(key) ?? 0);
    yield {
        stepNumber: step,
        entities: makeBars(keys, counts, observed, -1),
        edges: [],
        description: `Exact p-value = ${extreme}/${total} = ${(extreme / total).toFixed(4)}: the fraction of relabelings at least as extreme as the observation.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { observed, pValue: extreme / total, permutations: total, extreme, diffs: keys, counts },
    };
}

/** The exact permutation test module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If a treatment does nothing, swapping the labels between the two groups should not change anything systematic. So pretend the labels are removable: shuffle them in every possible way, recompute the difference in means each time, and see where the real difference lands in that pile. If few shuffles are as extreme, the observed gap is unlikely to be chance.",
        invariants: [
            "Every enumerated split assigns exactly n1 values to the first group.",
            "The histogram counts add up to the number of splits processed.",
            "The running count of extreme relabelings never decreases as more splits are checked.",
        ],
        correctness:
            "There are C(m, n1) distinct ways to choose which pooled values receive the first label, and enumerating them all gives the exact randomization distribution of the mean difference under the sharp null hypothesis. The p-value counts relabelings with absolute difference at least the observed one, divided by the total, which is the definition of an exact two-sided permutation test.",
        complexityRationale:
            "Each of the C(m, n1) subsets scans all m pooled values once, giving O(C(m, n1) * m) time. Storing one entry per distinct difference costs at most O(C(m, n1)) space. Small samples keep the enumeration exact and fast.",
        uses: [
            "Comparing two groups when sample sizes are small",
            "A distribution-free alternative to the two-sample t-test",
            "A/B test significance checks without normal assumptions",
        ],
        references: [
            "Fisher, The Design of Experiments, 1935",
            "Efron and Tibshirani, An Introduction to the Bootstrap, Chapter 15",
        ],
        workedExample:
            "Pool the values 1, 2, 3, 4, 5, 6, 7, 8 into two groups of four. The observed difference is 3 - 7 = -4. Among all 70 relabelings, only the two that isolate the four smallest versus four largest reach that magnitude, giving an exact two-sided p-value of 2/70, about 0.029.",
    },
    id: "permutation-test",
    name: "Exact Two-Sample Permutation Test",
    category: "statistics-probability",
    complexity: { time: "O(C(m, n1) * m)", space: "O(C(m, n1))" },
    defaultInput: { groupA: [1, 2, 3, 4], groupB: [5, 6, 7, 8] },
    visualType: "array",
    run,
    pseudocode: [
        "pool both groups and note their sizes",
        "compute the observed difference in means",
        "for every subset of the pooled values of size n1",
        "compute the mean difference of that relabeling",
        "add it to the null histogram and count extreme cases",
        "divide extremes by the total number of subsets",
        "done: report the exact p-value",
    ],
};

export default module;
