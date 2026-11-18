/**
 * counting-sort.ts – Counting Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Counting sort is a non-comparison sort that exploits a known, small range of
 * integer values. It counts how often each value appears, converts those
 * counts into cumulative positions, and then places every element directly
 * into its sorted slot using a stable backwards pass. Because it never
 * compares elements, it can beat the O(n log n) comparison-sort lower bound.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + k) where k is the value range (max - min + 1)
 *   Space: O(n + k) auxiliary – count array plus the output buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The value being counted is YELLOW (comparing) in the count phase.
 *   - The count cell being updated is PINK (highlight).
 *   - Elements being placed into their final position flash GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Stable (the backwards placement preserves relative order).
 *   - Only works on integer (or discrete) keys with a bounded range.
 *   - Uses an auxiliary array of size k, which blows up if the range is huge.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build the array of bar entities for a frame.
 *
 * @param arr The current array values, in display order.
 * @param states Optional index → state overrides for this frame.
 * @returns An array of `VisualEntity` bars with placeholder positions.
 */
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

/**
 * The Counting Sort generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [4, 2, 2, 8, 3, 3, 1, 6];

    let step = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – counting sort will tally each distinct value.",
        codeLineNumber: 0,
        layout: "array",
        meta: { range: arr.length ? Math.max(...arr) - Math.min(...arr) + 1 : 0 },
    };
    step += 1;

    // Handle empty input gracefully (yield at least the initial frame).
    if (arr.length === 0) {
        return;
    }

    // Determine the value range so the count array can be sized exactly.
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min + 1;

    // counts[v - min] will hold how many times value v appears.
    const counts: number[] = new Array(range).fill(0);

    // ------------------------------------------------------------------
    // Phase 1: tally how many times each value occurs.
    // ------------------------------------------------------------------
    for (let i = 0; i < arr.length; i += 1) {
        const value = arr[i];
        if (value === undefined) {
            continue;
        }
        counts[value - min] = (counts[value - min] ?? 0) + 1;

        const countStates = new Map<number, EntityState>([[i, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, countStates),
            edges: [],
            description: `Counting: one more occurrence of value ${value}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { counted: counts.reduce((a, b) => a + b, 0) },
        };
        step += 1;
    }

    // ------------------------------------------------------------------
    // Phase 2: turn counts into cumulative starting positions.
    // After this, counts[v-min] is the index where value v should start.
    // ------------------------------------------------------------------
    let total = 0;
    for (let v = 0; v < range; v += 1) {
        const count = counts[v];
        if (count !== undefined) {
            const oldTotal = total;
            total += count;
            counts[v] = oldTotal;
        }
    }

    // ------------------------------------------------------------------
    // Phase 3: place elements stably using the running positions.
    // The backwards pass keeps the sort stable.
    // ------------------------------------------------------------------
    const output: number[] = new Array(arr.length);
    const placeStates = new Map<number, EntityState>();

    for (let i = arr.length - 1; i >= 0; i -= 1) {
        const value = arr[i];
        if (value === undefined) {
            continue;
        }

        const position = counts[value - min] ?? 0;
        output[position] = value;
        counts[value - min] = position + 1;

        // Visually show the element landing in its output slot.
        const snapshot = [...arr];
        placeStates.clear();
        placeStates.set(i, "comparing");
        yield {
            stepNumber: step,
            entities: makeBars(snapshot, placeStates),
            edges: [],
            description: `Placing ${value} into output position ${position}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { placed: arr.length - i },
        };
        step += 1;
    }

    // ------------------------------------------------------------------
    // Phase 4: copy the output back and celebrate the sorted result.
    // ------------------------------------------------------------------
    for (let i = 0; i < arr.length; i += 1) {
        arr[i] = output[i] ?? 0;
    }

    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: `Array sorted with counting sort over a range of ${range} values.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { range },
    };
}

/** The Counting Sort module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "When keys are small integers, count how many times each key appears, convert the counts to cumulative positions, then place each input item directly at its position while decrementing the count.",
        "invariants": [
            "The count array holds the number of occurrences of each key before prefix sums.",
            "After prefix sums, each count is the last free position for that key."
        ],
        "correctness": "The prefix sum of counts gives the exclusive upper bound of each key's block in sorted order. Writing items from right to left with decrementing counters fills exactly that block, preserving stability and producing sorted output.",
        "complexityRationale": "Counting and prefix sums take O(n + k) where k is the key range; placement takes O(n). Space is O(n + k). When k grows much larger than n, comparison sorts are preferable.",
        "uses": [
            "Sorting bytes, digits, or small enumerated keys",
            "The inner pass of radix sort",
            "Histogram-based preprocessing"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 8",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.1"
        ],
        "workedExample": "Start [2, 0, 2, 1] with range 0..2. Counts are [1, 1, 2]. Prefix positions are [1, 2, 4]. Place right to left: 2 -> index 3, 1 -> index 1, 0 -> index 0, 2 -> index 2. Result [0, 1, 2, 2]."
    },
    id: "counting-sort",
    name: "Counting Sort",
    category: "sorting",
    complexity: { time: "O(n + k)", space: "O(n + k)" },
    // Duplicates and a compact range (1–8) make the counting steps clear.
    defaultInput: [4, 2, 2, 8, 3, 3, 1, 6],
    visualType: "array",
    run,
    pseudocode: [
        "start with empty count array of size k (value range)",
        "for each x in A: count[x-min] += 1",
        "turn counts into starting positions by prefix sums",
        "for x in A backwards: place x at count[x-min], advance it",
        "done: output holds the sorted values",
    ],
};

export default module;
