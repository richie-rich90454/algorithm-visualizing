/**
 * fenwick-tree.ts – Fenwick Tree (Binary Indexed Tree)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Fenwick tree supports point updates and prefix-sum queries on an array in
 * O(log n). Each index i stores the sum of a range ending at i whose length is
 * the lowest set bit of i (i & -i). Updates propagate upward through `i += i &
 * -i`; queries accumulate downward through `i -= i & -i`.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Point update / prefix sum: O(log n)
 *   Space:                     O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The tree array is shown as cells.
 *   - The cells updated / summed are YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The lowbit (`i & -i`) structure is the entire concept.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cells for the tree array.
 *
 * @param tree The Fenwick tree.
 * @param states Optional index → state overrides.
 * @returns Cell entities in a single row (index 1..n).
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
 * The Fenwick Tree generator.
 *
 * @param input `{ array, update }` – the array and an update to apply.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[]; update?: [number, number] } | null) ?? {};
    const array = task.array ?? [2, 1, 3, 4, 5, 1];
    const update = task.update ?? [3, 2];

    const n = array.length;
    let step = 0;

    // Build the Fenwick tree.
    const tree = new Array<number>(n + 1).fill(0);
    for (let i = 0; i < n; i += 1) {
        const value = array[i] ?? 0;
        let idx = i + 1;
        while (idx <= n) {
            tree[idx] = (tree[idx] ?? 0) + value;
            idx += idx & -idx;
        }
    }

    // Frame 0: the built tree.
    yield {
        stepNumber: step,
        entities: makeCells(tree.slice(1)),
        edges: [],
        description: `Fenwick tree built from [${array.join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;

    // Prefix sum query up to index k.
    const k = 4;
    let sum = 0;
    let idx = k;
    while (idx > 0) {
        sum += tree[idx] ?? 0;
        const states = new Map<number, EntityState>([[idx - 1, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(tree.slice(1), states),
            edges: [],
            description: `Prefix sum up to ${k}: adding tree[${idx}] = ${tree[idx]} (running ${sum}).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n, sum },
        };
        step += 1;
        idx -= idx & -idx;
    }

    yield {
        stepNumber: step,
        entities: makeCells(tree.slice(1)),
        edges: [],
        description: `Prefix sum of first ${k} elements = ${sum}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { n, sum },
    };

    // Point update.
    const [pos, delta] = update;
    idx = pos;
    while (idx <= n) {
        tree[idx] = (tree[idx] ?? 0) + delta;
        const states = new Map<number, EntityState>([[idx - 1, "sorted"]]);
        yield {
            stepNumber: step,
            entities: makeCells(tree.slice(1), states),
            edges: [],
            description: `Point update: added ${delta} to tree[${idx}].`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { n },
        };
        step += 1;
        idx += idx & -idx;
    }
}

/** The Fenwick Tree module, registered with the engine. */
const module: AlgorithmModule = {
    id: "fenwick-tree",
    name: "Fenwick Tree",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { array: [2, 1, 3, 4, 5, 1], update: [3, 2] },
    visualType: "grid",
    run,
};

export default module;
