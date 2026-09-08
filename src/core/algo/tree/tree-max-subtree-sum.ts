/**
 * tree-max-subtree-sum.ts – maximum connected downward sum (postorder DP).
 * sub[u] = value[u] + Σ sub[child]; the answer is the max over all u.
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
    yield emit(states, `Maximum subtree sum is ${sub.get(best)} rooted at ${best}.`, 2, {
        maxSum: sub.get(best) ?? 0,
        bestRoot: best,
    });
}

const module: AlgorithmModule = {
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
};

export default module;
