/**
 * tree-partition-dp.ts – Partition tree into subtrees bounded by S
 * Postorder sums; cuts a child when its sum plus u exceeds S.
 * Time O(n), Space O(n). cut=highlight, kept=sorted.
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
    const t =
        (input as {
            parentMap?: Record<string, string | null>;
            ids?: string[];
            weight?: Record<string, number>;
            limit?: number;
        } | null) ?? {};
    const pm = new Map<string, string | null>(
        Object.entries(t.parentMap ?? { B: "A", C: "A", D: "B", E: "B" }),
    );
    const ids = t.ids ?? ["A", "B", "C", "D", "E"];
    const wt: Record<string, number> = t.weight ?? { A: 1, B: 2, C: 1, D: 1, E: 1 };
    const S = t.limit ?? 3;
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
        yield frame("Empty tree – 0 components.", 0, { components: 0 });
        return;
    }
    const kids = new Map<string, string[]>();
    for (const id of ids) kids.set(id, []);
    for (const [c, p] of pm) if (p && kids.has(p)) kids.get(p)?.push(c);
    const root = ids.find((id) => !pm.get(id)) ?? ids[0]!;
    const post: string[] = [];
    const dfs = (u: string): void => {
        for (const v of kids.get(u) ?? []) dfs(v);
        post.push(u);
    };
    dfs(root);
    yield frame(`Partition with component sum ≤ ${S} – postorder ${post.join(" → ")}.`, 0, {
        limit: S,
    });
    step += 1;
    const rem = new Map<string, number>();
    let cuts = 0;
    for (const u of post) {
        let s = wt[u] ?? 1;
        for (const v of kids.get(u) ?? []) {
            const r = rem.get(v)!;
            if (s + r <= S) s += r;
            else {
                cuts += 1;
                st.set(v, "highlight");
            }
        }
        rem.set(u, s);
        st.set(u, "comparing");
        yield frame(`Node ${u}: pending sum=${s}, cuts so far=${cuts}.`, 2, {
            node: u,
            sum: s,
            cuts,
        });
        step += 1;
        if (st.get(u) === "comparing") st.set(u, "sorted");
        if (step > 12) break;
    }
    const comps = cuts + 1;
    for (const id of ids) if (st.get(id) !== "highlight") st.set(id, "sorted");
    yield frame(
        `Partitioned into ${comps} components (limit ${S}, root remainder ${rem.get(root)}).`,
        4,
        { components: comps },
    );
}
const module: AlgorithmModule = {
    id: "tree-partition-dp",
    name: "Tree Partition DP",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B" },
        ids: ["A", "B", "C", "D", "E"],
        weight: { A: 1, B: 2, C: 1, D: 1, E: 1 },
        limit: 3,
    },
    visualType: "tree",
    run,
};
export default module;
