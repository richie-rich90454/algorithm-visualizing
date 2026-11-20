/**
 * interpolation-sort.ts - Interpolation Sort (Histogram Sort)
 *
 * A distribution sort that computes a key's destination from its value rather
 * than by comparison. The key is linearly interpolated from the [min, max]
 * range into one of n slots, appended stably to that slot, and the slots are
 * concatenated in order after a small local insertion sort resolves the keys
 * that landed together. With a near-uniform spread the slots stay tiny and the
 * run is close to linear.
 *
 * Time O(n + k) average for slot size k, O(n^2) worst; space O(n).
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
    const arr = Array.isArray(input) ? [...(input as number[])] : [8, 3, 9, 1, 6, 4, 7, 2, 5];
    const n = arr.length;
    let step = 0;
    let comparisons = 0;
    let moves = 0;

    const frame = (
        values: number[],
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(values, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { comparisons, moves, ...extra },
    });

    yield frame(arr, new Map(), "Interpolation sort: map each value into a slot by its position in the range.", 0, {
        n,
    });
    step += 1;

    if (n < 2) {
        yield frame(arr, new Map(), "Fewer than two values: already sorted.", 6, { n });
        return;
    }

    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const buckets: number[][] = Array.from({ length: n }, () => []);
    const slotOf = (value: number): number =>
        max === min ? 0 : Math.max(0, Math.min(n - 1, Math.floor(((value - min) / (max - min)) * n)));

    yield frame(
        arr,
        new Map([
            [arr.indexOf(min), "pivot"],
            [arr.indexOf(max), "pivot"],
        ]),
        `Value range is [${min}, ${max}]; ${n} interpolation slots are available.`,
        1,
        { min, max },
    );
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const v = arr[i]!;
        const slot = slotOf(v);
        buckets[slot]!.push(v);
        moves += 1;
        yield frame(
            arr,
            new Map([
                [i, "comparing"],
                [slot, "highlight"],
            ]),
            `Value ${v} interpolates to slot ${slot}.`,
            2,
            { min, max, current: v, slot, bucketSizes: buckets.map((b) => b.length) },
        );
        step += 1;
    }

    const out: number[] = [];
    for (let s = 0; s < n; s += 1) {
        const bucket = buckets[s]!;
        if (bucket.length === 0) {
            continue;
        }
        for (let i = 1; i < bucket.length; i += 1) {
            const key = bucket[i]!;
            let j = i - 1;
            comparisons += 1;
            while (j >= 0 && bucket[j]! > key) {
                bucket[j + 1] = bucket[j]!;
                comparisons += 1;
                moves += 1;
                j -= 1;
            }
            bucket[j + 1] = key;
        }
        const start = out.length;
        out.push(...bucket);
        const states = new Map<number, EntityState>();
        for (let k = start; k < out.length; k += 1) {
            states.set(k, "sorted");
        }
        yield frame(
            out,
            states,
            `Slot ${s} holds ${bucket.length} key(s); local insertion order is ${bucket.join(", ")}.`,
            4,
            { min, max, slot: s, bucketSizes: buckets.map((b) => b.length) },
        );
        step += 1;
    }

    const allSorted = new Map<number, EntityState>(out.map((_, i) => [i, "sorted"] as [number, EntityState]));
    yield frame(
        out,
        allSorted,
        `Interpolated ${n} values into slots and concatenated them into sorted order.`,
        6,
        { min, max, comparisons, moves },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than compare keys, estimate where each one belongs. Interpolation maps the smallest value to the first slot and the largest to the last, with every other value placed proportionally between them. Keys that land in the same slot are few, so a tiny local insertion sort finishes the job and the slots are read off in order.",
        invariants: [
            "The slot index is a nondecreasing function of the key value.",
            "Every key is appended to exactly one slot, so the multiset is preserved.",
            "Slots are concatenated in increasing slot order, so all keys of a lower slot precede all keys of a higher slot.",
        ],
        correctness:
            "Because interpolation is monotonic, no key can be placed in a slot below a smaller key's slot. Sorting each slot puts its own keys in order, and concatenating slots in index order therefore produces a fully sorted array. Appending never drops or duplicates a key, so the output is a permutation of the input.",
        complexityRationale:
            "Computing slots is O(n) and each insertion sort costs O(k^2) for a slot of size k. Uniform data gives constant-size slots and O(n) total work; data concentrated in one slot degenerates to O(n^2). The n slots and output array use O(n) space.",
        uses: [
            "Sorting roughly uniform numeric data such as timestamps or sensor readings",
            "A teaching bridge between comparison sorts and distribution sorts",
            "Histogram-based bucketing in radix and external sorting pipelines",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 3, Section 5.2 (distribution sorts)",
            "Sedgewick, Algorithms in C, Part 4, Chapter on radix and bucket methods",
        ],
        workedExample:
            "For [8, 3, 9, 1, 6] with min 1 and max 9 and five slots, values map to slots 4, 1, 5 capped to 4, 0, and 3. Concatenating the nonempty slots after sorting their contents yields [1, 3, 6, 8, 9].",
    },
    id: "interpolation-sort",
    name: "Interpolation Sort",
    category: "sorting",
    complexity: { time: "O(n + k) average, O(n²) worst", space: "O(n)" },
    defaultInput: [8, 3, 9, 1, 6, 4, 7, 2, 5],
    visualType: "array",
    run,
    pseudocode: [
        "copy the input and find the minimum and maximum",
        "create one slot per element across the value range",
        "for each value compute its interpolated slot index",
        "append the value stably into that slot",
        "sort the keys inside each slot with insertion sort",
        "concatenate the slots in increasing index order",
        "done: the concatenated slots are in sorted order",
    ],
};

export default module;
