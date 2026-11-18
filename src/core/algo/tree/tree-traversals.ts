/**
 * tree-traversals.ts – Preorder, postorder, and level order walks.
 *
 * One tiny binary tree; each order visits every node exactly once.
 * Time O(n), Space O(n). Current uses comparing, visited uses sorted.
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
    yield frame(`Level order [${level.join(",")}]; all ${ids.length} nodes visited.`, 4, {
        preorder: pre,
        postorder: post,
        level,
    });
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Visit every node of a binary tree in a fixed order. Preorder visits the root first, inorder visits it between the subtrees, postorder visits it last, and level order works left to right one depth at a time.",
        "invariants": [
            "Each node is visited exactly once.",
            "For inorder on a binary search tree, visits occur in nondecreasing key order."
        ],
        "correctness": "Each traversal recursively covers the left subtree, the root, and the right subtree, so every node is visited once and the relative order matches the definition. Level order follows the queue discipline, so nodes are emitted by increasing depth.",
        "complexityRationale": "Every node and edge is handled a constant number of times: O(n) time. Recursive forms use O(h) stack space where h is tree height; level order uses O(w) space for the widest level.",
        "uses": [
            "Expression tree evaluation",
            "Serializing and copying trees",
            "Inorder iteration of binary search trees"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 12",
            "Knuth, The Art of Computer Programming, Vol. 1, Section 2.3"
        ],
        "workedExample": "Tree with root B, left child A, right child C. Inorder gives A, B, C; preorder gives B, A, C; postorder gives A, C, B; level order gives B, A, C."
    },
    id: "tree-traversals",
    name: "Tree Traversals",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { parentMap: { B: "A", C: "A", D: "B", E: "B" }, ids: ["A", "B", "C", "D", "E"] },
    visualType: "tree",
    run,
    pseudocode: [
        "start traversals from the tree root node",
        "visit node then children for preorder list",
        "collect postorder after visiting all children",
        "walk level by level with a queue for breadth",
        "return preorder, postorder, and level orders",
    ],
};
export default module;
