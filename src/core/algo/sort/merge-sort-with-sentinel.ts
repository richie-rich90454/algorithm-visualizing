/**
 * merge-sort-with-sentinel.ts - Merge Sort with Sentinels
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is the classic textbook merge sort whose merge step appends a sentinel
 * value to each sorted half. Because the sentinel compares larger than every
 * real key, the merge loop never has to test whether a half is exhausted: once
 * one half runs out, the sentinel keeps losing and the remaining keys of the
 * other half are copied straight through.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) on every input
 *   Space: O(n) for the two sentinel-augmented halves
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The two run fronts being compared are YELLOW (comparing).
 *   - Frames where a sentinel decides the comparison say so in the caption.
 *   - A completed merged run is GREEN (sorted).
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
    const task = (input as { values?: number[] } | null) ?? {};
    const arr = Array.isArray(task.values) ? [...task.values] : [6, 3, 8, 1, 7, 2, 5, 4];

    let step = 0;
    let merges = 0;
    let sentinelComparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Top-down merge sort: each merge appends a sentinel to both halves so the copy loop needs no bounds test.",
        codeLineNumber: 0,
        layout: "array",
        meta: { merges, sentinelComparisons },
    };
    step += 1;

    function* merge(lo: number, mid: number, hi: number): Generator<VisualFrame, void, unknown> {
        // L and R carry one extra sentinel slot each; the sentinel is conceptual
        // and never becomes a bar entity, so bar values stay finite.
        const left: number[] = [];
        const right: number[] = [];
        for (let k = lo; k <= mid; k += 1) {
            left.push(arr[k] as number);
        }
        for (let k = mid + 1; k <= hi; k += 1) {
            right.push(arr[k] as number);
        }
        left.push(Number.POSITIVE_INFINITY);
        right.push(Number.POSITIVE_INFINITY);

        let i = 0;
        let j = 0;
        for (let k = lo; k <= hi; k += 1) {
            const leftVal = left[i] as number;
            const rightVal = right[j] as number;
            const leftSentinel = !Number.isFinite(leftVal);
            const rightSentinel = !Number.isFinite(rightVal);
            const takeLeft = leftVal <= rightVal;
            if (leftSentinel || rightSentinel) {
                sentinelComparisons += 1;
            }

            const states = new Map<number, EntityState>();
            if (!leftSentinel) {
                states.set(lo + i, "comparing");
            }
            if (!rightSentinel) {
                states.set(mid + 1 + j, "comparing");
            }
            const caption = leftSentinel
                ? `Left sentinel loses to ${rightVal}; copy the rest of the right run.`
                : rightSentinel
                  ? `Right sentinel loses to ${leftVal}; copy the rest of the left run.`
                  : `Compare run fronts ${leftVal} and ${rightVal}; take ${takeLeft ? "left" : "right"} (left wins ties).`;
            yield {
                stepNumber: step,
                entities: makeBars(arr, states),
                edges: [],
                description: caption,
                codeLineNumber: 2,
                layout: "array",
                meta: { merges, sentinelComparisons, lo, hi, sentinelUsed: leftSentinel || rightSentinel },
            };
            step += 1;

            if (takeLeft) {
                arr[k] = leftVal;
                i += 1;
            } else {
                arr[k] = rightVal;
                j += 1;
            }
        }

        merges += 1;
        const mergedStates = new Map<number, EntityState>();
        for (let k = lo; k <= hi; k += 1) {
            mergedStates.set(k, "sorted");
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, mergedStates),
            edges: [],
            description: `Merged [${lo}..${hi}] using sentinel-guided copies; the slice is sorted.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { merges, sentinelComparisons, lo, hi },
        };
        step += 1;
    }

    function* sortRange(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        if (lo >= hi) {
            return;
        }
        const mid = Math.floor((lo + hi) / 2);
        const splitStates = new Map<number, EntityState>();
        for (let k = lo; k <= hi; k += 1) {
            splitStates.set(k, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, splitStates),
            edges: [],
            description: `Splitting [${lo}..${hi}] at ${mid}; the halves will be sentinel-merged on the way back up.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { merges, sentinelComparisons, lo, hi },
        };
        step += 1;
        yield* sortRange(lo, mid);
        yield* sortRange(mid + 1, hi);
        yield* merge(lo, mid, hi);
    }

    yield* sortRange(0, arr.length - 1);

    const finalStates = new Map<number, EntityState>(arr.map((_, i) => [i, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, finalStates),
        edges: [],
        description: `Array sorted with ${merges} merge(s) and ${sentinelComparisons} sentinel-guided copy step(s).`,
        codeLineNumber: 4,
        layout: "array",
        meta: { merges, sentinelComparisons, sorted: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Merge sort recursively sorts two halves and then zips them together. The sentinel trick simplifies that zip: put an infinite value at the end of each half, so comparing the two fronts always produces a winner. When one side reaches its sentinel, every remaining key of the other side is copied automatically.",
        invariants: [
            "Each recursive call returns its input values in sorted order.",
            "During a merge, the sentinel is strictly larger than every real key in either half.",
            "Taking the smaller front, with ties going to the left, keeps the output prefix sorted and stable.",
        ],
        correctness:
            "By induction the two halves are sorted. Appending infinities preserves their order. At each output step the smaller front is the smallest remaining key, so the prefix stays sorted; when one front is infinite all real keys of the other half are emitted in order. The result contains every input value exactly once.",
        complexityRationale:
            "Each of the log n merge levels copies n keys and builds two halves of total size n, so time is O(n log n). The two sentinel-augmented halves use O(n) auxiliary space.",
        uses: [
            "Stable external sorting where records must retain their relative order",
            "A clean introduction to the merge step before studying timsort",
            "Merge routines in functional languages where index bounds are costly to test",
        ],
        references: [
            "CLRS, Introduction to Algorithms, Chapter 2 (merge sort with sentinels)",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.4",
        ],
        workedExample:
            "To merge 1, 4 with 2, 3, form 1, 4, infinity and 2, 3, infinity. Compare 1 and 2 and take 1; compare 4 and 2 and take 2; compare 4 and 3 and take 3; now the right front is infinity, so the sentinel loses to 4 and the remaining left key is copied, giving 1, 2, 3, 4.",
    },
    id: "merge-sort-with-sentinel",
    name: "Merge Sort with Sentinels",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [6, 3, 8, 1, 7, 2, 5, 4],
    visualType: "array",
    run,
    pseudocode: [
        "if the range holds one value, return it unchanged",
        "sort the left and right halves recursively",
        "append an infinite sentinel to each sorted half",
        "repeatedly take the smaller front into the output",
        "copy the remaining real keys once a sentinel appears",
        "write the merged run back into the array",
        "done: the whole array is sorted",
    ],
};

export default module;
