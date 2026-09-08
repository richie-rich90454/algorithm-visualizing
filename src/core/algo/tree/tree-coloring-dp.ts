/**
 * tree-coloring-dp.ts – minimum-cost 3-coloring of a tree (DP).
 * dp[u][c] = cost[u][c] + Σ min over c'≠c of dp[child][c'].
 * Default costs give min cost 9 (A=1, B=0, C=0, D=2).
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
    const t = (input as { parentMap?: unknown; ids?: unknown; costs?: unknown } | null) ?? {};
    const rawParent = (t.parentMap as Record<string, string> | undefined) ?? {
        B: "A",
        C: "A",
        D: "B",
    };
    const ids = Array.isArray(t.ids) ? (t.ids as unknown[]).map(String) : ["A", "B", "C", "D"];
    const costs = ((t.costs as Record<string, number[]> | undefined) ?? {
        A: [5, 1, 4],
        B: [2, 6, 3],
        C: [4, 2, 7],
        D: [1, 5, 2],
    }) as Record<string, number[]>;
    const parent = new Map<string, string | null>(
        ids.map((id) => [id, (rawParent[id] as string) ?? null]),
    );

    let step = 0;
    const treeEdges: Edge[] = [];
    for (const id of ids) {
        const p = parent.get(id);
        if (p && ids.includes(p)) {
            treeEdges.push({
                id: `edge-node-${p}-node-${id}`,
                sourceId: `node-${p}`,
                targetId: `node-${id}`,
                state: "idle",
                label: "",
                directed: false,
            });
        }
    }
    const colorOf = new Map<string, number>();
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
            label: colorOf.has(id) ? `${id}=c${colorOf.get(id)}` : id,
            value: id,
            state: states[id] ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parent.get(id) ? `node-${parent.get(id)}` : "root" },
        })),
        edges: treeEdges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "tree" as const,
        meta,
    });

    if (ids.length === 0) {
        yield emit({}, "Empty tree – coloring costs 0.", 0, { minCost: 0, colors: [] });
        return;
    }

    const kids = new Map<string, string[]>();
    for (const id of ids) kids.set(id, []);
    for (const id of ids) {
        const p = parent.get(id);
        if (p && kids.has(p)) kids.get(p)?.push(id);
    }
    const root = ids.find((id) => !parent.get(id)) ?? (ids[0] as string);
    const dp = new Map<string, number[]>();
    const post: string[] = [];
    const walk = (v: string): void => {
        const ch = kids.get(v) ?? [];
        for (const c of ch) walk(c);
        post.push(v);
        const row = [0, 1, 2].map((c) => {
            let s = (costs[v] as number[] | undefined)?.[c] ?? 0;
            for (const k of ch) {
                const kr = dp.get(k) as number[];
                s += Math.min(...[0, 1, 2].filter((x) => x !== c).map((x) => kr[x] as number));
            }
            return s;
        });
        dp.set(v, row);
    };
    walk(root);
    const pick = (v: string, forbidden: number): void => {
        const row = dp.get(v) as number[];
        let best = -1;
        let bestVal = Infinity;
        for (let c = 0; c < 3; c += 1) {
            if (c !== forbidden && (row[c] as number) < bestVal) {
                bestVal = row[c] as number;
                best = c;
            }
        }
        colorOf.set(v, best);
        for (const k of kids.get(v) ?? []) pick(k, best);
    };
    pick(root, -1);
    const minCost = Math.min(...(dp.get(root) as number[]));
    const colors = Object.fromEntries(colorOf);

    yield emit({}, `3-color DP on ${ids.length} nodes – cheapest proper coloring wins.`, 0);
    step += 1;
    const show =
        post.length > 9 ? post.filter((_, k) => k % Math.ceil(post.length / 7) === 0) : post;
    for (const v of show) {
        const states: Record<string, EntityState> = {};
        for (const done of post.slice(0, post.indexOf(v))) states[done] = "visited";
        states[v] = "comparing";
        yield emit(states, `${v}: dp=[${(dp.get(v) as number[]).join(", ")}].`, 1);
        step += 1;
        if (step > 10) break;
    }
    const fstates: Record<string, EntityState> = {};
    for (const id of ids) fstates[id] = "sorted";
    yield emit(
        fstates,
        `Cheapest proper 3-coloring costs ${minCost}: ${ids.map((id) => `${id}=c${colorOf.get(id)}`).join(", ")}.`,
        2,
        { minCost, colors: ids.map((id) => `${id}=c${colorOf.get(id)}`) },
    );
}

const module: AlgorithmModule = {
    id: "tree-coloring-dp",
    name: "Tree Coloring DP",
    category: "tree",
    complexity: { time: "O(n·k)", space: "O(n·k)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B" },
        ids: ["A", "B", "C", "D"],
        costs: { A: [5, 1, 4], B: [2, 6, 3], C: [4, 2, 7], D: [1, 5, 2] },
    },
    visualType: "tree",
    run,
};

export default module;
