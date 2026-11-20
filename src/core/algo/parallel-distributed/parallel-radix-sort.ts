/**
 * parallel-radix-sort.ts - Parallel LSD Radix Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Least-significant-digit radix sort processes one decimal digit at a time.
 * Each pass is a stable counting sort: count how many keys have each digit,
 * prefix-sum the counts to get output offsets, then scatter every key into its
 * slot. The counts, prefix sums, and scatter writes are all independent across
 * workers, which is why the algorithm maps well to parallel hardware.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d * (n + b)) for d digits, n keys, and base b
 *   Space: O(n + b) for the output buffer and counting array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The keys are shown as bars; the active digit pass is highlighted.
 *   - Frame metadata carries the per-digit histogram and offsets.
 *   - The final frame shows the fully sorted keys in green.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const BASE = 10;

/** Build bars for the current key order. */
function makeBars(values: number[], active: Set<number>, state: "idle" | "comparing" | "sorted"): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: active.has(index) ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** One stable counting-sort pass on the chosen base-10 digit. */
function countingPass(values: number[], digit: number): number[] {
    const count = new Array<number>(BASE).fill(0);
    for (const value of values) {
        const d = Math.floor(value / digit) % BASE;
        count[d] = (count[d] ?? 0) + 1;
    }
    const offset = new Array<number>(BASE).fill(0);
    let running = 0;
    for (let d = 0; d < BASE; d += 1) {
        offset[d] = running;
        running += count[d] ?? 0;
    }
    const output = new Array<number>(values.length).fill(0);
    for (const value of values) {
        const d = Math.floor(value / digit) % BASE;
        const slot = offset[d] ?? 0;
        output[slot] = value;
        offset[d] = slot + 1;
    }
    return output;
}

/** The parallel radix sort generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; digits?: number } | null) ?? {};
    const values = Array.isArray(task.values)
        ? task.values.map((v) => Math.max(0, Math.trunc(Number(v) || 0)))
        : [170, 45, 75, 90, 802, 24, 2, 66];
    const digits = typeof task.digits === "number" ? Math.max(1, Math.floor(task.digits)) : 3;
    let current = [...values];
    let frame = 0;

    yield {
        stepNumber: frame,
        entities: makeBars(current, new Set(), "idle"),
        edges: [],
        description: `Parallel radix sort of ${current.length} key(s) over ${digits} decimal digit(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { pass: 0, digit: 1, result: [...current], histogram: new Array<number>(BASE).fill(0) },
    };
    frame += 1;

    let place = 1;
    for (let pass = 1; pass <= digits; pass += 1) {
        const histogram = new Array<number>(BASE).fill(0);
        for (const value of current) {
            const d = Math.floor(value / place) % BASE;
            histogram[d] = (histogram[d] ?? 0) + 1;
        }
        yield {
            stepNumber: frame,
            entities: makeBars(current, new Set(current.map((_, i) => i)), "idle"),
            edges: [],
            description: `Pass ${pass}: counting digit ${place} gives histogram ${histogram.join(", ")}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { pass, digit: place, result: [...current], histogram: [...histogram] },
        };
        frame += 1;

        current = countingPass(current, place);
        yield {
            stepNumber: frame,
            entities: makeBars(current, new Set(current.map((_, i) => i)), "idle"),
            edges: [],
            description: `Pass ${pass}: stable scatter by digit ${place} completes.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { pass, digit: place, result: [...current], histogram: [...histogram] },
        };
        frame += 1;
        place *= BASE;
    }

    yield {
        stepNumber: frame,
        entities: makeBars(current, new Set(), "sorted"),
        edges: [],
        description: `Sorted ${current.length} key(s) in ${digits} digit pass(es).`,
        codeLineNumber: 7,
        layout: "array",
        meta: { pass: digits, digit: place, result: [...current], histogram: new Array<number>(BASE).fill(0) },
    };
}

/** The parallel radix sort module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Sort one digit at a time from right to left. For a digit, count how many keys fall in each bucket, turn those counts into starting offsets, and place every key into its bucket while keeping the original order inside a bucket. Because each key's destination depends only on its own digit and the shared counts, the work spreads across workers.",
        invariants: [
            "Each counting-sort pass is stable, so order from earlier digits is preserved.",
            "After pass k the keys are sorted by their lowest k digits.",
            "The histogram for a pass sums to the number of keys.",
        ],
        correctness:
            "A stable counting sort orders keys by one digit while preserving their relative order from previous passes. By induction, after processing k digits the array is sorted by the lowest k digits. After the most significant digit the whole key is ordered, and stability guarantees ties keep their earlier, lower-digit order, so the final array is fully sorted.",
        complexityRationale:
            "Each of the d passes counts n keys, scans b buckets for offsets, and scatters n keys, costing O(n + b) per pass and O(d * (n + b)) total. The output buffer and count array use O(n + b) auxiliary space.",
        uses: [
            "Sorting fixed-width integer keys on GPUs",
            "Building sorted partitions in distributed key-value stores",
            "Radix-based joins and indexing in databases",
        ],
        references: [
            "Comdie, The Radix Sort, 1929",
            "Blelloch, Prefix Sums and Their Applications, 1990",
        ],
        workedExample:
            "Sorting [170, 45, 75, 90] by units gives [170, 90, 45, 75]. The tens pass then gives [170, 90, 45, 75] again, and the hundreds pass produces [45, 75, 90, 170].",
    },
    id: "parallel-radix-sort",
    name: "Parallel Radix Sort",
    category: "parallel-distributed",
    complexity: { time: "O(d * (n + b))", space: "O(n + b)" },
    defaultInput: { values: [170, 45, 75, 90, 802, 24, 2, 66], digits: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "start with the input key array",
        "for each digit from least to most significant",
        "count how many keys have each digit value",
        "prefix-sum the counts into output offsets",
        "scatter each key into its bucket stably",
        "replace the array with the output buffer",
        "advance to the next digit place",
        "done: the array is sorted",
    ],
};

export default module;
