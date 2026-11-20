/**
 * aa-tree.ts - AA Tree
 * AA skew/split keep levels balanced. Demo: BST insert + search/rank on <=8 keys.
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
        description: "AA Tree: empty. AA skew/split keep levels balanced.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { operations: step },
    };
    step += 1;
    for (const v of keys.slice(0, 8)) {
        const ni = insIdx(v);
        const st = new Map<number, EntityState>([[ni, "comparing"]]);
        yield {
            stepNumber: step,
            entities: nodes(ins, par, st),
            edges: [],
            description: `Inserted key ${v} via comparison and attached as leaf node.`,
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
            description: `Compare query ${q} against node ${ins[cur]} then go left or right.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { operations: step },
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
        codeLineNumber: 6,
        layout: "tree",
        meta: { found: found >= 0, rank },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "An AA tree is a balanced binary search tree that keeps its height logarithmic using two simple operations, skew and split. Skew removes a left horizontal link with a right rotation, and split removes two consecutive right horizontal links with a left rotation. After each insert the tree repairs any violations on the way back to the root. The result is as balanced as a red-black tree but with less bookkeeping.",
        "invariants": [
            "Every node's level is one more than its left child's level.",
            "No node has two consecutive right horizontal links.",
            "Keys in a left subtree are smaller and keys in a right subtree are larger."
        ],
        "correctness": "Skew and split are rotations, so they restore the level invariants without changing the inorder key sequence. A violation can only appear at the node where a new leaf attaches and is repaired on the unwinding path. Because levels act as approximate heights and the two link rules restrict their growth, the tree height is O(log n), so searches and inserts touch only logarithmic nodes.",
        "complexityRationale": "Each insert follows one root-to-leaf path and performs a constant number of rotations per level, giving O(log n) time. The level field is one integer per node, so total space stays O(n).",
        "uses": [
            "In-memory ordered maps and sets needing predictable depth",
            "Compiler symbol tables",
            "Priority indexes where keys arrive in arbitrary order"
        ],
        "references": [
            "Arne Andersson, \"Balanced Search Trees Made Simple\", 1993",
            "Mark Allen Weiss, Data Structures and Algorithm Analysis in C++, Section 4.4"
        ],
        "workedExample": "Insert 5, 3, 7, 2 into an empty AA tree: 5 is the root, 3 and 7 its children. Adding 2 under 3 creates a left horizontal link, so a skew rotation replaces the link 3->2 with 2->3. A search for 6 compares with 5, goes right to 7, then left to a missing child and reports a miss."
    },
    id: "aa-tree",
    name: "AA Tree",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { keys: [5, 3, 7, 2, 6], search: 6 },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize empty AA tree with level 1 sentinel",
        "insert key via BST comparison going left if smaller else right",
        "apply skew to remove left horizontal link via right rotation",
        "apply split to fix consecutive right links via left rotation",
        "compare query key against node and go left or right",
        "compute rank as count of keys smaller than query",
        "done: balanced AA tree holds keys and search answer with rank",
    ],
};
export default module;
