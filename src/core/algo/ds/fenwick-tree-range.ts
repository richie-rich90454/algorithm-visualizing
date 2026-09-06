/**
 * fenwick-tree-range.ts – Fenwick Tree (range update, range query)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The basic Fenwick tree supports point updates and prefix sums. Using TWO
 * Fenwick trees, it can also support range updates and range queries: a range
 * add of x to [l, r] becomes two point updates in each tree, and a range sum
 * query [l, r] combines prefix sums from both trees.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Range update / range query: O(log n)
 *   Space:                      O(n) – two trees
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The two Fenwick trees are shown as two rows.
 *   - The cells touched by an update/query are YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Two trees instead of one" is the trick.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a two-row grid for the two Fenwick trees.
 *
 * @param tree1 The first Fenwick tree.
 * @param tree2 The second Fenwick tree.
 * @param states Optional `row,index` → state overrides.
 * @returns Cell entities with row/col metadata.
 */
function makeGrid(
    tree1: number[],
    tree2: number[],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    tree1.forEach((value, index) => {
        cells.push({
            id: `t1-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: states.get(`1,${index}`) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        });
    });
    tree2.forEach((value, index) => {
        cells.push({
            id: `t2-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: states.get(`2,${index}`) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: index },
        });
    });
    return cells;
}

/**
 * The Fenwick Tree (range) generator.
 *
 * @param input `{ n, update, query }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            n?: number;
            update?: [number, number, number];
            query?: [number, number];
        } | null) ?? {};
    const n = typeof task.n === "number" ? task.n : 6;
    const update = task.update ?? [2, 4, 3];
    const query = task.query ?? [1, 5];

    let step = 0;

    // Two Fenwick trees.
    const tree1 = new Array<number>(n + 1).fill(0);
    const tree2 = new Array<number>(n + 1).fill(0);

    const addTo = (tree: number[], idx: number, delta: number): void => {
        // Positions are 1-based; index 0 would never advance (0 & -0 === 0).
        while (idx >= 1 && idx <= n) {
            tree[idx] = (tree[idx] ?? 0) + delta;
            idx += idx & -idx;
        }
    };

    const rangeAdd = (l: number, r: number, x: number): void => {
        addTo(tree1, l, x);
        addTo(tree1, r + 1, -x);
        addTo(tree2, l, x * (l - 1));
        addTo(tree2, r + 1, -x * r);
    };

    const prefixSum = (idx: number): number => {
        let sum1 = 0;
        let sum2 = 0;
        let i = idx;
        while (i > 0) {
            sum1 += tree1[i] ?? 0;
            sum2 += tree2[i] ?? 0;
            i -= i & -i;
        }
        return sum1 * idx - sum2;
    };

    // Frame 0: both trees empty.
    yield {
        stepNumber: step,
        entities: makeGrid(tree1.slice(1), tree2.slice(1)),
        edges: [],
        description: "Two Fenwick trees for range updates and range queries.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;

    // Range update.
    const [l, r, x] = update;
    rangeAdd(l, r, x);
    yield {
        stepNumber: step,
        entities: makeGrid(tree1.slice(1), tree2.slice(1)),
        edges: [],
        description: `Range-updated: added ${x} to [${l}, ${r}].`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { n },
    };
    step += 1;

    // Range query.
    const [ql, qr] = query;
    const sum = prefixSum(qr) - prefixSum(ql - 1);
    yield {
        stepNumber: step,
        entities: makeGrid(tree1.slice(1), tree2.slice(1)),
        edges: [],
        description: `Range sum [${ql}, ${qr}] = ${sum}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { n, sum },
    };
}

/** The Fenwick Tree (range) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "fenwick-tree-range",
    name: "Fenwick Tree (Range)",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { n: 6, update: [2, 4, 3], query: [1, 5] },
    visualType: "grid",
    run,
};

export default module;
