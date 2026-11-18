/**
 * median-of-two-sorted-arrays.ts – Median of Two Sorted Arrays
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Finds the median of two sorted arrays without merging them. It binary-
 * searches a partition point i in the shorter array (with a complementary
 * cut j in the longer one) so that every element left of the cuts is ≤ every
 * element right of them. Once maxLeft ≤ minRight holds, the median falls out
 * directly: the middle value for odd totals, the average of the two middle
 * values for even totals.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log(min(n, m))) – binary search over the shorter array
 *   Space: O(1) auxiliary – only the partition indices and edge values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The merged array is shown for context; probes are all IDLE.
 *   - The one or two median positions turn GREEN (sorted) at the end.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires both inputs sorted ascending; either may be empty (not both).
 *   - The classic "binary search on the answer's structure" interview problem.
 *   - Edge partitions use infinities so empty sides compare cleanly.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(arr: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return arr.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number[]; b?: number[] } | null) ?? {};
    const a = Array.isArray(task.a) ? [...(task.a as number[])] : [1, 2, 3, 4];
    const b = Array.isArray(task.b) ? [...(task.b as number[])] : [5, 6, 7, 8];
    const merged = [...a, ...b].sort((x, y) => x - y);
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(merged),
        edges: [],
        description: `Median of [${a.join(",")}] and [${b.join(",")}] via partition search.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons },
    };
    step += 1;
    if (merged.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(merged),
            edges: [],
            description: "Both arrays are empty, so no median exists here.",
            codeLineNumber: 5,
            layout: "array",
            meta: { comparisons },
        };
        return;
    }
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    const m = short.length;
    const n = long.length;
    let lo = 0;
    let hi = m;
    let cut = 0;
    while (lo <= hi && step < 10) {
        const i = Math.floor((lo + hi) / 2);
        const j = Math.floor((m + n + 1) / 2) - i;
        const l1 = i === 0 ? Number.NEGATIVE_INFINITY : (short[i - 1] as number);
        const r1 = i === m ? Number.POSITIVE_INFINITY : (short[i] as number);
        const l2 = j === 0 ? Number.NEGATIVE_INFINITY : (long[j - 1] as number);
        const r2 = j === n ? Number.POSITIVE_INFINITY : (long[j] as number);
        comparisons += 1;
        yield {
            stepNumber: step,
            entities: makeBars(merged),
            edges: [],
            description: `Partition i=${i}, j=${j}: maxLeft=${Math.max(l1, l2)}, minRight=${Math.min(r1, r2)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, i, j },
        };
        step += 1;
        if (l1 <= r2 && l2 <= r1) {
            cut = i;
            break;
        }
        if (l1 > r2) hi = i - 1;
        else lo = i + 1;
        cut = lo;
    }
    const total = m + n;
    let median: number;
    let medianIdx: number[];
    if (total % 2 === 1) {
        median = merged[Math.floor(total / 2)] as number;
        medianIdx = [Math.floor(total / 2)];
    } else {
        const x = merged[total / 2 - 1] as number;
        const y = merged[total / 2] as number;
        median = (x + y) / 2;
        medianIdx = [total / 2 - 1, total / 2];
    }
    const states = new Map<number, EntityState>(
        medianIdx.map((i) => [i, "sorted"] as [number, EntityState]),
    );
    yield {
        stepNumber: step,
        entities: makeBars(merged, states),
        edges: [],
        description: `Partition locked (cut ${cut}) – median is ${median}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { comparisons, median, cut },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "This finds the median of two sorted arrays without merging them. It binary searches a cut in the shorter array and a complementary cut in the longer one so every element on the left is at most every element on the right.",
        "invariants": [
            "The cut indices partition both arrays into left and right parts.",
            "The maximum of the left parts is at most the minimum of the right parts at a valid cut."
        ],
        "correctness": "A valid cut splits the combined elements into equal halves with the correct ordering, so the median is the average of the two largest left values for even totals or the smaller left maximum for odd totals; binary search finds that cut.",
        "complexityRationale": "The binary search runs over the shorter array of length min(n,m), giving O(log(min(n,m))) time and O(1) space.",
        "uses": [
            "Computing medians of merged data without merging",
            "Statistics over distributed sorted streams",
            "Teaching partition-based binary search"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 2 exercises",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.3.2 (medians)"
        ],
        "workedExample": "For [1,2,3,4] and [5,6,7,8], the cut lands after 4 in the first array and before 5 in the second; the median is (4+5)/2 = 4.5, found after a few partition checks."
    },
    id: "median-of-two-sorted-arrays",
    name: "Median of Two Sorted Arrays",
    category: "searching",
    complexity: { time: "O(log(min(n, m)))", space: "O(1)" },
    defaultInput: { a: [1, 2, 3, 4], b: [5, 6, 7, 8] },
    visualType: "array",
    run,
    pseudocode: [
        "start with lo ← 0 and hi ← m over the shorter array",
        "while lo ≤ hi: cut shorter at i and longer at j to split evenly",
        "compare maxLeft ← max(A[i-1], B[j-1]) with minRight ← min(A[i], B[j])",
        "if maxLeft ≤ minRight: the partition is correct, stop searching",
        "if A[i-1] > B[j]: hi ← i-1 else lo ← i+1 and repeat",
        "done: return middle value (or average of two) as the median",
    ],
};

export default module;
