/**
 * binary-lifting-max-edge-query.ts – max edge on tree paths.
 * up[k][v] / mx[k][v] jump 2^k ancestors with the max edge seen.
 * D→C peaks at 5, E→D peaks at 7.
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
type WEdge = [string, string, number];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { nodes?: unknown; edges?: unknown; queries?: unknown } | null) ?? {};
    const nodes: string[] = Array.isArray(t.nodes)
        ? (t.nodes as unknown[]).map(String)
        : ["A", "B", "C", "D", "E"];
    const wedges: WEdge[] = Array.isArray(t.edges)
        ? (t.edges as unknown[]).flatMap((e) =>
              Array.isArray(e) && e.length >= 3
                  ? [[String(e[0]), String(e[1]), Number(e[2])] as WEdge]
                  : [],
          )
        : ([
              ["A", "B", 3],
              ["A", "C", 5],
              ["B", "D", 2],
              ["B", "E", 7],
          ] as WEdge[]);
    const queries: [string, string][] = Array.isArray(t.queries)
        ? (t.queries as unknown[]).flatMap((q) =>
              Array.isArray(q) && q.length >= 2
                  ? [[String(q[0]), String(q[1])] as [string, string]]
                  : [],
          )
        : [
              ["D", "C"],
              ["E", "D"],
          ];

    let step = 0;
    const adj = new Map(nodes.map((v) => [v, [] as { to: string; w: number }[]]));
    const treeEdges: Edge[] = [];
    for (const [u, v, w] of wedges) {
        if (!adj.has(u) || !adj.has(v)) continue;
        adj.get(u)?.push({ to: v, w });
        adj.get(v)?.push({ to: u, w });
    }
    const root = nodes[0];
    const up0 = new Map<string, string | null>();
    const mx0 = new Map<string, number>();
    const depth = new Map<string, number>();
    if (root !== undefined) {
        const q: string[] = [root];
        up0.set(root, null);
        mx0.set(root, 0);
        depth.set(root, 0);
        const seen = new Set([root]);
        while (q.length > 0) {
            const v = q.shift() as string;
            for (const { to, w } of adj.get(v) ?? []) {
                if (!seen.has(to)) {
                    seen.add(to);
                    up0.set(to, v);
                    mx0.set(to, w);
                    depth.set(to, (depth.get(v) as number) + 1);
                    q.push(to);
                }
            }
        }
        for (const [u, v] of wedges) {
            if (up0.get(v) === u || up0.get(u) === v) {
                const p = up0.get(v) === u ? u : v;
                const c = up0.get(v) === u ? v : u;
                treeEdges.push({
                    id: `edge-node-${p}-node-${c}`,
                    sourceId: `node-${p}`,
                    targetId: `node-${c}`,
                    state: "idle",
                    label: "",
                    directed: false,
                });
            }
        }
    }
    const LOG = Math.max(1, Math.ceil(Math.log2(Math.max(2, nodes.length))) + 1);
    const up: Map<string, string | null>[] = [];
    const mx: Map<string, number>[] = [];
    for (let k = 0; k < LOG; k += 1) {
        up.push(new Map());
        mx.push(new Map());
    }
    for (const v of nodes) {
        up[0]?.set(v, up0.get(v) ?? null);
        mx[0]?.set(v, mx0.get(v) ?? 0);
    }
    for (let k = 1; k < LOG; k += 1) {
        for (const v of nodes) {
            const mid = up[k - 1]?.get(v) ?? null;
            up[k]?.set(v, mid ? (up[k - 1]?.get(mid) ?? null) : null);
            mx[k]?.set(v, Math.max(mx[k - 1]?.get(v) ?? 0, mid ? (mx[k - 1]?.get(mid) ?? 0) : 0));
        }
    }
    const query = (a: string, b: string): number => {
        if (!depth.has(a) || !depth.has(b)) return 0;
        let x = a;
        let y = b;
        let best = 0;
        if ((depth.get(x) as number) < (depth.get(y) as number)) [x, y] = [y, x];
        for (let k = LOG - 1; k >= 0; k -= 1) {
            const anc = up[k]?.get(x);
            if (
                anc !== null &&
                anc !== undefined &&
                (depth.get(anc) as number) >= (depth.get(y) as number)
            ) {
                best = Math.max(best, mx[k]?.get(x) ?? 0);
                x = anc;
            }
        }
        if (x === y) return best;
        for (let k = LOG - 1; k >= 0; k -= 1) {
            if ((up[k]?.get(x) ?? null) !== (up[k]?.get(y) ?? null)) {
                best = Math.max(best, mx[k]?.get(x) ?? 0, mx[k]?.get(y) ?? 0);
                x = (up[k]?.get(x) ?? x) as string;
                y = (up[k]?.get(y) ?? y) as string;
            }
        }
        return Math.max(best, mx0.get(x) ?? 0, mx0.get(y) ?? 0);
    };

    const emit = (
        states: Record<string, EntityState>,
        hot: Set<string>,
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((id) => ({
            id: `node-${id}`,
            type: "node" as const,
            label: `${id}(d${depth.get(id) ?? "?"})`,
            value: id,
            state: states[id] ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: up0.get(id) ? `node-${up0.get(id)}` : "root" },
        })),
        edges: treeEdges.map((e) => ({
            ...e,
            state: hot.has(e.id) ? ("path" as EntityState) : e.state,
        })),
        description,
        codeLineNumber,
        layout: "tree" as const,
        meta,
    });

    if (nodes.length === 0) {
        yield emit({}, new Set(), "Empty tree – no max-edge queries to answer.", 0, {
            answers: [],
        });
        return;
    }

    yield emit(
        {},
        new Set(),
        `Binary lifting on ${nodes.length} nodes (LOG=${LOG}) for max-edge path queries.`,
        0,
    );
    step += 1;
    yield emit(
        Object.fromEntries(nodes.map((v) => [v, "visited" as EntityState])),
        new Set(),
        `Level 0: parent and edge weight per node – e.g. D's max to parent is ${mx0.get("D") ?? 0}.`,
        1,
    );
    step += 1;
    yield emit(
        {},
        new Set(),
        `Levels 1..${LOG - 1}: 2^k jumps with running maxima – table built in O(n log n).`,
        2,
    );
    step += 1;
    const answers: number[] = [];
    for (const [a, b] of queries.slice(0, 8)) {
        const ans = query(a, b);
        answers.push(ans);
        yield emit(
            { [a]: "comparing", [b]: "comparing" },
            new Set(),
            `Query max-edge ${a}→${b}: lift the deeper node, then both together – answer ${ans}.`,
            3,
        );
        step += 1;
        if (step > 11) break;
    }
    const fstates: Record<string, EntityState> = {};
    for (const v of nodes) fstates[v] = "sorted";
    yield emit(
        fstates,
        new Set(),
        `Answered ${answers.length} queries: [${answers.join(", ")}].`,
        4,
        { answers, queries: queries.slice(0, answers.length).map(([a, b]) => `${a}→${b}`) },
    );
}

const module: AlgorithmModule = {
    id: "binary-lifting-max-edge-query",
    name: "Binary Lifting Max Edge Query",
    category: "tree",
    complexity: { time: "O((n+q) log n)", space: "O(n log n)" },
    defaultInput: {
        nodes: ["A", "B", "C", "D", "E"],
        edges: [
            ["A", "B", 3],
            ["A", "C", 5],
            ["B", "D", 2],
            ["B", "E", 7],
        ],
        queries: [
            ["D", "C"],
            ["E", "D"],
        ],
    },
    visualType: "tree",
    run,
};

export default module;
