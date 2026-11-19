/**
 * ninther-quicksort.ts - Ninther Quicksort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Ninther quicksort picks its pivot with the "ninther": nine evenly spaced
 * samples are split into three groups of three, each group yields its median,
 * and the median of those three medians becomes the pivot. This is a stronger
 * approximation to the true median than a simple median of three, so partitions
 * are more balanced on large or adversarial inputs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) average, O(n^2) worst
 *   Space: O(log n) recursion stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The nine sampled positions are PINK (highlight) when the pivot is chosen.
 *   - The chosen pivot is YELLOW (pivot) during the partition.
 *   - Values below the pivot are GREEN (sorted) as they are placed.
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

function median3(a: number, b: number, c: number): number {
    return a < b ? (b < c ? b : a < c ? c : a) : a < c ? a : b < c ? c : b;
}

/** Return the index of the ninther pivot within a[lo..hi). */
function nintherIndex(a: number[], lo: number, hi: number): number {
    const n = hi - lo;
    if (n < 9) return lo + ((n - 1) >> 1);
    const step = (n - 1) / 8;
    const idx = (k: number): number => lo + Math.round(k * step);
    const sample = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => idx(k));
    const med = (i: number): number => {
        const x = a[sample[i] as number] as number;
        const y = a[sample[i + 1] as number] as number;
        const z = a[sample[i + 2] as number] as number;
        const m = median3(x, y, z);
        return [x, y, z].filter((v) => v === m)[0] as number;
    };
    const m1 = med(0);
    const m2 = med(3);
    const m3 = med(6);
    const pivotValue = median3(m1, m2, m3);
    for (const i of sample) {
        if (a[i] === pivotValue) return i;
    }
    return lo + ((n - 1) >> 1);
}

interface QuickEvent {
    snapshot: number[];
    kind: "sample" | "partition";
    sample: number[];
    pivot: number;
    store: number;
}

function swap(a: number[], i: number, j: number): void {
    const t = a[i] as number;
    a[i] = a[j] as number;
    a[j] = t;
}

/** Lomuto partition around a[hi-1], recording one event. */
function partition(
    a: number[],
    lo: number,
    hi: number,
    events: QuickEvent[],
): number {
    const pivot = a[hi - 1] as number;
    let store = lo;
    for (let i = lo; i < hi - 1; i += 1) {
        if ((a[i] as number) < pivot) {
            swap(a, i, store);
            store += 1;
        }
    }
    swap(a, store, hi - 1);
    events.push({ snapshot: [...a], kind: "partition", sample: [], pivot: store, store });
    return store;
}

function quickSort(
    a: number[],
    lo: number,
    hi: number,
    events: QuickEvent[],
): void {
    if (hi - lo <= 1) return;
    const pivotIdx = nintherIndex(a, lo, hi);
    // Sample positions are drawn from the whole range for the teaching frame.
    const n = hi - lo;
    const step = Math.max(1, Math.floor((n - 1) / 8));
    const sample: number[] = [];
    for (let k = lo; k < hi && sample.length < 9; k += step) sample.push(k);
    events.push({ snapshot: [...a], kind: "sample", sample, pivot: pivotIdx, store: -1 });
    swap(a, pivotIdx, hi - 1);
    const p = partition(a, lo, hi, events);
    quickSort(a, lo, p, events);
    quickSort(a, p + 1, hi, events);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [9, 2, 7, 1, 8, 3, 6, 4, 5];
    const events: QuickEvent[] = [];
    let step = 0;
    let partitions = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Ninther quicksort: pivot is the median of three medians of three.",
        codeLineNumber: 0,
        layout: "array",
        meta: { partitions, size: arr.length },
    };
    step += 1;

    if (arr.length > 1) quickSort(arr, 0, arr.length, events);

    for (const event of events) {
        const states = new Map<number, EntityState>();
        if (event.kind === "sample") {
            for (const i of event.sample) states.set(i, "highlight");
            states.set(event.pivot, "pivot");
        } else {
            for (let i = event.store + 1; i < event.snapshot.length; i += 1) {
                states.set(i, "idle");
            }
            states.set(event.pivot, "pivot");
            for (let i = 0; i < event.pivot; i += 1) states.set(i, "sorted");
        }
        if (event.kind === "partition") partitions += 1;
        yield {
            stepNumber: step,
            entities: makeBars(event.snapshot, states),
            edges: [],
            description:
                event.kind === "sample"
                    ? `Ninther sampled ${event.sample.length} positions; pivot value is ${event.snapshot[event.pivot]}.`
                    : `Partition placed pivot ${event.snapshot[event.pivot]} at index ${event.pivot}.`,
            codeLineNumber: event.kind === "sample" ? 2 : 4,
            layout: "array",
            meta: { partitions, pivotIndex: event.pivot, pivotValue: event.snapshot[event.pivot] ?? 0 },
        };
        step += 1;
        if (step > 60) break;
    }

    const sortedStates = new Map<number, EntityState>(
        arr.map((_, index) => [index, "sorted"] as [number, EntityState]),
    );
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: `Sorted in ${partitions} partition(s) using ninther pivot selection.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { partitions, sorted: [...arr] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A good pivot keeps quicksort's two sides balanced. The ninther is a cheap way to estimate the median: take nine samples spread through the range, find the median of each group of three, then take the median of those three medians. It is more reliable than a median of three and costs only a constant number of comparisons.",
        invariants: [
            "Every value less than the pivot ends up in the left partition, every greater value in the right.",
            "The pivot is placed at its final sorted index by each partition.",
            "The nine samples are spread across the range rather than clustered at one end.",
        ],
        correctness:
            "Lomuto partition swaps every value below the pivot into the front and then drops the pivot at the boundary, so the pivot reaches its final position and no element crosses to the wrong side. Recursing on the two subranges sorts them independently; by induction the whole array is sorted. The pivot choice affects speed only, not correctness.",
        complexityRationale:
            "Ninther selection is O(1) work per partition. A partition scans its range once, so a balanced run costs O(n log n), though a badly unbalanced one degenerates to O(n^2). The recursion stack holds O(log n) frames on average.",
        uses: [
            "Pivot selection in production introsort and generic sort libraries",
            "Sorting large arrays where simple pivots degrade on patterned data",
            "Demonstrating sampling-based pivot choice in a classroom",
        ],
        references: [
            "Bentley and McIlroy, Engineering a Sort Function, Software: Practice and Experience, 1993",
            "Sedgewick and Wayne, Algorithms, Section 2.3 (quicksort)",
        ],
        workedExample:
            "For a range with samples [9, 2, 7], [1, 8, 3], [6, 4, 5] the group medians are 7, 3, and 5. Their median is 5, so 5 is used as the pivot even though it is not the exact median of the whole range.",
    },
    id: "ninther-quicksort",
    name: "Ninther Quicksort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(log n)" },
    defaultInput: [9, 2, 7, 1, 8, 3, 6, 4, 5],
    visualType: "array",
    run,
    pseudocode: [
        "if the range has one or zero values, return",
        "draw nine evenly spaced samples from the range",
        "median of each triple, then median of those three medians is the pivot",
        "swap the pivot to the end of the range",
        "partition: move values below the pivot to the front",
        "place the pivot at the partition boundary in its final position",
        "recursively quicksort the left and right subranges",
        "done: every pivot is in place and the array is sorted",
    ],
};

export default module;
