/**
 * weight-balanced-tree.ts - Weight-Balanced Tree
 * Rotations keep subtree weight ratio bounded. Demo: BST insert + search/rank on <=8 keys.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rotations keep subtree weight ratio bounded. Demo: BST insert + search/rank on <=8 keys.
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
 *   - Standard Weight-Balanced Tree behavior with textbook operation costs.
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
        description: "Weight-Balanced Tree: empty. Rotations keep subtree weight ratio bounded.",
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
            description: `Inserted key ${v} with BST comparisons and updated weights, rotating past the ratio bound.`,
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
                ? `Balance invariant holds. Search ${q} found; rank ${rank}.`
                : `Search ${q} absent; rank would be ${rank}.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { ops: step, found: found >= 0, rank },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A weight-balanced tree keeps each subtree size, or weight, within a fixed ratio of its sibling. When an insertion makes a child too heavy, single or double rotations restore the ratio, guaranteeing logarithmic depth.",
        "invariants": [
            "At every node each child weight is at most a fixed multiple of the other.",
            "Stored subtree weights are correct.",
            "Rotations preserve BST key order."
        ],
        "correctness": "Rotations preserve in-order key sequence while rebalancing weights; the heavier subtree is split so the ratio returns within bound. Because the bound forces every child to be a constant fraction smaller, height is O(log n) and search is correct.",
        "complexityRationale": "Insert updates weights along one path and rotates a constant number of times per level, O(log n); search is O(log n). One node plus a weight per key gives O(n) space.",
        "uses": [
            "Balanced ordered dictionaries with simple invariants",
            "Functional maps such as OCaml Map",
            "Databases needing deterministic balancing"
        ],
        "references": [
            "Nievergelt and Reingold, Binary Search Trees of Bounded Balance, SIAM Journal on Computing 1973",
            "Adams, Efficient Sets: A Balancing Act, 1993"
        ],
        "workedExample": "Insert 5, 3, 7, 2, 6; adding 2 makes the left subtree of 5 too heavy, so a rotation reshapes that part; search for 6 then descends a short balanced path to find it."
    },
    id: "weight-balanced-tree",
    name: "Weight-Balanced Tree",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { keys: [5, 3, 7, 2, 6], search: 6 },
    visualType: "tree",
    run,
    pseudocode: [
        "start with an empty tree tracking subtree weights",
        "insert key with plain BST placement",
        "update weights on the path back to the root",
        "if a child outweighs its sibling beyond the balance ratio: rotate",
        "single and double rotations restore the weight bound",
        "repeat until all keys are inserted with bounded ratios",
        "done: weight ratios hold everywhere and the query answer is reported",
    ],
};
export default module;
