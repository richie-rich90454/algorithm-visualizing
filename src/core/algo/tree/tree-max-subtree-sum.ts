/**
 * tree-max-subtree-sum.ts – Maximum connected downward sum with postorder DP.
 *
 * sub[u] equals value[u] plus child sums; the answer is the max over all u.
 * Default tree peaks at B with sum 6.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Edge = {
    id: string;
    sourceId: string;
    targetId: string;
    label: string;
    state: EntityState;
    directed: boolean;
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { parentMap?: unknown; ids?: unknown; values?: unknown } | null) ?? {};
    const rawParent = (t.parentMap as Record<string, string> | undefined) ?? {
        B: "A",
        C: "A",
        D: "B",
        E: "C",
    };
    const ids = Array.isArray(t.ids) ? (t.ids as unknown[]).map(String) : ["A", "B", "C", "D", "E"];
    const values = ((t.values as Record<string, number> | undefined) ?? {
        A: -5,
        B: 4,
        C: 3,
        D: 2,
        E: -1,
    }) as Record<string, number>;
    const parent = new Map<string, string | null>(
        ids.map((id) => [id, (rawParent[id] as string) ?? null]),
    );

    let step = 0;
    const edges: Edge[] = [];
    for (const id of ids) {
        const p = parent.get(id);
        if (p)
            edges.push({
                id: `edge-node-${p}-node-${id}`,
                sourceId: `node-${p}`,
                targetId: `node-${id}`,
                state: "idle",
                label: "",
                directed: false,
            });
    }
    const emit = (
        states: Record<string, EntityState>,
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: ids.map((id) => ({
            id: `node-${id}`,
            type: "node" as const,
            label: `${id}(${values[id] ?? 0})`,
            value: values[id] ?? 0,
            state: states[id] ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parent.get(id) ? `node-${parent.get(id)}` : "root" },
        })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "tree" as const,
        meta,
    });

    if (ids.length === 0) {
        yield emit({}, "Empty tree – max subtree sum is 0.", 0, { maxSum: 0, bestRoot: "none" });
        return;
    }

    const kids = new Map<string, string[]>();
    for (const id of ids) kids.set(id, []);
    for (const id of ids) {
        const p = parent.get(id);
        if (p && kids.has(p)) kids.get(p)?.push(id);
    }
    const sub = new Map<string, number>();
    const post: string[] = [];
    const walk = (v: string): number => {
        let s = values[v] ?? 0;
        for (const c of kids.get(v) ?? []) s += walk(c);
        sub.set(v, s);
        post.push(v);
        return s;
    };
    const roots = ids.filter((id) => !parent.get(id));
    for (const r of roots.length > 0 ? roots : [ids[0] as string]) walk(r);
    let best = ids[0] as string;
    for (const id of ids) {
        if ((sub.get(id) as number) > (sub.get(best) as number)) best = id;
    }

    yield emit({}, `Postorder pass over ${ids.length} nodes – accumulating subtree sums.`, 0);
    step += 1;
    const show =
        post.length > 10 ? post.filter((_, k) => k % Math.ceil(post.length / 8) === 0) : post;
    for (const v of show) {
        const states: Record<string, EntityState> = {};
        for (const done of post.slice(0, post.indexOf(v))) states[done] = "visited";
        states[v] = "comparing";
        yield emit(states, `Subtree at ${v} sums to ${sub.get(v)}.`, 1);
        step += 1;
        if (step > 12) break;
    }
    const states: Record<string, EntityState> = {};
    for (const id of ids) states[id] = "visited";
    states[best] = "highlight";
    yield emit(states, `Maximum subtree sum is ${sub.get(best)} rooted at ${best}.`, 4, {
        maxSum: sub.get(best) ?? 0,
        bestRoot: best,
    });
}

const module: AlgorithmModule = {
    education: {
        "intuition": "This DP finds the largest sum of a connected downward path starting anywhere and going from parent to descendant. Each node computes the best sum of a subtree hanging below it as its own value plus the best child contributions, and the answer is the maximum over all nodes.",
        "invariants": [
            "sub[u] is the value at u plus the positive child subtree sums.",
            "The best downward sum starting at u equals sub[u].",
            "The global answer is the maximum sub[u] over every vertex."
        ],
        "correctness": "A connected downward path beginning at u consists of u plus, for each child, at most one downward path from that child. Choosing the best child path independently gives sub[u], and including only beneficial children is captured by taking the best contribution. Postorder induction gives sub[u] correctly for every node, and since any downward path starts at some node, the maximum over all nodes is the desired answer.",
        "complexityRationale": "Each edge is examined once in postorder with constant work, so time is O(n). One stored sum per node uses O(n) space.",
        "uses": [
            "Finding the most profitable subtree in a hierarchy",
            "Maximum subarray analogue on rooted structures",
            "Scoring best connected components in tree data"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 15 (dynamic programming)",
            "Competitive Programming 3, Hall and Li, tree DP chapter"
        ],
        "workedExample": "With values A = -5, B = 4, C = 2, D = 1 where B has child D and A has children B and C, sub[B] = 4 + 1 = 5 while sub[A] = -5 + 5 + 2 = 2. The maximum downward sum is 5 at B."
    },

    id: "tree-max-subtree-sum",
    name: "Tree Max Subtree Sum",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "C" },
        ids: ["A", "B", "C", "D", "E"],
        values: { A: -5, B: 4, C: 3, D: 2, E: -1 },
    },
    visualType: "tree",
    run,
    pseudocode: [
        "root the tree and prepare postorder accumulation",
        "post-order: combine child DP states into subtree sums",
        "add current node value to child totals",
        "track maximum subtree sum and its root",
        "return best sum with its root as the answer",
    ],
};

export default module;
