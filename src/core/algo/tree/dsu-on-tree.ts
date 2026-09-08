/**
 * dsu-on-tree.ts – DSU on tree (small-to-large subtree colors)
 * Counts distinct colors per subtree, merging small sets into big ones.
 * Time O(n log n), Space O(n). States: active=comparing, done=sorted.
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
function bedges(parent: Map<string, string | null>) {
    const out: VisualEdge[] = [];
    for (const [c, p] of parent)
        if (p)
            out.push({
                id: `edge-${p}-${c}`,
                sourceId: `node-${p}`,
                targetId: `node-${c}`,
                state: "idle",
                label: "",
                directed: false,
            });
    return out;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t =
        (input as {
            parentMap?: Record<string, string | null>;
            ids?: string[];
            colors?: Record<string, number>;
        } | null) ?? {};
    const pm = new Map<string, string | null>(
        Object.entries(t.parentMap ?? { B: "A", C: "A", D: "B" }),
    );
    const ids = t.ids ?? ["A", "B", "C", "D"];
    const colors: Record<string, number> = t.colors ?? { A: 1, B: 2, C: 1, D: 3 };
    let step = 0;
    const st = new Map<string, EntityState>();
    const frame = (d: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step,
        entities: build(pm, ids, st),
        edges: bedges(pm),
        description: d,
        codeLineNumber: line,
        layout: "tree",
        meta,
    });
    if (ids.length === 0) {
        yield frame("Empty tree – no colors to count.", 0, { distinct: [] });
        return;
    }
    const kids = new Map<string, string[]>();
    for (const id of ids) kids.set(id, []);
    for (const [c, p] of pm) if (p && kids.has(p)) kids.get(p)?.push(c);
    const roots = ids.filter((id) => !pm.get(id));
    const root = roots[0] ?? ids[0]!;
    const post: string[] = [];
    const dfs = (u: string): void => {
        for (const v of kids.get(u) ?? []) dfs(v);
        post.push(u);
    };
    dfs(root);
    const sets = new Map<string, Set<number>>();
    yield frame(
        `DSU on tree – postorder ${post.join(" → ")}; process small subtrees first.`,
        0,
        {},
    );
    step += 1;
    for (const u of post) {
        let big: Set<number> | null = null;
        let bigChild = "";
        for (const v of kids.get(u) ?? []) {
            const s = sets.get(v)!;
            if (!big || s.size > big.size) {
                big = s;
                bigChild = v;
            }
        }
        const cur = big ? new Set(big) : new Set<number>();
        cur.add(colors[u] ?? 0);
        for (const v of kids.get(u) ?? []) {
            if (v === bigChild) continue;
            for (const c of sets.get(v)!) cur.add(c);
        }
        sets.set(u, cur);
        st.set(u, "comparing");
        yield frame(
            `Node ${u} (color ${colors[u] ?? 0}) merges${bigChild ? ` keeping child ${bigChild}'s set` : " new set"} – distinct=${cur.size} {${[...cur].sort().join(",")}}`,
            2,
            { node: u, distinct: cur.size },
        );
        step += 1;
        st.set(u, "sorted");
    }
    for (const u of post) st.set(u, "sorted");
    const ans: Record<string, number> = {};
    for (const u of post) ans[u] = sets.get(u)!.size;
    yield frame(`Done – distinct colors: ${post.map((u) => `${u}=${ans[u]}`).join(", ")}.`, 4, {
        distinct: post.map((u) => `${u}=${ans[u]}`),
    });
}
const module: AlgorithmModule = {
    id: "dsu-on-tree",
    name: "DSU on Tree",
    category: "tree",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B" },
        ids: ["A", "B", "C", "D"],
        colors: { A: 1, B: 2, C: 1, D: 3 },
    },
    visualType: "tree",
    run,
};
export default module;
