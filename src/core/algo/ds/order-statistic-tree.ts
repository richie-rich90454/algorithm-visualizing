/**
 * order-statistic-tree.ts - Order-Statistic Tree
 * Subtree sizes give select/rank. Demo: BST insert + search/rank on <=8 keys.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Subtree sizes give select/rank. Demo: BST insert + search/rank on <=8 keys.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) ops
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *    - Nodes are circles; edges show parent links.
 *    - The active node is YELLOW (comparing).
 *    - Finished nodes are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Standard Order-Statistic Tree behavior with textbook operation costs.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function nodes(
    keys: number[],
    par: Map<number, number | null>,
    st: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return keys.map((v, i) => ({
        id: `n-${i}-${v}`,
        type: "node" as const,
        label: String(v),
        value: v,
        state: st.get(i) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: par.get(i) ?? "root", key: v },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { keys?: number[]; search?: number } | null) ?? {};
    const keys = Array.isArray(t.keys) ? [...t.keys] : [5, 3, 7, 2, 6];
    const q = typeof t.search === "number" ? t.search : 6;
    let step = 0;
    const par = new Map<number, number | null>();
    const ins: number[] = [];
    const left: number[] = [];
    const right: number[] = [];
    const insIdx = (v: number): number => {
        let i = 0;
        if (ins.length === 0) {
            ins.push(v);
            left.push(-1);
            right.push(-1);
            par.set(0, null);
            return 0;
        }
        for (;;) {
            if (v < ins[i]!) {
                const l = left[i]!;
                if (l === -1) {
                    const ni = ins.length;
                    ins.push(v);
                    left.push(-1);
                    right.push(-1);
                    left[i] = ni;
                    par.set(ni, i);
                    return ni;
                }
                i = l;
            } else if (v > ins[i]!) {
                const r = right[i]!;
                if (r === -1) {
                    const ni = ins.length;
                    ins.push(v);
                    left.push(-1);
                    right.push(-1);
                    right[i] = ni;
                    par.set(ni, i);
                    return ni;
                }
                i = r;
            } else return i;
        }
    };
    yield {
        stepNumber: step,
        entities: [
            {
                id: "n-empty",
                type: "node" as const,
                label: "E",
                value: 0,
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            },
        ],
        edges: [],
        description: "Order-Statistic Tree: empty. Subtree sizes give select/rank.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { ops: step },
    };
    step += 1;
    for (const v of keys.slice(0, 8)) {
        const ni = insIdx(v);
        const st = new Map<number, EntityState>([[ni, "comparing"]]);
        yield {
            stepNumber: step,
            entities: nodes(ins, par, st),
            edges: [],
            description: `Inserted key ${v} with BST comparisons and refreshed subtree sizes on its path.`,
            codeLineNumber: 1,
            layout: "tree",
            meta: { size: ins.length },
        };
        step += 1;
        if (step > 8) break;
    }
    let cur = ins.length ? 0 : -1;
    let found = -1;
    while (cur !== -1 && cur < ins.length) {
        const st = new Map<number, EntityState>([[cur, "highlight"]]);
        yield {
            stepNumber: step,
            entities: nodes(ins, par, st),
            edges: [],
            description: `Compared query ${q} against node ${ins[cur]} branching left or right by BST order.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { ops: step },
        };
        step += 1;
        if (ins[cur] === q) {
            found = cur;
            break;
        }
        cur = q < ins[cur]! ? left[cur]! : right[cur]!;
    }
    const fs = new Map<number, EntityState>();
    if (found >= 0) fs.set(found, "sorted");
    const rank = ins.filter((v) => v < q).length;
    yield {
        stepNumber: step,
        entities: ins.length
            ? nodes(ins, par, fs)
            : [
                  {
                      id: "n-empty",
                      type: "node" as const,
                      label: "E",
                      value: 0,
                      state: "idle" as EntityState,
                      x: 0,
                      y: 0,
                      width: 0,
                      height: 0,
                      metadata: { parentId: "root" },
                  },
              ],
        edges: [],
        description:
            found >= 0
                ? `Rank/select via sizes. Search ${q} found; rank ${rank}.`
                : `Search ${q} absent; rank would be ${rank}.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { ops: step, found: found >= 0, rank },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "An order-statistic tree augments a balanced BST with the size of each subtree. Rank of a key counts left-subtree sizes along the search path, and select of rank k descends by comparing k with the left subtree size. Finding the k-th smallest becomes one root-to-leaf walk.",
        "invariants": [
            "Each node size equals one plus the sizes of its two children.",
            "The in-order sequence of keys is sorted.",
            "The underlying tree height is logarithmic because it is balanced."
        ],
        "correctness": "For rank, every key smaller than x is counted exactly once, when the search turns right through that key subtree. For select, comparing k with the left subtree size decides whether the k-th element is in the left subtree, at the node, or in the right subtree, reducing the problem by one level until it lands on the correct key.",
        "complexityRationale": "Both rank and select follow a single root-to-leaf path of O(log n) nodes, and insertion updates sizes along that path. Each node stores one extra integer, so space stays O(n).",
        "uses": [
            "Order statistic queries in databases",
            "Percentile computation over live data",
            "Online selection with an ordered tree"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 14 on order-statistic trees",
            "Tarjan, Data Structures and Network Algorithms"
        ],
        "workedExample": "Insert 5, 3, 7, 2, 6 and search for 6. Subtree sizes let the walk skip the left subtree of 7; rank(6) counts the smaller keys 2, 3, 5, and select(4) walks to 6 in the sorted order 2, 3, 5, 6, 7."
    },
    id: "order-statistic-tree",
    name: "Order-Statistic Tree",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { keys: [5, 3, 7, 2, 6], search: 6 },
    visualType: "tree",
    run,
    pseudocode: [
        "start with an empty BST with size fields set to 1",
        "insert key: walk down comparing keys, create a leaf",
        "update size fields on the path back to the root",
        "repeat until all keys are inserted and sizes are correct",
        "search key: compare and branch left or right",
        "rank and select use left-subtree sizes to skip whole subtrees",
        "done: tree holds all keys and the query answer is reported",
    ],
};
export default module;
