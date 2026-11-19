/**
 * stable-quicksort.ts - Stable Quicksort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A plain quicksort is not stable: swapping elements around a pivot can
 * reverse the order of equal keys. Stable quicksort replaces the in-place
 * partition with a stable one. It scans the range, collects keys strictly
 * smaller than the pivot in one buffer and all other keys in a second
 * buffer, then writes the buffers back around the pivot. Because buffers
 * preserve scan order, equal keys keep their original relative order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) average, O(n^2) worst case
 *   Space: O(n) for the buffers plus O(log n) recursion stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The pivot bar is purple (pivot).
 *   - Bars collected into the less-than buffer are yellow (highlight).
 *   - Bars collected into the greater-or-equal buffer are pink (visited).
 *   - Bars written back into place are green (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface StableTask {
    values?: number[];
}

interface Item {
    value: number;
    id: number;
}

function makeBars(items: Item[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return items.map((item, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(item.value),
        value: item.value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, originalIndex: item.id },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (Array.isArray(input) ? { values: input as number[] } : (input as StableTask | null)) ?? {};
    const src = Array.isArray(task.values) ? (task.values as number[]) : [4, 2, 4, 1, 3, 2, 4, 1];
    const items: Item[] = src.map((value, id) => ({ value, id }));

    let step = 0;
    let comparisons = 0;
    let partitions = 0;

    const frame = (
        shown: Item[],
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(shown, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { comparisons, partitions, size: shown.length, stable: true },
    });

    yield frame(items, new Map(), `Stable quicksort on ${items.length} bars with equal keys.`, 0);
    step += 1;

    function* partition(lo: number, hi: number): Generator<VisualFrame, number, unknown> {
        if (lo >= hi) return lo;
        partitions += 1;
        const pivot = items[lo] as Item;

        yield frame(
            items,
            new Map<number, EntityState>([[lo, "pivot"]]),
            `Partition [${lo}..${hi}]: pivot value ${pivot.value}; stable buffers preserve order.`,
            1,
        );
        step += 1;

        const less: Item[] = [];
        const greaterEqual: Item[] = [];
        for (let i = lo + 1; i <= hi; i += 1) {
            const item = items[i] as Item;
            comparisons += 1;
            const states = new Map<number, EntityState>([[lo, "pivot"], [i, "comparing"]]);
            for (let k = lo + 1; k < i; k += 1) {
                states.set(k, item.value < pivot.value ? "highlight" : "visited");
            }
            yield frame(items, states, `Compare ${item.value} with pivot ${pivot.value}; append to a buffer.`, 2);
            step += 1;
            if (item.value < pivot.value) less.push(item);
            else greaterEqual.push(item);
        }

        let write = lo;
        for (const item of less) {
            items[write] = item;
            write += 1;
        }
        items[write] = pivot;
        const pivotIndex = write;
        write += 1;
        for (const item of greaterEqual) {
            items[write] = item;
            write += 1;
        }

        const placed = new Map<number, EntityState>();
        for (let k = lo; k <= hi; k += 1) placed.set(k, k === pivotIndex ? "pivot" : "sorted");
        yield frame(
            items,
            placed,
            `Wrote ${less.length} smaller key(s), pivot, then ${greaterEqual.length} key(s) in original order.`,
            3,
        );
        step += 1;
        return pivotIndex;
    }

    function* quickSort(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        if (lo >= hi) return;
        const p = yield* partition(lo, hi);
        yield* quickSort(lo, p - 1);
        yield* quickSort(p + 1, hi);
    }

    yield* quickSort(0, items.length - 1);

    yield frame(
        items,
        new Map(items.map((_, index) => [index, "sorted" as EntityState])),
        `Sorted ${items.length} bars with ${comparisons} comparisons; equal keys kept their order.`,
        6,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Quicksort's usual in-place partition swaps values past the pivot, which can reorder equal keys. The stable version instead scans the range once and copies values into two buffers: those strictly less than the pivot and those greater or equal. Writing the buffers back around the pivot never reorders equal keys, so stability is preserved through every recursive call.",
        invariants: [
            "Each buffer keeps values in the exact order in which they were scanned.",
            "Every value written to the left of the pivot is strictly smaller; every value written to the right is at least as large.",
            "Equal keys that land in the same buffer remain in their original relative order.",
        ],
        correctness:
            "The stable partition returns two correctly separated regions plus a pivot, and it preserves the order of equal keys inside each region. By induction the recursive calls sort each region while preserving order, and crossing regions never mix equal keys because all left values are strictly smaller than all right values. The result is a sorted, stable permutation.",
        complexityRationale:
            "Each partition scans its range and copies every element once, so it is linear; average recursion depth is logarithmic, giving O(n log n) time and O(n^2) worst case. The two buffers hold O(n) items across the active call, with O(log n) recursion stack on average.",
        uses: [
            "Sorting records where ties must keep insertion order",
            "A stable alternative when quicksort's speed is wanted",
            "Teaching the difference between stability and correctness",
        ],
        references: [
            "Sedgewick and Wayne, Algorithms, Section 2.3 (Stability of quicksort)",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.2",
        ],
        workedExample:
            "For [4a,2a,4b,1a,3,2b,4c,1b] the first pivot is 4a. Smaller keys 2a,1a,3,2b,1b are buffered in that order; keys equal or larger (4b,4c) follow the pivot. Recursion sorts the left buffer, and the three 4s remain 4a, 4b, 4c.",
    },
    id: "stable-quicksort",
    name: "Stable Quicksort",
    category: "sorting",
    complexity: { time: "O(n log n) average", space: "O(n)" },
    defaultInput: { values: [4, 2, 4, 1, 3, 2, 4, 1] },
    visualType: "array",
    run,
    pseudocode: [
        "pick the first key of the range as pivot",
        "scan the rest of the range once from left to right",
        "append smaller keys to the less buffer in scan order",
        "append all other keys to the greater-or-equal buffer",
        "write less buffer, then pivot, then greater-or-equal buffer",
        "recurse on the two sides of the pivot",
        "done: keys are sorted and ties keep their original order",
    ],
};

export default module;
