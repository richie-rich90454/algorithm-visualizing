/**
 * tree-vertex-cover-dp.ts – Minimum vertex cover on a tree.
 *
 * dp[u][0] means u out (children in), dp[u][1] means u in. Postorder DP.
 * Time O(n), Space O(n). Current uses comparing, done uses sorted.
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
        Object.entries(t.parentMap ?? { B: "A", C: "A", D: "B", E: "B" }),
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
        yield frame("Empty tree – cover size is 0.", 0, { cover: 0 });
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
    yield frame(`Vertex-cover DP – postorder ${post.join(" → ")}.`, 0, {});
    step += 1;
    const dp0 = new Map<string, number>();
    const dp1 = new Map<string, number>();
    for (const u of post) {
        let out = 0,
            inn = 1;
        for (const v of kids.get(u) ?? []) {
            out += dp1.get(v)!;
            inn += Math.min(dp0.get(v)!, dp1.get(v)!);
        }
        dp0.set(u, out);
        dp1.set(u, inn);
        st.set(u, "comparing");
        yield frame(
            `Node ${u}: out=${out} (children in), in=${inn}. Best=${Math.min(out, inn)}.`,
            2,
            { node: u, out, in: inn },
        );
        step += 1;
        st.set(u, "sorted");
        if (step > 12) break;
    }
    const ans = Math.min(dp0.get(root)!, dp1.get(root)!);
    // ponytail: brute-force recheck omitted; DP recurrence is exact on trees.
    for (const id of ids) st.set(id, "sorted");
    yield frame(
        `Minimum vertex cover size is ${ans} (root ${root}: out=${dp0.get(root)}, in=${dp1.get(root)}).`,
        4,
        { cover: ans },
    );
}
const module: AlgorithmModule = {
    education: {
        "intuition": "A vertex cover is a set of vertices touching every edge. On a tree a two-state DP decides whether each node is in the cover; if it is not, all its children must be, and if it is, each child may choose the cheaper state.",
        "invariants": [
            "dp[u][0] is the minimum cover size in u's subtree when u is excluded.",
            "dp[u][1] is the minimum size when u is included.",
            "Every edge between u and a child is covered in both states."
        ],
        "correctness": "If u is excluded, each edge from u to a child must be covered by that child, forcing all children into the included state. If u is included, those edges are already covered and each child can independently take the cheaper of its two states. Postorder induction gives optimal subtree covers for both states, and taking the minimum at the root yields the minimum vertex cover of the whole tree.",
        "complexityRationale": "Each edge is processed once with constant work, so time is O(n). Two values per node use O(n) space.",
        "uses": [
            "Selecting minimum monitors to cover all links",
            "Assigning reviewers to cover every dependency",
            "Teaching tree DP with mutually exclusive states"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 15 (dynamic programming)",
            "Garey and Johnson, Computers and Intractability, vertex cover chapter"
        ],
        "workedExample": "For the path A-B-C, choosing only B covers both edges AB and BC, giving cover size 1. The DP sets dp[A][0] to include B and confirms that no smaller cover exists."
    },

    id: "tree-vertex-cover-dp",
    name: "Tree Vertex Cover DP",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { parentMap: { B: "A", C: "A", D: "B", E: "B" }, ids: ["A", "B", "C", "D", "E"] },
    visualType: "tree",
    run,
    pseudocode: [
        "order nodes postorder from the tree root",
        "force children in when current node stays out",
        "post-order: combine child DP states for both choices",
        "keep cheaper of in versus out per node",
        "return minimum vertex cover size as the answer",
    ],
};
export default module;
