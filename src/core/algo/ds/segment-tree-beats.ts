/**
 * segment-tree-beats.ts - Segment Tree Beats (Range Chmax)
 *
 * Segment Tree Beats supports range maximum updates and range sum queries in
 * logarithmic time. Each node stores its minimum, its strict second minimum,
 * how many positions attain the minimum, and the segment sum. A range chmax
 * can be applied wholesale to a node when the new value falls below the
 * second minimum; only when it would swallow the second minimum do we descend
 * to the children. This amortizes repeated clamped updates efficiently.
 *
 * Time:  O(log n) amortized per update or query
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface BeatsTree {
    n: number;
    values: number[];
    min: number[];
    secondMin: number[];
    countMin: number[];
    sum: number[];
    lazy: number[];
}

export interface BeatsOp {
    op: "chmax" | "sum";
    l: number;
    r: number;
    x?: number;
}

/** Build the Beats tree from an array of values. */
export function createBeats(values: number[]): BeatsTree {
    const n = values.length;
    const size = Math.max(1, 4 * n);
    const tree: BeatsTree = {
        n,
        values: [...values],
        min: new Array<number>(size).fill(Infinity),
        secondMin: new Array<number>(size).fill(Infinity),
        countMin: new Array<number>(size).fill(0),
        sum: new Array<number>(size).fill(0),
        lazy: new Array<number>(size).fill(Infinity),
    };
    const build = (idx: number, l: number, r: number): void => {
        if (l === r) {
            const value = values[l] ?? 0;
            tree.min[idx] = value;
            tree.secondMin[idx] = Infinity;
            tree.countMin[idx] = 1;
            tree.sum[idx] = value;
            return;
        }
        const mid = Math.floor((l + r) / 2);
        build(idx * 2, l, mid);
        build(idx * 2 + 1, mid + 1, r);
        pull(tree, idx);
    };
    if (n > 0) {
        build(1, 0, n - 1);
    }
    return tree;
}

function pull(tree: BeatsTree, idx: number): void {
    const left = idx * 2;
    const right = left + 1;
    tree.lazy[idx] = Infinity;
    const leftMin = tree.min[left] ?? Infinity;
    const rightMin = tree.min[right] ?? Infinity;
    tree.sum[idx] = (tree.sum[left] ?? 0) + (tree.sum[right] ?? 0);
    if (leftMin === rightMin) {
        tree.min[idx] = leftMin;
        tree.secondMin[idx] = Math.min(tree.secondMin[left] ?? Infinity, tree.secondMin[right] ?? Infinity);
        tree.countMin[idx] = (tree.countMin[left] ?? 0) + (tree.countMin[right] ?? 0);
    } else if (leftMin < rightMin) {
        tree.min[idx] = leftMin;
        tree.secondMin[idx] = Math.min(tree.secondMin[left] ?? Infinity, rightMin);
        tree.countMin[idx] = tree.countMin[left] ?? 0;
    } else {
        tree.min[idx] = rightMin;
        tree.secondMin[idx] = Math.min(leftMin, tree.secondMin[right] ?? Infinity);
        tree.countMin[idx] = tree.countMin[right] ?? 0;
    }
}

/** Raise the minimum of a whole subtree to x without descending. */
function applyChmax(tree: BeatsTree, idx: number, x: number): void {
    const currentMin = tree.min[idx] ?? Infinity;
    if (x <= currentMin) {
        return;
    }
    tree.sum[idx] = (tree.sum[idx] ?? 0) + (x - currentMin) * (tree.countMin[idx] ?? 0);
    tree.min[idx] = x;
    tree.lazy[idx] = x;
}

function push(tree: BeatsTree, idx: number): void {
    const pending = tree.lazy[idx] ?? Infinity;
    if (pending === Infinity) {
        return;
    }
    applyChmax(tree, idx * 2, pending);
    applyChmax(tree, idx * 2 + 1, pending);
    tree.lazy[idx] = Infinity;
}

/** Raise the whole subtree at idx to at least x, descending only when needed. */
function updateNode(tree: BeatsTree, idx: number, x: number): void {
    const currentMin = tree.min[idx] ?? Infinity;
    if (x <= currentMin) {
        return;
    }
    const second = tree.secondMin[idx] ?? Infinity;
    if (x < second || second === Infinity) {
        applyChmax(tree, idx, x);
        return;
    }
    push(tree, idx);
    updateNode(tree, idx * 2, x);
    updateNode(tree, idx * 2 + 1, x);
    pull(tree, idx);
}

/** Raise every value in the inclusive range to at least x. */
export function beatsChmax(tree: BeatsTree, l: number, r: number, x: number): void {
    if (tree.n === 0) {
        return;
    }
    const lo = Math.max(0, l);
    const hi = Math.min(tree.n - 1, r);
    if (lo > hi) {
        return;
    }
    const update = (idx: number, left: number, right: number): void => {
        if (hi < left || right < lo) {
            return;
        }
        if (lo <= left && right <= hi) {
            updateNode(tree, idx, x);
            return;
        }
        push(tree, idx);
        const mid = Math.floor((left + right) / 2);
        update(idx * 2, left, mid);
        update(idx * 2 + 1, mid + 1, right);
        pull(tree, idx);
    };
    update(1, 0, tree.n - 1);
    for (let i = lo; i <= hi; i += 1) {
        tree.values[i] = Math.max(tree.values[i] ?? 0, x);
    }
}

/** Sum the values in the inclusive range. */
export function beatsSum(tree: BeatsTree, l: number, r: number): number {
    if (tree.n === 0) {
        return 0;
    }
    const lo = Math.max(0, l);
    const hi = Math.min(tree.n - 1, r);
    if (lo > hi) {
        return 0;
    }
    const query = (idx: number, left: number, right: number): number => {
        if (hi < left || right < lo) {
            return 0;
        }
        if (lo <= left && right <= hi) {
            return tree.sum[idx] ?? 0;
        }
        push(tree, idx);
        const mid = Math.floor((left + right) / 2);
        return query(idx * 2, left, mid) + query(idx * 2 + 1, mid + 1, right);
    };
    return query(1, 0, tree.n - 1);
}

function makeBars(tree: BeatsTree, activeLo: number, activeHi: number, phase: number): VisualEntity[] {
    return tree.values.map((value, index) => {
        const inRange = index >= activeLo && index <= activeHi && activeLo >= 0;
        const state: EntityState =
            phase >= 2 ? "sorted" : inRange ? (phase === 1 ? "active" : "comparing") : "idle";
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
            metadata: { index, value, min: tree.min[1] ?? 0 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { values?: number[]; ops?: BeatsOp[] } | null
    ) ?? {};
    const values = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map((value) => Math.trunc(value))
        : [3, 1, 4, 1, 5, 9, 2, 6];
    const ops = Array.isArray(task.ops)
        ? task.ops.map((entry) => ({
              op: entry.op === "sum" ? "sum" : "chmax",
              l: Math.trunc(entry.l),
              r: Math.trunc(entry.r),
              x: typeof entry.x === "number" ? entry.x : 0,
          }))
        : [
              { op: "chmax" as const, l: 0, r: 3, x: 4 },
              { op: "sum" as const, l: 0, r: 7, x: 0 },
              { op: "chmax" as const, l: 4, r: 7, x: 7 },
              { op: "sum" as const, l: 0, r: 7, x: 0 },
              { op: "sum" as const, l: 2, r: 5, x: 0 },
          ];
    const tree = createBeats(values);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(tree, -1, -1, 0),
        edges: [],
        description: `Built a Beats tree over ${values.length} values; root minimum is ${tree.min[1]}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { count: values.length, phase: "init", values: [...tree.values], sum: beatsSum(tree, 0, values.length - 1) },
    };
    step += 1;

    for (const entry of ops) {
        if (entry.op === "chmax") {
            beatsChmax(tree, entry.l, entry.r, entry.x);
            yield {
                stepNumber: step,
                entities: makeBars(tree, entry.l, entry.r, 1),
                edges: [],
                description: `Raised positions ${entry.l} through ${entry.r} to at least ${entry.x}; root minimum is now ${tree.min[1]}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: {
                    count: values.length,
                    phase: "chmax",
                    l: entry.l,
                    r: entry.r,
                    x: entry.x,
                    values: [...tree.values],
                    sum: beatsSum(tree, 0, values.length - 1),
                },
            };
        } else {
            const result = beatsSum(tree, entry.l, entry.r);
            yield {
                stepNumber: step,
                entities: makeBars(tree, entry.l, entry.r, 2),
                edges: [],
                description: `Range sum over ${entry.l} through ${entry.r} is ${result}.`,
                codeLineNumber: 4,
                layout: "array",
                meta: {
                    count: values.length,
                    phase: "sum",
                    l: entry.l,
                    r: entry.r,
                    sum: result,
                    values: [...tree.values],
                },
            };
        }
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(tree, -1, -1, 2),
        edges: [],
        description: `All ${ops.length} operation(s) complete; final values are ${tree.values.join(", ")}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            count: values.length,
            phase: "done",
            values: [...tree.values],
            sum: beatsSum(tree, 0, values.length - 1),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A normal segment tree can sum a range quickly but cannot change a range cheaply. Beats adds one extra idea: if the smallest value in a segment is the only value that matters, raising that minimum by a fixed amount changes the segment sum by that amount times the number of minima. You only need to recurse when an update would also change the second smallest value.",
        invariants: [
            "Each node's min is the smallest value in its segment and countMin is how many positions attain it.",
            "secondMin is strictly larger than min, or positive infinity when all values in the segment are equal.",
            "The node sum equals the sum of all original values plus every clamped increase applied to it.",
        ],
        correctness:
            "When an update value is at least the second minimum, only positions at the current minimum change, so adding the difference times countMin to the sum and raising min gives exactly the same segment as updating each element. When the value reaches the second minimum, the algorithm pushes the pending update to the children and recurses, then recomputes the parent from its children. Induction on the recursion shows every fully covered segment is updated correctly and no other position changes.",
        complexityRationale:
            "A wholesale update touches one node, while descending happens only when a distinct second minimum is crossed; the standard Beats amortization bounds total descents by O(n log n) over a sequence, so an update costs O(log n) amortized. A range sum follows the same logarithmic decomposition. The tree stores arrays of size four n, so space is O(n).",
        uses: [
            "Range clamp and range sum workloads in competitive programming",
            "Maintaining aggregates under threshold updates",
            "Teaching lazy propagation beyond simple range addition",
        ],
        references: [
            "Jiang, Segment Tree Beats, Chinese OI literature, 2015",
            "CLRS, Introduction to Algorithms, Chapter 14: Augmenting Data Structures",
        ],
        workedExample:
            "For values three, one, four, one, five, nine, two, six, raising positions zero through three to at least four changes only the two ones, adding six to the segment sum. The root minimum becomes two. A subsequent sum query over the whole array reads the root sum directly.",
    },
    id: "segment-tree-beats",
    name: "Segment Tree Beats",
    category: "data-structures",
    complexity: { time: "O(log n) amortized", space: "O(n)" },
    defaultInput: {
        values: [3, 1, 4, 1, 5, 9, 2, 6],
        ops: [
            { op: "chmax", l: 0, r: 3, x: 4 },
            { op: "sum", l: 0, r: 7, x: 0 },
            { op: "chmax", l: 4, r: 7, x: 7 },
            { op: "sum", l: 0, r: 7, x: 0 },
            { op: "sum", l: 2, r: 5, x: 0 },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "store per node the minimum, second minimum, min count, and sum",
        "build children and pull their aggregates into the parent",
        "for a range chmax visit nodes overlapping the range",
        "when x is above the second minimum raise only the minima",
        "otherwise push the pending update to lagging children",
        "recurse into children and pull their aggregates back up",
        "for a range sum return fully covered node sums",
        "add the partial child results for an overlapping range",
        "report the final values and totals after all operations",
    ],
};

export default module;
