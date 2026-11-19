/**
 * block-quicksort.ts - Block Quicksort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Block quicksort is a branch-reduced variant of two-way quicksort. Instead
 * of testing and moving one element at a time, it scans a block of elements
 * into a small buffer, then flushes the whole buffer with straight-line
 * writes. Fewer data-dependent branches means fewer mispredictions on random
 * input, while the partition result is the same as a two-way partition.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) average, O(n^2) worst case
 *   Space: O(log n) average recursion stack, plus O(B) buffers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The pivot bar is purple (pivot).
 *   - Bars waiting in a block buffer are yellow (highlight).
 *   - Bars just flushed into their final side are green (sorted).
 *   - The currently scanned bar is orange (comparing).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BlockTask {
    values?: number[];
    blockSize?: number;
}

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
    const task = (Array.isArray(input) ? { values: input as number[] } : (input as BlockTask | null)) ?? {};
    const arr = Array.isArray(task.values) ? [...(task.values as number[])] : [7, 2, 9, 4, 1, 6, 3, 8, 5];
    const blockSize = Math.max(1, Math.min(8, Math.floor(task.blockSize ?? 4)));

    let step = 0;
    let comparisons = 0;
    let flushes = 0;
    let partitions = 0;

    const frame = (
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(arr, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { comparisons, flushes, partitions, blockSize, size: arr.length },
    });

    yield frame(new Map(), `Block quicksort on ${arr.length} bars with block size ${blockSize}.`, 0);
    step += 1;

    function* partition(lo: number, hi: number): Generator<VisualFrame, number, unknown> {
        if (lo > hi) {
            return lo;
        }
        if (lo === hi) {
            return lo;
        }
        partitions += 1;
        const pivot = arr[hi] as number;

        let i = lo;
        let j = hi - 1;
        let leftOut = lo;
        let rightOut = hi;

        yield frame(
            new Map<number, EntityState>([[hi, "pivot"]]),
            `Partition [${lo}..${hi}]: pivot ${pivot}; fill blocks of up to ${blockSize}.`,
            1,
        );
        step += 1;

        while (i <= j) {
            const leftBuf: number[] = [];
            const rightBuf: number[] = [];

            while (i <= j && leftBuf.length < blockSize && (arr[i] as number) < pivot) {
                comparisons += 1;
                leftBuf.push(arr[i] as number);
                i += 1;
            }
            while (i <= j && rightBuf.length < blockSize && (arr[j] as number) >= pivot) {
                comparisons += 1;
                rightBuf.push(arr[j] as number);
                j -= 1;
            }

            // Both scans stalled on an out-of-place pair: exchange their roles.
            if (i <= j && leftBuf.length === 0 && rightBuf.length === 0) {
                comparisons += 2;
                rightBuf.push(arr[i] as number);
                leftBuf.push(arr[j] as number);
                i += 1;
                j -= 1;
            }

            const buffered = new Map<number, EntityState>([[hi, "pivot"]]);
            for (let k = 0; k < leftBuf.length; k += 1) {
                buffered.set(leftOut + k, "highlight");
            }
            for (let k = 0; k < rightBuf.length; k += 1) {
                buffered.set(rightOut - k, "highlight");
            }
            yield frame(
                buffered,
                `Block holds ${leftBuf.length} small and ${rightBuf.length} large value(s).`,
                2,
            );
            step += 1;

            for (const value of leftBuf) {
                arr[leftOut] = value;
                leftOut += 1;
            }
            for (let k = rightBuf.length - 1; k >= 0; k -= 1) {
                arr[rightOut] = rightBuf[k] as number;
                rightOut -= 1;
            }
            flushes += 1;

            const flushed = new Map<number, EntityState>([[hi, "pivot"]]);
            for (let k = lo; k < leftOut; k += 1) {
                flushed.set(k, "sorted");
            }
            for (let k = rightOut + 1; k <= hi - 1; k += 1) {
                flushed.set(k, "sorted");
            }
            yield frame(flushed, `Flushed both blocks; boundary now at index ${leftOut}.`, 3);
            step += 1;
        }

        arr[leftOut] = pivot;
        return leftOut;
    }

    function* quickSort(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        if (lo >= hi) {
            return;
        }
        const p = yield* partition(lo, hi);
        yield* quickSort(lo, p - 1);
        yield* quickSort(p + 1, hi);
    }

    yield* quickSort(0, arr.length - 1);

    yield frame(
        new Map(arr.map((_, index) => [index, "sorted" as EntityState])),
        `Sorted ${arr.length} bars with ${comparisons} comparisons and ${flushes} block flushes.`,
        5,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Quicksort partitions an array around a pivot. A naïve partition tests and moves each element separately, which is full of hard-to-predict branches. Block quicksort first gathers a small run of elements into a buffer, then writes the whole run with straight-line stores. The partition is identical; only the write pattern changes.",
        invariants: [
            "Every value written to the left side is strictly less than the pivot, and every value written to the right side is at least the pivot.",
            "The left and right output pointers stay inside the already-scanned region, so buffered values are never overwritten before they are flushed.",
            "Once a partition finishes, the pivot sits at the boundary between the two regions.",
        ],
        correctness:
            "Each element of the range is read exactly once and placed into either the left buffer or the right buffer. Flushing writes those values into disjoint output regions, and the pivot is placed between them by induction. Recursing on the two strictly smaller sides therefore produces a fully sorted array.",
        complexityRationale:
            "A partition reads and writes each element once, so it is linear; the expected recursion depth is logarithmic, giving O(n log n) average time and O(n^2) worst-case time. The recursion stack is O(log n) on average and the two buffers hold O(B) values.",
        uses: [
            "High-performance generic sorting in standard libraries",
            "Reducing branch-misprediction cost on random integer keys",
            "Teaching the difference between an algorithm and its memory access pattern",
        ],
        references: [
            "Edelkamp, Weiß and Wild, Blocksort and branch-reduced quicksort, 2015",
            "Sedgewick and Wayne, Algorithms, Section 2.3 (Quicksort)",
        ],
        workedExample:
            "With values [7,2,9,4,1,6,3,8,5] and block size 2, the first partition picks pivot 5. Small values 2 and 4 fill a block and are flushed to the left; large values 9 and 8 fill a block and are flushed to the right. The pivot lands at index 4 and the two sides are sorted recursively.",
    },
    id: "block-quicksort",
    name: "Block Quicksort",
    category: "sorting",
    complexity: { time: "O(n log n) average", space: "O(log n)" },
    defaultInput: { values: [7, 2, 9, 4, 1, 6, 3, 8, 5], blockSize: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a pivot and set block size B",
        "start left and right scan pointers at the two ends",
        "fill a left block with small values and a right block with large values",
        "flush each block straight into its side of the array",
        "place the pivot between the two flushed sides",
        "recurse on the left and right sides",
        "done: array is fully sorted",
    ],
};

export default module;
