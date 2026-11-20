/**
 * tree-maximum-matching-dp.ts – Maximum matching on a tree.
 *
 * dp0 means u free, dp1 means u matched to a child. Postorder maximum.
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
    education: {
        "intuition": "A matching is a set of edges with no shared endpoints. On a tree, a two-state DP decides for each node whether it is matched to one of its children or left free, combining the best choices from its children accordingly.",
        "invariants": [
            "dp0[u] is the best matching size in u's subtree when u is not matched to a child.",
            "dp1[u] is the best size when u is matched to exactly one child.",
            "Each edge is used at most once and no vertex has two matched edges."
        ],
        "correctness": "If u is free, every child may independently choose its best state, giving dp0 as the sum of max(dp0, dp1) over children. If u is matched to a child k, that child must be free at its own level, so the value is dp0[k] plus the best free-or-matched choices of all other children. Trying every k and taking the maximum gives dp1, and postorder induction yields the maximum matching at the root.",
        "complexityRationale": "Each edge contributes constant work in the postorder recurrence, so time is O(n). Two values per node use O(n) space.",
        "uses": [
            "Pairing tasks or partners with conflict constraints",
            "Finding maximum links in a tree network",
            "Network flow and matching teaching examples"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 22 (matching on trees)",
            "Bondy and Murty, Graph Theory, Chapter 5"
        ],
        "workedExample": "For the path A-B-C, either edge AB or BC can be chosen but not both, so the maximum matching size is 1. The DP reaches this by setting dp1 at the root from the best single child choice."
    },

    id: "tree-maximum-matching-dp",
    name: "Tree Maximum Matching DP",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { parentMap: { B: "A", C: "A", D: "B", E: "C" }, ids: ["A", "B", "C", "D", "E"] },
    visualType: "tree",
    run,
    pseudocode: [
        "order nodes postorder from the tree root",
        "compute free state from best child choices",
        "try matching node with each child in turn",
        "keep maximum of free and matched states",
        "return maximum matching size as the answer",
    ],
};
export default module;
