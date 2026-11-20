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
    const queried = new Set<number>();
    while (idx > 0) {
        sum += tree[idx] ?? 0;
        queried.add(idx - 1);
        const states = new Map<number, EntityState>();
        for (const seen of queried) {
            states.set(seen, "comparing");
        }
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
    step += 1;

    // Point update (positions are 1-based; anything outside 1..n is a no-op
    // instead of looping forever on index 0).
    const [pos, delta] = update;
    idx = pos;
    const updated = new Set<number>();
    while (idx >= 1 && idx <= n) {
        tree[idx] = (tree[idx] ?? 0) + delta;
        updated.add(idx - 1);
        const states = new Map<number, EntityState>();
        for (const seen of updated) {
            states.set(seen, "sorted");
        }
        yield {
            stepNumber: step,
            entities: makeCells(tree.slice(1), states),
            edges: [],
            description: `Point update: added ${delta} to tree[${idx}].`,
            codeLineNumber: 6,
            layout: "grid",
            meta: { n },
        };
        step += 1;
        idx += idx & -idx;
    }
}

/** The Fenwick Tree module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A Fenwick tree, or binary indexed tree, stores partial sums so that prefix sums and point updates both take logarithmic time. Each index i holds the sum of a range whose length is the lowest set bit of i. Updates move upward with i += lowbit(i) and queries move downward with i -= lowbit(i).",
        "invariants": [
            "tree[i] sums the original array over the range (i - lowbit(i), i].",
            "lowbit(i) = i & -i is the largest power of two dividing i.",
            "A prefix sum up to i is the sum of tree entries on the downward lowbit path."
        ],
        "correctness": "Adding a delta to every tree index on the upward path updates exactly those partial sums that include position i. Summing tree indices on the downward path partitions [1, i] into disjoint ranges, so the result is the true prefix sum. Both paths have at most log n steps.",
        "complexityRationale": "Each update or query visits one node per set bit, at most O(log n) steps. The tree array is the same size as the input plus one, O(n) space.",
        "uses": [
            "Prefix-sum and frequency tables",
            "Competitive programming range queries",
            "Cumulative counters in online analytics"
        ],
        "references": [
            "Peter M. Fenwick, \"A New Data Structure for Cumulative Frequency Tables\", Software: Practice and Experience 1994",
            "Steven Halim, Competitive Programming 3, Fenwick tree chapter"
        ],
        "workedExample": "For array [2, 1, 3, 4, 5, 1], build tree so tree[4] holds indices 1-4 sum 10 and tree[6] holds 5-6 sum 6. Prefix sum to 5 is tree[4] + tree[5] = 10 + 5 = 15. Updating index 3 by +2 adds 2 to tree[3], tree[4], and tree[8]."
    },
    id: "fenwick-tree",
    name: "Fenwick Tree",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { array: [2, 1, 3, 4, 5, 1], update: [3, 2] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize BIT array of zeros with size n plus 1",
        "build tree by adding each value with i plus lowbit(i)",
        "compare running sum while stepping with lowbit",
        "query prefix sum by accumulating i minus lowbit(i)",
        "update point by propagating delta upward",
        "count steps as O(log n) per query and update",
        "done: BIT holds array with prefix sum answer",
    ],
};

export default module;
