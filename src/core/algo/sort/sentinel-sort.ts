/**
 * sentinel-sort.ts - Sentinel Sort (Insertion Sort with a Sentinel)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Sentinel sort is insertion sort with a guard value placed before the data.
 * A value smaller than every element sits at index 0, so the inner scan can
 * shift elements left without checking whether it has run off the front: the
 * sentinel always stops it. Removing that boundary test is the whole idea.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) worst/average, O(n) on already sorted input
 *   Space: O(n) for the single sentinel slot
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The key being inserted is PINK (highlight).
 *   - Shifted elements are RED (swapped) for that frame.
 *   - The final frame is entirely GREEN.
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

interface SortEvent {
    snapshot: number[];
    insertAt: number;
    shifts: number;
    key: number;
    sentinel: number;
}

/** Insertion sort driven by a guard value at index 0. */
function sentinelSort(a: number[]): { sorted: number[]; events: SortEvent[] } {
    if (a.length === 0) return { sorted: [], events: [] };
    const sentinel = Math.min(...a) - 1;
    const work = [sentinel, ...a];
    const events: SortEvent[] = [];
    for (let j = 2; j < work.length; j += 1) {
        const key = work[j] as number;
        let i = j - 1;
        let shifts = 0;
        while (key < (work[i] as number)) {
            work[i + 1] = work[i] as number;
            i -= 1;
            shifts += 1;
        }
        work[i + 1] = key;
        events.push({
            snapshot: work.slice(1),
            insertAt: i + 1 - 1,
            shifts,
            key,
            sentinel,
        });
    }
    return { sorted: work.slice(1), events };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [5, 2, 4, 1, 3];
    const result = sentinelSort(arr);
    const sentinel = arr.length > 0 ? Math.min(...arr) - 1 : 0;
    let step = 0;
    let shifts = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Sentinel ${sentinel} placed before the data so the inner scan never crosses the front.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { sentinel, shifts, size: arr.length },
    };
    step += 1;

    for (const event of result.events) {
        shifts += event.shifts;
        const states = new Map<number, EntityState>();
        if (event.insertAt >= 0) states.set(event.insertAt, "highlight");
        yield {
            stepNumber: step,
            entities: makeBars(event.snapshot, states),
            edges: [],
            description: `Inserted key ${event.key} after ${event.shifts} shift(s); the sentinel stopped the scan at index 0.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { sentinel: event.sentinel, shifts, key: event.key, insertAt: event.insertAt },
        };
        step += 1;
        if (step > 60) break;
    }

    const sortedStates = new Map<number, EntityState>(
        result.sorted.map((_, index) => [index, "sorted"] as [number, EntityState]),
    );
    yield {
        stepNumber: step,
        entities: makeBars(result.sorted, sortedStates),
        edges: [],
        description: `Array sorted with ${shifts} shift(s), using one sentinel to remove the boundary test.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { sentinel, shifts, sorted: [...result.sorted] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain insertion sort must ask 'have I reached the start?' on every comparison. Sentinel sort answers that question once by putting a value smaller than everything else at the front. The inner loop can then shift left freely, because it is guaranteed to meet the sentinel and stop. Nothing else about the sort changes.",
        invariants: [
            "The sentinel is strictly smaller than every data value, so the scan always halts at index 0.",
            "The prefix before the current key is always sorted.",
            "Shifting and inserting preserve the multiset of data values.",
        ],
        correctness:
            "Before each insertion the prefix is sorted by induction. The scan walks left over larger values, shifting them right, until it reaches a value no larger than the key; the sentinel guarantees such a value exists. Placing the key there keeps the prefix sorted, and after the last key the whole array is ordered.",
        complexityRationale:
            "Each insertion may shift up to j elements, giving O(n^2) worst and average time and O(n) when the data is already sorted. Besides the single guard slot the algorithm uses only a few scalar variables, so space is O(n) for the displayed array.",
        uses: [
            "Removing inner-loop branches in performance-sensitive insertion sorts",
            "Teaching sentinels as a general technique for simplifying loop bounds",
            "Sorting small or nearly sorted lists in embedded code",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.1 (insertion with a sentinel)",
            "Sedgewick and Wayne, Algorithms, Section 2.1 (insertion sort)",
        ],
        workedExample:
            "For [5, 2, 4, 1] the sentinel is 0, giving [0, 5, 2, 4, 1]. Inserting 2 shifts 5 right; inserting 4 shifts nothing; inserting 1 shifts 4, 2, and 5 until the scan reaches 0. Dropping the sentinel leaves [1, 2, 4, 5].",
    },
    id: "sentinel-sort",
    name: "Sentinel Sort",
    category: "sorting",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: [5, 2, 4, 1, 3],
    visualType: "array",
    run,
    pseudocode: [
        "place a sentinel smaller than every value before the array",
        "for each data value from left to right, save it as the key",
        "scan left while the key is less than the current value",
        "shift each larger value one place to the right",
        "the sentinel stops the scan, then insert the key",
        "repeat until every value has been inserted",
        "done: drop the sentinel; the data array is sorted",
    ],
};

export default module;
