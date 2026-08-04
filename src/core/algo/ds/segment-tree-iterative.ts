/**
 * segment-tree-iterative.ts – Segment Tree (iterative, power-of-two layout)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The iterative segment tree avoids recursion by padding the array to the next
 * power of two and storing the tree in a flat array where node i's children
 * are 2i and 2i+1. Range queries combine nodes by walking two pointers from
 * the leaves upward, giving the same O(log n) behavior without a call stack.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Build:   O(n)
 *   Query:   O(log n)
 *   Update:  O(log n)
 *   Space:   O(2·2^⌈log n⌉)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The flat array is shown as cells.
 *   - The nodes touched by a query are YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The power-of-two padding and flat indexing are the ideas.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cells for the flat tree array.
 *
 * @param tree The flat segment tree.
 * @param states Optional index → state overrides.
 * @returns Cell entities in a single row.
 */
function makeCells(tree: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return tree.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Segment Tree (iterative) generator.
 *
 * @param input `{ array, query }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[]; query?: [number, number] } | null) ?? {};
    const array = task.array ?? [2, 1, 3, 4, 5];
    const [ql, qr] = task.query ?? [1, 3];

    let step = 0;
    const n = array.length;
    let size = 1;
    while (size < n) {
        size *= 2;
    }

    // Flat tree: leaves at [size, size + n), internal nodes above.
    const tree = new Array<number>(2 * size).fill(0);
    for (let i = 0; i < n; i += 1) {
        tree[size + i] = array[i] ?? 0;
    }
    for (let i = size - 1; i >= 1; i -= 1) {
        tree[i] = (tree[2 * i] ?? 0) + (tree[2 * i + 1] ?? 0);
    }

    // Frame 0: the flat tree (index 1 is the root).
    yield {
        stepNumber: step,
        entities: makeCells(tree.slice(1)),
        edges: [],
        description: `Iterative segment tree (power-of-two size ${size}) – query [${ql}, ${qr}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { size },
    };
    step += 1;

    // Iterative range sum query.
    let l = ql + size;
    let r = qr + size;
    const touched = new Set<number>();
    let sum = 0;
    while (l <= r) {
        if (l % 2 === 1) {
            sum += tree[l] ?? 0;
            touched.add(l - 1);
            l += 1;
        }
        if (r % 2 === 0) {
            sum += tree[r] ?? 0;
            touched.add(r - 1);
            r -= 1;
        }
        l = Math.floor(l / 2);
        r = Math.floor(r / 2);
    }

    const states = new Map<number, EntityState>();
    for (const idx of touched) {
        states.set(idx, "comparing");
    }
    yield {
        stepNumber: step,
        entities: makeCells(tree.slice(1), states),
        edges: [],
        description: `Range [${ql}, ${qr}] sum = ${sum} using the flat tree.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { size, sum },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(tree.slice(1)),
        edges: [],
        description: `Iterative query complete in O(log n) with no recursion.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { size, sum },
    };
}

/** The Segment Tree (iterative) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "segment-tree-iterative",
    name: "Segment Tree (Iterative)",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { array: [2, 1, 3, 4, 5], query: [1, 3] },
    visualType: "grid",
    run,
};

export default module;
