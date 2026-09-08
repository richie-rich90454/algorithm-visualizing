/**
 * tree-maximum-matching-dp.ts – Maximum matching on a tree
 * dp0=u free, dp1=u matched to a child. Postorder max.
 * Time O(n), Space O(n). current=comparing, done=sorted.
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
        Object.entries(t.parentMap ?? { B: "A", C: "A", D: "B", E: "C" }),
    );
    const ids = t.ids ?? ["A", "B", "C", "D", "E"];
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
        yield frame("Empty tree – matching size is 0.", 0, { matching: 0 });
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
    yield frame(`Maximum matching – postorder ${post.join(" → ")}.`, 0, {});
    step += 1;
    const dp0 = new Map<string, number>();
    const dp1 = new Map<string, number>();
    for (const u of post) {
        const ch = kids.get(u) ?? [];
        const free = ch.reduce((s, v) => s + Math.max(dp0.get(v)!, dp1.get(v)!), 0);
        let take = ch.length > 0 ? -1 : 0;
        for (const v of ch) {
            const cand =
                1 +
                (dp0.get(v) ?? 0) +
                ch
                    .filter((w) => w !== v)
                    .reduce((s, w) => s + Math.max(dp0.get(w)!, dp1.get(w)!), 0);
            take = Math.max(take, cand);
        }
        dp0.set(u, free);
        dp1.set(u, take);
        st.set(u, "comparing");
        yield frame(
            `Node ${u}: free=${free}, matched-up=${take}. Best=${Math.max(free, take)}.`,
            2,
            { node: u, free, take },
        );
        step += 1;
        st.set(u, "sorted");
        if (step > 12) break;
    }
    const ans = Math.max(dp0.get(root)!, dp1.get(root)!);
    for (const id of ids) st.set(id, "sorted");
    yield frame(`Maximum matching size is ${ans}.`, 4, { matching: ans });
}
const module: AlgorithmModule = {
    id: "tree-maximum-matching-dp",
    name: "Tree Maximum Matching DP",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { parentMap: { B: "A", C: "A", D: "B", E: "C" }, ids: ["A", "B", "C", "D", "E"] },
    visualType: "tree",
    run,
};
export default module;
