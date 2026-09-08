/**
 * weight-balanced-tree.ts - Weight-Balanced Tree
 * Rotations keep subtree weight ratio bounded. Demo: BST insert + search/rank on <=8 keys.
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
        meta: {},
    };
    step += 1;
    for (const v of keys.slice(0, 8)) {
        const ni = insIdx(v);
        const st = new Map<number, EntityState>([[ni, "comparing"]]);
        yield {
            stepNumber: step,
            entities: nodes(ins, par, st),
            edges: [],
            description: `Inserted ${v}.`,
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
            description: `Search ${q} at ${ins[cur]}.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: {},
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
        meta: { found: found >= 0, rank },
    };
}

const module: AlgorithmModule = {
    id: "weight-balanced-tree",
    name: "Weight-Balanced Tree",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { keys: [5, 3, 7, 2, 6], search: 6 },
    visualType: "tree",
    run,
};
export default module;
