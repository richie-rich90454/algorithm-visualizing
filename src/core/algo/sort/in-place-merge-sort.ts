/**
 * in-place-merge-sort.ts - In-Place Merge Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In-place merge sort sorts the two sorted halves of a range without a full
 * auxiliary array. It locates the misplaced middle blocks with binary searches,
 * rotates them into the right order, and recurses only on the middle. Repeated
 * rotation shrinks the unsorted middle until the whole range is ordered.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log^2 n) - each merge level can rotate O(n) elements
 *   Space: O(log n) recursion stack, O(1) data memory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars in the blocks being rotated are PINK (highlight).
 *   - The settled left and right fringes are GREEN (sorted).
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

function reverse(a: number[], lo: number, hi: number): void {
    let i = lo;
    let j = hi - 1;
    while (i < j) {
        const t = a[i] as number;
        a[i] = a[j] as number;
        a[j] = t;
        i += 1;
        j -= 1;
    }
}

/** Rotate a[lo..hi) left so that a[mid..hi) comes before a[lo..mid). */
function rotate(a: number[], lo: number, mid: number, hi: number): void {
    reverse(a, lo, mid);
    reverse(a, mid, hi);
    reverse(a, lo, hi);
}

interface MergeEvent {
    snapshot: number[];
    lo: number;
    mid: number;
    hi: number;
}

/** Sort a[lo..hi) in place, recording a snapshot after each rotation. */
function sortRange(
    a: number[],
    lo: number,
    hi: number,
    events: MergeEvent[],
    guard: { count: number },
): void {
    if (hi - lo <= 1 || guard.count > 100000) return;
    const mid = (lo + hi) >> 1;
    sortRange(a, lo, mid, events, guard);
    sortRange(a, mid, hi, events, guard);
    mergeRange(a, lo, mid, hi, events, guard);
}

/** Merge sorted a[lo..mid) and a[mid..hi) using binary searches and rotation. */
function mergeRange(
    a: number[],
    lo: number,
    mid: number,
    hi: number,
    events: MergeEvent[],
    guard: { count: number },
): void {
    guard.count += 1;
    if (lo >= mid || mid >= hi || guard.count > 100000) return;
    if ((a[mid - 1] as number) <= (a[mid] as number)) return;

    const pivot = a[mid] as number;
    const leftMax = a[mid - 1] as number;

    // First index in the left half whose value exceeds the right half's minimum.
    let p = lo;
    let q = mid;
    while (p < q) {
        const m = (p + q) >> 1;
        if ((a[m] as number) <= pivot) p = m + 1;
        else q = m;
    }
    const leftStart = p;
    if (leftStart === mid) return;

    // One past the last index in the right half below the left half's maximum.
    p = mid;
    q = hi;
    while (p < q) {
        const m = (p + q) >> 1;
        if ((a[m] as number) < leftMax) p = m + 1;
        else q = m;
    }
    const rightEnd = p;
    if (rightEnd === mid) return;

    rotate(a, leftStart, mid, rightEnd);
    events.push({ snapshot: [...a], lo: leftStart, mid, hi: rightEnd });
    const newMid = leftStart + (rightEnd - mid);
    // Only the two middle blocks still overlap; the fringes are already correct.
    mergeRange(a, leftStart, newMid, rightEnd, events, guard);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [5, 1, 4, 2, 8, 3, 7, 6];
    const original = [...arr];
    const events: MergeEvent[] = [];
    let step = 0;
    let rotations = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "In-place merge sort: no full buffer, only rotations of misplaced blocks.",
        codeLineNumber: 0,
        layout: "array",
        meta: { rotations, size: arr.length },
    };
    step += 1;

    if (arr.length > 1) {
        sortRange(arr, 0, arr.length, events, { count: 0 });
    }

    for (const event of events) {
        const states = new Map<number, EntityState>();
        for (let i = 0; i < arr.length; i += 1) {
            if (i >= event.lo && i < event.hi) states.set(i, "highlight");
        }
        rotations += 1;
        yield {
            stepNumber: step,
            entities: makeBars(event.snapshot, states),
            edges: [],
            description: `Rotation ${rotations}: swapped the middle blocks [${event.lo},${event.mid}) and [${event.mid},${event.hi}).`,
            codeLineNumber: 3,
            layout: "array",
            meta: { rotations, lo: event.lo, mid: event.mid, hi: event.hi },
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
        description: `Sorted ${original.length} values in place using ${rotations} rotation(s).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { rotations, sorted: [...arr] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Ordinary merge sort borrows a second array to combine two sorted halves. The in-place version instead finds the small middle sections that are out of order, rotates them past each other, and repeats on what is left. The already-correct outer sections never move again, so only O(1) extra data memory is used.",
        invariants: [
            "The two halves of every range are internally sorted before it is merged.",
            "After a rotation the outer fringes are smaller or larger than every value in the middle.",
            "Rotations permute the data, so the multiset of values is unchanged.",
        ],
        correctness:
            "Binary searches find the first left value above the right minimum and the last right value below the left maximum, so the two middle blocks are exactly the misplaced ones. Rotating swaps their order; the outer fringes are already correctly placed relative to both blocks. Recursing on the narrowed middle eventually leaves a range whose midpoint values are ordered, at which point the whole range is sorted.",
        complexityRationale:
            "There are O(log n) recursion levels. At each level a rotation may scan up to n elements, giving O(n log^2 n) time. Only indices and a few temporary values are stored, so data memory is O(1) and the recursion stack is O(log n).",
        uses: [
            "Sorting when extra memory is unavailable or expensive",
            "Embedded systems with tight RAM budgets",
            "Teaching the rotation-based approach to in-place merging",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.4 (in-place merging)",
            "Geffert, Katajainen, and Pasanen, Merging in Place, 1999",
        ],
        workedExample:
            "For [2, 4, 1, 3] the halves sort to [2, 4] and [1, 3]. The left block [2, 4] exceeds 1 and the right block [1, 3] is below 4, so rotating yields [1, 3, 2, 4]. A second rotation on the middle swaps 3 and 2 to give [1, 2, 3, 4].",
    },
    id: "in-place-merge-sort",
    name: "In-Place Merge Sort",
    category: "sorting",
    complexity: { time: "O(n log^2 n)", space: "O(log n)" },
    defaultInput: [5, 1, 4, 2, 8, 3, 7, 6],
    visualType: "array",
    run,
    pseudocode: [
        "recursively sort the left and right halves of each range",
        "if the midpoint values are already ordered, the range is sorted",
        "binary search the left half for the first value above the right minimum",
        "binary search the right half for the last value below the left maximum",
        "rotate the two misplaced middle blocks past each other",
        "repeat on the narrowed middle until no rotation is needed",
        "done: the whole array is sorted using only rotations",
    ],
};

export default module;
