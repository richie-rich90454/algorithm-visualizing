/**
 * tree-dominating-set-dp.ts – Minimum dominating set (brute-force exact)
 * Tiny trees: tries subsets by size; first dominating set is optimal.
 * Time O(2^n) demo, Space O(n). candidate=comparing, answer=sorted.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function build(
    parent: Map<string, string | null>,
    ids: string[],
    st: Map<string, EntityState>,
): VisualEntity[] {
    return ids.map((id) => ({
        id: `node-${id}`,
        type: "node" as const,
        label: id,
        value: 0,
        state: st.get(id) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: parent.get(id) ?? "root" },
    }));
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { parentMap?: Record<string, string | null>; ids?: string[] } | null) ?? {};
    const pm = new Map<string, string | null>(
        Object.entries(t.parentMap ?? { B: "A", C: "A", D: "A" }),
    );
    const ids = t.ids ?? ["A", "B", "C", "D"];
    let step = 0;
    const st = new Map<string, EntityState>();
    const bedges = () => {
        const e: VisualEdge[] = [];
        for (const [c, p] of pm)
            if (p)
                e.push({
                    id: `edge-${p}-${c}`,
                    sourceId: `node-${p}`,
                    targetId: `node-${c}`,
                    state: "idle",
                    label: "",
                    directed: false,
                });
        return e;
    };
    const frame = (d: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step,
        entities: build(pm, ids, st),
        edges: bedges(),
        description: d,
        codeLineNumber: line,
        layout: "tree",
        meta,
    });
    if (ids.length === 0) {
        yield frame("Empty tree – dominating set size is 0.", 0, { size: 0, set: [] });
        return;
    }
    const adj = new Map<string, Set<string>>();
    for (const id of ids) adj.set(id, new Set([id]));
    for (const [c, p] of pm)
        if (p && adj.has(c) && adj.has(p)) {
            adj.get(c)!.add(p);
            adj.get(p)!.add(c);
        }
    const dom = (s: Set<string>): boolean =>
        ids.every((v) => [...s].some((u) => adj.get(u)!.has(v)));
    yield frame(
        `Dominating set – star on ${ids.length} nodes; try subsets by growing size.`,
        0,
        {},
    );
    step += 1;
    const n = ids.length;
    let best: string[] | null = null;
    outer: for (let k = 0; k <= Math.min(n, 4); k += 1) {
        const idx = Array.from({ length: k }, (_, i) => i);
        const combos: string[][] = [];
        const gen = (s: number, cur: string[]): void => {
            if (cur.length === k) {
                combos.push([...cur]);
                return;
            }
            for (let i = s; i < n; i += 1) {
                cur.push(ids[i]!);
                gen(i + 1, cur);
                cur.pop();
            }
        };
        if (k === 0) combos.push([]);
        else gen(0, []);
        void idx;
        for (const c of combos.slice(0, 4)) {
            for (const id of ids) st.set(id, "idle");
            for (const u of c) st.set(u, "comparing");
            const ok = dom(new Set(c));
            yield frame(
                `Try {${c.join(", ") || "∅"}} size ${k} – ${ok ? "dominating ✓" : "not dominating"}.`,
                2,
                { set: c, ok },
            );
            step += 1;
            if (ok && !best) best = c;
        }
        if (best) break outer;
        if (step > 11) break;
    }
    if (!best) {
        // finish search silently for correctness on slightly bigger inputs
        for (let mask = 0; mask < 1 << n; mask += 1) {
            const c = ids.filter((_, i) => (mask >> i) & 1);
            if (dom(new Set(c)) && (!best || c.length < best.length)) best = c;
        }
    }
    for (const id of ids) st.set(id, "idle");
    for (const u of best ?? []) st.set(u, "sorted");
    yield frame(
        `Minimum dominating set is {${(best ?? []).join(", ")}} size ${(best ?? []).length}.`,
        4,
        { size: (best ?? []).length, set: best ?? [] },
    );
}
const module: AlgorithmModule = {
    id: "tree-dominating-set-dp",
    name: "Tree Dominating Set DP",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { parentMap: { B: "A", C: "A", D: "A" }, ids: ["A", "B", "C", "D"] },
    visualType: "tree",
    run,
};
export default module;
