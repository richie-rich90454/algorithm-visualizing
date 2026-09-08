/**
 * goldberg-radzik-shortest-path.ts – Goldberg–Radzik Shortest Path
 *
 * Each round DFS-orders the reachable vertices and relaxes edges in that
 * topological order; a round with no change certifies optimality. Handles
 * the B→C = −1 edge: A0, B2, C1, D3, no negative cycle.
 * Time: O(V·E) worst Space: O(V + E)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { graph?: Record<string, Array<[string, number]>>; start?: string } | null) ?? {};
    const wadj: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 2],
            ["C", 4],
        ],
        B: [["C", -1]],
        C: [["D", 2]],
        D: [],
    };

    const labels = [
        ...new Set([
            ...Object.keys(wadj),
            ...Object.values(wadj).flatMap((vs) => vs.map(([v]) => v)),
        ]),
    ];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeWeightedEdges(wadj);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
    };
    const setE = (a: string, b: string, s: EntityState): void => {
        const e = edges.find((x) => x.sourceId === `node-${a}` && x.targetId === `node-${b}`);
        if (e) e.state = s;
    };
    const clr = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph" as const,
        meta,
    });
    if (labels.length === 0) {
        yield snap("Empty graph – nothing to route.", 0);
        return;
    }
    const start = task.start && wadj[task.start] !== undefined ? task.start : (labels[0] as string);
    const dist = new Map(labels.map((v) => [v, Infinity]));
    const prev = new Map<string, string | null>(labels.map((v) => [v, null]));
    dist.set(start, 0);
    yield snap(
        `Goldberg–Radzik from ${start}: DFS-topological relaxation rounds (negative edges OK).`,
        0,
        {},
    );
    step += 1;
    for (let round = 1; round <= labels.length; round += 1) {
        const seen = new Set<string>();
        const order: string[] = [];
        const dfs = (u: string): void => {
            seen.add(u);
            for (const [v] of wadj[u] ?? [])
                if (!seen.has(v) && (dist.get(v) as number) < Infinity) dfs(v);
            order.push(u);
        };
        for (const v of labels) if (!seen.has(v) && (dist.get(v) as number) < Infinity) dfs(v);
        let changed = false;
        for (let i = order.length - 1; i >= 0; i -= 1) {
            const u = order[i] as string;
            for (const [v, w] of wadj[u] ?? []) {
                if ((dist.get(u) as number) + w < (dist.get(v) as number)) {
                    dist.set(v, (dist.get(u) as number) + w);
                    prev.set(v, u);
                    changed = true;
                    setE(u, v, "active");
                }
            }
        }
        clr();
        setN(start, "highlight");
        for (const v of labels)
            if ((dist.get(v) as number) < Infinity && v !== start) setN(v, "visited");
        yield snap(
            `Round ${round}: topological order ${[...order].reverse().join("→")}${changed ? "" : " – no change, optimal"}.`,
            1,
            { round },
        );
        step += 1;
        if (!changed) break;
    }
    let negCycle = false;
    for (const u of labels)
        for (const [v, w] of wadj[u] ?? []) {
            if ((dist.get(u) as number) + w < (dist.get(v) as number)) negCycle = true;
        }
    for (const v of labels) if ((dist.get(v) as number) < Infinity) setN(v, "sorted");
    yield snap(
        negCycle
            ? "Negative cycle detected – distances unbounded."
            : `Distances from ${start}: ${labels.map((v) => `${v}=${dist.get(v)}`).join(", ")}.`,
        2,
        { negativeCycle: negCycle },
    );
}

const module: AlgorithmModule = {
    id: "goldberg-radzik-shortest-path",
    name: "Goldberg–Radzik Shortest Path",
    category: "shortest-path",
    complexity: { time: "O(V·E)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 2],
                ["C", 4],
            ],
            B: [["C", -1]],
            C: [["D", 2]],
            D: [],
        },
        start: "A",
    },
    visualType: "graph",
    run,
};

export default module;
