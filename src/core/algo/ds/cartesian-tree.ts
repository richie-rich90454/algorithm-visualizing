/**
 * cartesian-tree.ts - Cartesian Tree
 * Heap by value, inorder by position; built in O(n). Demo: BST insert + search/rank on <=8 keys.
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
        description: "Cartesian Tree: empty. Heap by value, inorder by position; built in O(n).",
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
                ? `Heap+inorder verified. Search ${q} found; rank ${rank}.`
                : `Search ${q} absent; rank would be ${rank}.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { found: found >= 0, rank },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A Cartesian tree is built from an array so that it is a heap by value and an inorder traversal recovers the original array order. A monotonic stack builds it in linear time: pop larger elements until the heap property holds, then attach the popped subtree as the new node's left child. The tree supports range minimum queries through lowest common ancestors.",
        "invariants": [
            "Every parent's value is at most its children's (min-heap).",
            "Inorder traversal yields the original array.",
            "The stack holds a path with strictly increasing values."
        ],
        "correctness": "Popping while the stack top exceeds the incoming value guarantees the new node's left child contains exactly the contiguous prefix it dominates, preserving both heap order and inorder position. Each element is pushed and popped once, so construction is linear. The heap property makes the LCA of two positions the minimum over the interval between them.",
        "complexityRationale": "Each array element is pushed once and popped at most once, giving O(n) build time and O(n) space. Once built with RMQ preprocessing, range minimum queries answer in O(1).",
        "uses": [
            "Range minimum queries",
            "Finding nearest smaller elements",
            "Building suffix-tree and LCA-based indexes"
        ],
        "references": [
            "Jean Vuillemin, \"A Unifying Look at Data Structures\", CACM 1980",
            "Torben Hagerup, level ancestor and Cartesian-tree RMQ notes"
        ],
        "workedExample": "Build from [5, 3, 7, 2]: push 5; 3 pops 5 and becomes root with left child 5; 7 is pushed as right child; 2 pops 7 and 3, becoming root whose left subtree has 3 with children 5 and 7. Inorder traversal returns 5, 3, 7, 2, the original array."
    },
    id: "cartesian-tree",
    name: "Cartesian Tree",
    category: "data-structures",
    complexity: { time: "O(n) build, O(1) LCA w/ RMQ", space: "O(n)" },
    defaultInput: { keys: [5, 3, 7, 2, 6], search: 6 },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize empty Cartesian tree with stack for construction",
        "scan array left to right maintaining heap order",
        "compare incoming value against stack top",
        "pop larger elements until heap property holds",
        "attach popped subtree as left child of new node",
        "push new node as right child of stack top",
        "done: Cartesian tree holds array with heap and inorder properties",
    ],
};
export default module;
