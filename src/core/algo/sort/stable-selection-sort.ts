/**
 * stable-selection-sort.ts - Stable Selection Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Plain selection sort swaps the minimum of the unsorted suffix into place,
 * which can jump equal keys past one another and destroy their relative
 * order. Stable selection sort keeps that order: after locating the minimum,
 * it removes it from its position and shifts the intervening elements one
 * slot to the right, then inserts the minimum at the front of the suffix.
 * Only the minimum-sized element ever moves past an equal key, so ties keep
 * the order in which they appeared.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) comparisons and O(n^2) shifts in the worst case
 *   Space: O(n) for the tagged copies that preserve identity
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars carry their value; metadata.original records the input position.
 *   - The current minimum is PINK (highlight); the scan point is YELLOW.
 *   - Elements shifted right flash RED (swapped).
 *   - The finalized prefix is GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Tagged {
    value: number;
    original: number;
}

function readInput(input: unknown): number[] {
    if (Array.isArray(input)) {
        return input.filter((v): v is number => typeof v === "number").map((v) => v);
    }
    const task = input as { values?: number[] } | null;
    if (task && Array.isArray(task.values)) {
        return task.values.filter((v): v is number => typeof v === "number").map((v) => v);
    }
    return [5, 1, 6, 2, 4, 3, 2];
}

function makeBars(items: Tagged[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
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
        metadata: { index, original: item.original },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const values = readInput(input);
    const items: Tagged[] = values.map((value, original) => ({ value, original }));
    let step = 0;
    let comparisons = 0;
    let shifts = 0;

    yield {
        stepNumber: step,
        entities: makeBars(items),
        edges: [],
        description: `Stable selection sort on ${items.length} value(s), preserving the order of equal keys.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, shifts, n: items.length },
    };
    step += 1;

    if (items.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(items),
            edges: [],
            description: "Empty array: nothing to sort, so the stable result is empty.",
            codeLineNumber: 5,
            layout: "array",
            meta: { comparisons, shifts, n: 0 },
        };
        return;
    }

    for (let i = 0; i < items.length - 1; i += 1) {
        let minIndex = i;
        for (let j = i + 1; j < items.length; j += 1) {
            comparisons += 1;
            const current = items[minIndex] as Tagged;
            const candidate = items[j] as Tagged;
            if (candidate.value < current.value) {
                minIndex = j;
            }
            const states = new Map<number, EntityState>([
                [i, "sorted"],
                [minIndex, "highlight"],
                [j, "comparing"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(items, states),
                edges: [],
                description: `Scanning position ${j}: value ${candidate.value}, smallest so far ${(items[minIndex] as Tagged).value} at ${minIndex}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, shifts, minIndex, scan: j },
            };
            step += 1;
        }

        if (minIndex !== i) {
            const minimum = items[minIndex] as Tagged;
            for (let k = minIndex; k > i; k -= 1) {
                items[k] = items[k - 1] as Tagged;
                shifts += 1;
            }
            items[i] = minimum;
            const states = new Map<number, EntityState>();
            for (let k = i; k <= minIndex; k += 1) {
                states.set(k, "swapped");
            }
            yield {
                stepNumber: step,
                entities: makeBars(items, states),
                edges: [],
                description: `Rotated the minimum ${minimum.value} from ${minIndex} to ${i}; ${shifts} shift(s) so far keep equal keys in order.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { comparisons, shifts, minIndex },
            };
            step += 1;
        }

        const done = new Map<number, EntityState>();
        for (let k = 0; k <= i; k += 1) {
            done.set(k, "sorted");
        }
        yield {
            stepNumber: step,
            entities: makeBars(items, done),
            edges: [],
            description: `Position ${i} is final with value ${(items[i] as Tagged).value}; the sorted prefix now has ${i + 1} element(s).`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, shifts, prefix: i + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(
            items,
            new Map<number, EntityState>(items.map((_, index) => [index, "sorted"] as [number, EntityState])),
        ),
        edges: [],
        description: `Sorted with ${comparisons} comparison(s) and ${shifts} shift(s); equal keys kept their input order.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { comparisons, shifts, n: items.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Selection sort repeatedly picks the smallest remaining value, but the usual swap can move an equal value ahead of another equal value. The stable version lifts the minimum out of the suffix and slides every element between its old spot and the target one step right. Because a value moves right only when a strictly smaller value is inserted ahead of it, equal values never overtake each other.",
        invariants: [
            "The prefix before the current index is sorted and holds the smallest original keys.",
            "Every element in the suffix keeps its original identity even as it shifts right.",
            "An element is shifted past only by a strictly smaller minimum, never by an equal key.",
        ],
        correctness:
            "Each pass selects a minimum of the unsorted suffix. Rotating it to the front places that minimum correctly and leaves the remaining suffix as the same multiset of values. Since a shift happens only across a strictly larger value, two equal values never exchange relative order, so by induction the final array is sorted and stable.",
        complexityRationale:
            "Finding the minimum costs a linear scan on each of n passes, and the rotation moves at most n elements, so time is quadratic in both comparisons and shifts. The tagged copies add O(n) space to hold original positions for the stability guarantee.",
        uses: [
            "Sorting records by a key while keeping file order for ties",
            "Sorting linked lists where swaps are expensive but rotations are cheap",
            "A teaching example of how swap choice affects stability",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.3 (selection sorting)",
            "Sedgewick and Wayne, Algorithms, Section 2.1 (elementary sorts)",
        ],
        workedExample:
            "Sorting the tagged values 3a, 1, 3b: the first minimum is 1 at position 1, so it is lifted out and 3a shifts right to give 1, 3a, 3b. The next pass finds no smaller value in the suffix. The two 3s keep their original order, so the result is stable.",
    },
    id: "stable-selection-sort",
    name: "Stable Selection Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(n)" },
    defaultInput: [5, 1, 6, 2, 4, 3, 2],
    visualType: "array",
    run,
    pseudocode: [
        "tag each value with its original position",
        "for i from 0 to n-2, find the minimum in the suffix i..n-1",
        "compare each candidate value with the smallest seen so far",
        "rotate the minimum left by shifting the middle values right",
        "the prefix through i is now final and stable",
        "done: report the sorted, stable array",
    ],
};

export default module;
