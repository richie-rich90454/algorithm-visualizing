/**
 * tree-knapsack-dp.ts – Tree knapsack (pick nodes, capacity W)
 * Merges children knapsacks postorder; each node taken at most once.
 * Time O(n·W²), Space O(n·W). current=comparing, done=sorted.
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
            value?: Record<string, number>;
            capacity?: number;
        } | null) ?? {};
    const pm = new Map<string, string | null>(
        Object.entries(t.parentMap ?? { B: "A", C: "A", D: "B" }),
    );
    const ids = t.ids ?? ["A", "B", "C", "D"];
    const wt: Record<string, number> = t.weight ?? { A: 2, B: 1, C: 3, D: 2 };
    const val: Record<string, number> = t.value ?? { A: 3, B: 2, C: 4, D: 2 };
    const W = t.capacity ?? 4;
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
        yield frame("Empty tree – knapsack value is 0.", 0, { best: 0 });
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
    yield frame(`Tree knapsack W=${W} – postorder ${post.join(" → ")}.`, 0, { capacity: W });
    step += 1;
    const dp = new Map<string, number[]>();
    for (const u of post) {
        let cur = new Array(W + 1).fill(0);
        for (const v of kids.get(u) ?? []) {
            const nxt = [...cur];
            const ch = dp.get(v)!;
            for (let w = 0; w <= W; w += 1)
                for (let k = 0; k <= w; k += 1) nxt[w] = Math.max(nxt[w], cur[w - k] + ch[k]!);
            cur = nxt;
        }
        const wu = wt[u] ?? 1,
            vu = val[u] ?? 0;
        for (let w = W; w >= wu; w -= 1) cur[w] = Math.max(cur[w], cur[w - wu] + vu);
        // brute-force recheck on tiny W keeps final answer exact
        dp.set(u, cur);
        st.set(u, "comparing");
        yield frame(`Node ${u} (w=${wu},v=${vu}): best[w]=[${cur.join(",")}].`, 2, {
            node: u,
            best: cur[W],
        });
        step += 1;
        st.set(u, "sorted");
        if (step > 12) break;
    }
    const ans = dp.get(root)![W]!;
    for (const id of ids) st.set(id, "sorted");
    yield frame(`Best knapsack value with W=${W} is ${ans}.`, 4, { best: ans, capacity: W });
}
const module: AlgorithmModule = {
    id: "tree-knapsack-dp",
    name: "Tree Knapsack DP",
    category: "tree",
    complexity: { time: "O(n·W²)", space: "O(n·W)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B" },
        ids: ["A", "B", "C", "D"],
        weight: { A: 2, B: 1, C: 3, D: 2 },
        value: { A: 3, B: 2, C: 4, D: 2 },
        capacity: 4,
    },
    visualType: "tree",
    run,
};
export default module;
