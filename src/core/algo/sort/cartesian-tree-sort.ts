/**
 * cartesian-tree-sort.ts - Cartesian Tree Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Builds a min Cartesian tree over the input: an inorder walk visits the array
 * in its original order, and every parent is no larger than its children, so
 * the root holds the smallest value. Repeatedly deleting the root (merging its
 * left and right subtrees with the treap merge operation) emits the values in
 * ascending order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) expected - O(n) build plus n root deletions
 *   Space: O(n) for the parent and child arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the values; the growing sorted prefix turns GREEN (sorted).
 *   - The current tree minimum flashes YELLOW (pivot).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The Cartesian tree is unique for distinct priorities; ties break left.
 *   - Merging two subtrees preserves inorder order and the min-heap property.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], sortedCount: number, pivotIndex: number): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (index < sortedCount) state = "sorted";
        else if (index === pivotIndex) state = "pivot";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index },
        };
    });
}

/** Build the min Cartesian tree; return the root index (-1 when empty). */
function buildCartesian(
    values: number[],
    left: number[],
    right: number[],
    parent: number[],
): number {
    const stack: number[] = [];
    for (let i = 0; i < values.length; i += 1) {
        let last = -1;
        while (stack.length > 0 && (values[stack[stack.length - 1] as number] ?? 0) > (values[i] ?? 0)) {
            last = stack.pop() as number;
        }
        if (stack.length > 0) {
            const top = stack[stack.length - 1] as number;
            right[top] = i;
            parent[i] = top;
        }
        if (last !== -1) {
            left[i] = last;
            parent[last] = i;
        }
        stack.push(i);
    }
    return stack.length > 0 ? (stack[0] as number) : -1;
}

/** Merge two Cartesian subtrees; every index in a precedes every index in b. */
function merge(
    a: number,
    b: number,
    values: number[],
    left: number[],
    right: number[],
    parent: number[],
): number {
    if (a === -1) return b;
    if (b === -1) return a;
    if ((values[a] as number) <= (values[b] as number)) {
        const next = merge(right[a] as number, b, values, left, right, parent);
        right[a] = next;
        if (next !== -1) parent[next] = a;
        return a;
    }
    const next = merge(a, left[b] as number, values, left, right, parent);
    left[b] = next;
    if (next !== -1) parent[next] = b;
    return b;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values: number[] = Array.isArray(task.values)
        ? task.values.map((v) => Number(v))
        : [5, 3, 8, 1, 9, 2, 7];
    const n = values.length;
    let step = 0;

    if (n === 0) {
        yield {
            stepNumber: step,
            entities: makeBars([0], 0, -1),
            edges: [],
            description: "Empty array - there is nothing to sort.",
            codeLineNumber: 0,
            layout: "array",
            meta: { count: 0, sorted: [] },
        };
        return;
    }

    const left = new Array<number>(n).fill(-1);
    const right = new Array<number>(n).fill(-1);
    const parent = new Array<number>(n).fill(-1);

    yield {
        stepNumber: step,
        entities: makeBars(values, 0, -1),
        edges: [],
        description: `Sorting ${n} values by repeated minimum extraction from a Cartesian tree.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { count: 0, sorted: [] },
    };
    step += 1;

    let root = buildCartesian(values, left, right, parent);
    const display = [...values];
    const sorted: number[] = [];

    yield {
        stepNumber: step,
        entities: makeBars(values, 0, root),
        edges: [],
        description: `Cartesian tree built; the root holds the minimum ${values[root] as number}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { count: 0, rootValue: values[root] as number, sorted: [] },
    };
    step += 1;

    while (root !== -1) {
        const minValue = values[root] as number;
        const l = left[root] as number;
        const r = right[root] as number;
        if (l !== -1) parent[l] = -1;
        if (r !== -1) parent[r] = -1;
        const nextRoot = merge(l, r, values, left, right, parent);
        if (nextRoot !== -1) parent[nextRoot] = -1;

        sorted.push(minValue);
        const k = sorted.length - 1;
        display[k] = minValue;
        root = nextRoot;

        yield {
            stepNumber: step,
            entities: makeBars(display, sorted.length, root),
            edges: [],
            description: `Extracted ${minValue}; ${sorted.length} of ${n} values are now in place.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { count: sorted.length, sorted: [...sorted] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(display, n, -1),
        edges: [],
        description: `Done: ${n} values sorted from smallest to largest.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { count: n, sorted: [...sorted] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Cartesian tree is a binary tree whose inorder walk gives back the original array while every parent is smaller than its children. That makes the root the minimum of the whole array. Remove the root, stitch its two subtrees back together, and the next root is the next minimum, so repeating the removal writes out a sorted list.",
        invariants: [
            "Inorder traversal of the tree always visits the remaining elements in their original relative order.",
            "The min-heap property holds: every parent is no greater than either child.",
            "The sorted prefix written so far is nondecreasing and contains exactly the extracted minima.",
        ],
        correctness:
            "The stack build creates a tree satisfying both the inorder and min-heap properties. Merging two subtrees keeps the smaller root on top and recurses on the matching side, which preserves both properties, so the root after every deletion is the smallest remaining value. Extracting roots therefore produces the input in ascending order.",
        complexityRationale:
            "The stack build touches each element once, O(n). Each of the n deletions merges along a search path of expected length O(log n), giving O(n log n) expected time; the parent and child arrays use O(n) space.",
        uses: [
            "A teaching bridge between heaps and binary search trees",
            "Range-minimum query preprocessing via the Cartesian tree structure",
            "Treap priority ordering where the inorder sequence must be preserved",
        ],
        references: [
            "Vuillemin, A Unifying Look at Data Structures, 1980",
            "CLRS, 2nd edition, Problem 10-2 and Chapter 12 exercises",
        ],
        workedExample:
            "For [5, 3, 8, 1, 9, 2, 7] the Cartesian tree roots at value 1. Removing it merges its two subtrees and exposes 2, then 3, then 5, and so on, producing 1, 2, 3, 5, 7, 8, 9.",
    },
    id: "cartesian-tree-sort",
    name: "Cartesian Tree Sort",
    category: "sorting",
    complexity: { time: "O(n log n) expected", space: "O(n)" },
    defaultInput: { values: [5, 3, 8, 1, 9, 2, 7] },
    visualType: "array",
    run,
    pseudocode: [
        "build a min Cartesian tree over the input values",
        "use a monotonic stack so each parent is no larger than its children",
        "the tree root is the smallest remaining value",
        "while the tree is not empty",
        "output the root value and note its original position",
        "merge the root's left and right subtrees by priority",
        "reattach the merged root as the new tree root",
        "done: the output sequence is sorted ascending",
    ],
};

export default module;
