/**
 * tree-partition-dp.ts – Partition tree into subtrees bounded by S.
 *
 * Postorder sums; cuts a child when its sum plus parent exceeds S.
 * Time O(n), Space O(n). Cut uses highlight, kept uses sorted.
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
    education: {
        "intuition": "This DP partitions a tree into connected subtrees whose total weight does not exceed a bound S. A postorder pass accumulates subtree sums and cuts the edge to a child when adding that child's sum would exceed the limit.",
        "invariants": [
            "Each kept component has total weight at most S.",
            "Components are connected subtrees formed by keeping or cutting edges.",
            "A cut child's entire subtree becomes its own component."
        ],
        "correctness": "Processing children first gives each child's accumulated component sum. If a child's sum can be merged into the parent without exceeding S, keeping the edge yields a larger valid component; otherwise cutting is forced because any merge would violate the bound. Greedy postorder merging therefore produces components that all respect S, and cutting exactly when necessary minimizes the number of unnecessary splits for this tree structure.",
        "complexityRationale": "Each edge is examined once in postorder with constant work, so time is O(n). Stored sums and cut flags use O(n) space.",
        "uses": [
            "Splitting a hierarchy into balanced parts",
            "Dividing workloads under a capacity limit",
            "Competitive programming tree partition problems"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 15 (dynamic programming)",
            "Competitive Programming 3, Hall and Li, tree DP chapter"
        ],
        "workedExample": "A chain of four unit-weight nodes with S = 2 accumulates sums from the leaves and cuts once the bound would be exceeded, producing two connected components of two nodes each."
    },

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
    pseudocode: [
        "order nodes postorder with weight limit S",
        "accumulate child remainders while fitting limit",
        "cut child edge when its sum would overflow",
        "count cuts plus final root component",
        "return component count as the partition answer",
    ],
};
export default module;
