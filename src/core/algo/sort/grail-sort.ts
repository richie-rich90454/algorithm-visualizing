/**
 * grail-sort.ts - Grail Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Grail sort is a stable, in-place merge sort. It reserves a small internal
 * buffer of about sqrt(n) elements drawn from the array (the "grail"), sorts
 * the rest in short blocks with binary insertion sort, then merges the blocks
 * bottom up with rotation-based in-place merges. The reserved elements are
 * finally inserted back into place. Only O(sqrt(n)) auxiliary storage is used
 * and the relative order of equal keys is preserved.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) worst case, O(n log n) typical
 *   Space: O(sqrt(n)) for the internal buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Reserved buffer elements are PINK (highlight).
 *   - Blocks under insertion are YELLOW (comparing).
 *   - A block being merged is PURPLE (pivot).
 *   - Final positions are GREEN (sorted).
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

/** Rotate a[left..right) right by one so a[right-1] moves to a[left]. */
function rotateRightOne(a: number[], left: number, right: number): void {
    if (left >= right - 1) {
        return;
    }
    const last = a[right - 1];
    if (last === undefined) {
        return;
    }
    for (let i = right - 1; i > left; i -= 1) {
        a[i] = a[i - 1] as number;
    }
    a[left] = last;
}

/**
 * Stable in-place merge of the adjacent sorted ranges [left,mid) and
 * [mid,right). Equal elements from the left run stay before those from the
 * right run.
 */
function rotationMerge(a: number[], left: number, mid: number, right: number): void {
    let lo = left;
    let hi = mid;
    while (lo < hi && hi < right) {
        const lv = a[lo] as number;
        const rv = a[hi] as number;
        if (lv <= rv) {
            lo += 1;
            continue;
        }
        let insert = lo;
        while (insert < hi && (a[insert] as number) <= rv) {
            insert += 1;
        }
        rotateRightOne(a, insert, hi + 1);
        hi += 1;
        lo = insert + 1;
    }
}

/** Stable binary insertion sort of a[left..right). */
function binaryInsertionSort(a: number[], left: number, right: number): void {
    for (let i = left + 1; i < right; i += 1) {
        const value = a[i] as number;
        let lo = left;
        let hi = i;
        while (lo < hi) {
            const m = (lo + hi) >> 1;
            if ((a[m] as number) <= value) {
                lo = m + 1;
            } else {
                hi = m;
            }
        }
        for (let j = i; j > lo; j -= 1) {
            a[j] = a[j - 1] as number;
        }
        a[lo] = value;
    }
}

/** First index in a[0..len) whose value is >= value (lower bound). */
function lowerBound(a: number[], len: number, value: number): number {
    let lo = 0;
    let hi = len;
    while (lo < hi) {
        const m = (lo + hi) >> 1;
        if ((a[m] as number) < value) {
            lo = m + 1;
        } else {
            hi = m;
        }
    }
    return lo;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const arr = Array.isArray(input) ? [...(input as number[])] : [7, 2, 9, 4, 2, 8, 5, 1, 3, 6];
    const n = arr.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array before Grail sort begins.",
        codeLineNumber: 0,
        layout: "array",
        meta: { n, bufferSize: 0, comparisons: 0 },
    };
    step += 1;

    if (n < 2) {
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map([[0, "sorted"]])),
            edges: [],
            description: "Array of fewer than two elements is already sorted.",
            codeLineNumber: 6,
            layout: "array",
            meta: { n, bufferSize: 0, comparisons: 0 },
        };
        return;
    }

    const s = Math.max(1, Math.floor(Math.sqrt(n)));
    const buffer = arr.slice(0, s);
    const rest = arr.slice(s);

    const bufferStates = new Map<number, EntityState>();
    for (let i = 0; i < s; i += 1) {
        bufferStates.set(i, "highlight");
    }
    yield {
        stepNumber: step,
        entities: makeBars([...buffer, ...rest], bufferStates),
        edges: [],
        description: `Reserve ${s} elements as the internal grail buffer (shown first).`,
        codeLineNumber: 1,
        layout: "array",
        meta: { n, bufferSize: s, comparisons: 0 },
    };
    step += 1;

    for (let b = 0; b < rest.length; b += s) {
        binaryInsertionSort(rest, b, Math.min(b + s, rest.length));
    }
    const blockStates = new Map<number, EntityState>();
    for (let i = 0; i < s; i += 1) {
        blockStates.set(i, "highlight");
    }
    yield {
        stepNumber: step,
        entities: makeBars([...buffer, ...rest], blockStates),
        edges: [],
        description: `Sort short blocks of size ${s} with binary insertion sort.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { n, bufferSize: s, comparisons: 0 },
    };
    step += 1;

    let width = s;
    while (width < rest.length) {
        for (let left = 0; left < rest.length; left += 2 * width) {
            const mid = Math.min(left + width, rest.length);
            const right = Math.min(left + 2 * width, rest.length);
            if (mid < right) {
                rotationMerge(rest, left, mid, right);
            }
        }
        const mergeStates = new Map<number, EntityState>();
        for (let i = s; i < s + rest.length; i += 1) {
            mergeStates.set(i, i < s + width ? "pivot" : "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeBars([...buffer, ...rest], mergeStates),
            edges: [],
            description: `Merge sorted blocks of width ${width} using rotation-based in-place merges.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, bufferSize: s, width },
        };
        step += 1;
        width *= 2;
    }

    for (const value of buffer) {
        rest.splice(lowerBound(rest, rest.length, value), 0, value);
    }

    const finalStates = new Map<number, EntityState>(rest.map((_, i) => [i, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(rest, finalStates),
        edges: [],
        description: `Array fully sorted in place with an internal buffer of size ${s}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, bufferSize: s, sorted: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Grail sort gets stable in-place merging without a big temporary array by reserving a small internal buffer of about sqrt(n) elements. It sorts short blocks with binary insertion, merges the blocks using rotations that slide the smaller first element into place, and finally folds the reserved elements back in.",
        invariants: [
            "The reserved buffer holds exactly sqrt(n) elements separate from the blocks being sorted.",
            "Each block and each merged run is internally sorted and stable after its pass.",
            "Rotation merging preserves the relative order of equal keys.",
        ],
        correctness:
            "Binary insertion sort sorts every block. The rotation merge takes two adjacent sorted runs and, whenever the right run's first element is smaller, inserts it before the first larger left element via a rotation; by induction the combined run is sorted and stable. Merging all blocks and then lower-bound inserting the reserved elements yields a fully sorted, stable array.",
        complexityRationale:
            "Block insertion costs O(n sqrt(n)) and each rotation merge can be quadratic in its run length, so the worst case is O(n^2) with O(n log n) typical behavior. Only the sqrt(n)-element internal buffer is stored, giving O(sqrt(n)) auxiliary space.",
        uses: [
            "Stable sorting when extra memory is strictly limited",
            "In-place library sort implementations",
            "Embedded systems that cannot allocate a full auxiliary array",
        ],
        references: [
            "Ivolginsky, GrailSort (stable in-place merge sort), 2014",
            "Katajainen, Pasanen and Teuhola, Practical In-Place Merging, 1996",
        ],
        workedExample:
            "For ten values the buffer holds the first three. The remaining seven are sorted in blocks of three, the blocks are merged into one sorted run, and the three reserved values are inserted by lower bound, producing the full sorted array.",
    },
    id: "grail-sort",
    name: "Grail Sort",
    category: "sorting",
    complexity: { time: "O(n^2) worst, O(n log n) typical", space: "O(sqrt(n))" },
    defaultInput: [7, 2, 9, 4, 2, 8, 5, 1, 3, 6],
    visualType: "array",
    run,
    pseudocode: [
        "let n be the array length and s be floor(sqrt(n))",
        "set aside the first s elements as the internal buffer",
        "binary insertion sort each block of length s in the remainder",
        "bottom up: rotation merge adjacent sorted blocks",
        "double the merged width until the whole remainder is one run",
        "insert each buffered element at its lower bound in the run",
        "done: the array is stably sorted in place",
    ],
};

export default module;
