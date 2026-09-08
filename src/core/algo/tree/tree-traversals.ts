/**
 * tree-traversals.ts – Preorder, inorder-style, postorder, level order
 * One tiny binary tree; each order visits every node exactly once.
 * Time O(n), Space O(n). current=comparing, visited=sorted.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { parentMap?: Record<string, string | null>; ids?: string[] } | null) ?? {};
    const pm = new Map<string, string | null>(
        Object.entries(t.parentMap ?? { B: "A", C: "A", D: "B", E: "B" }),
    );
    const ids = t.ids ?? ["A", "B", "C", "D", "E"];
    let step = 0;
    const st = new Map<string, EntityState>();
    const snap = (): VisualEntity[] =>
        ids.map((id) => ({
            id: `node-${id}`,
            type: "node" as const,
            label: id,
            value: 0,
            state: st.get(id) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: pm.get(id) ?? "root" },
        }));
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
        entities: snap(),
        edges: bedges(),
        description: d,
        codeLineNumber: line,
        layout: "tree",
        meta,
    });
    if (ids.length === 0) {
        yield frame("Empty tree – all orders are [].", 0, {
            preorder: [],
            postorder: [],
            level: [],
        });
        return;
    }
    const kids = new Map<string, string[]>();
    for (const id of ids) kids.set(id, []);
    for (const [c, p] of pm) if (p && kids.has(p)) kids.get(p)?.push(c);
    for (const k of kids.values()) k.sort();
    const root = ids.find((id) => !pm.get(id)) ?? ids[0]!;
    yield frame(`Traversals of tree rooted at ${root}.`, 0, {});
    step += 1;
    const pre: string[] = [];
    const post: string[] = [];
    const dfs = (u: string): void => {
        pre.push(u);
        for (const v of kids.get(u) ?? []) dfs(v);
        post.push(u);
    };
    dfs(root);
    for (const u of pre) {
        for (const id of ids) st.set(id, "idle");
        for (const v of pre.slice(0, pre.indexOf(u) + 1))
            st.set(v, v === u ? "comparing" : "sorted");
        yield frame(`Preorder visit ${u} – [${pre.slice(0, pre.indexOf(u) + 1).join(",")}].`, 1, {
            preorder: pre.slice(0, pre.indexOf(u) + 1),
        });
        step += 1;
        if (step > 6) break;
    }
    for (const id of ids) st.set(id, "idle");
    yield frame(`Preorder done [${pre.join(",")}]; postorder [${post.join(",")}].`, 2, {
        preorder: pre,
        postorder: post,
    });
    step += 1;
    const level: string[] = [];
    const q: string[] = [root];
    while (q.length > 0) {
        const u = q.shift()!;
        level.push(u);
        q.push(...(kids.get(u) ?? []));
    }
    for (const id of ids) st.set(id, "sorted");
    yield frame(`Level order [${level.join(",")}]; all ${ids.length} nodes visited.`, 3, {
        preorder: pre,
        postorder: post,
        level,
    });
}
const module: AlgorithmModule = {
    id: "tree-traversals",
    name: "Tree Traversals",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { parentMap: { B: "A", C: "A", D: "B", E: "B" }, ids: ["A", "B", "C", "D", "E"] },
    visualType: "tree",
    run,
};
export default module;
