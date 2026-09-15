/**
 * delta-stepping-parallel-sssp.ts – Delta-Stepping (Parallel SSSP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Delta-Stepping buckets vertices by distance so whole buckets relax in
 * parallel. With width delta, bucket k holds distances in [k*delta,
 * (k+1)*delta). Light edges (weight at most delta) stay inside a bucket and
 * are relaxed first; heavy edges jump ahead to later buckets. With delta 2
 * the demo settles A, B, C, D at distances 0, 2, 3, 4.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E + V x (L / delta)) where L is the maximum edge weight
 *   Space: O(V + E) for buckets and distance labels
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bucket vertices under relaxation are YELLOW (comparing).
 *   - Light-edge relaxations are BLUE (active).
 *   - Heavy-edge jumps are PINK (highlight).
 *   - Settled bucket vertices are GREEN (sorted).
 *   - The final shortest path is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Bridges Dijkstra and Bellman-Ford for parallel machines.
 *   - Small delta behaves like Dijkstra; large delta like Bellman-Ford.
 *   - Requires non-negative edge weights.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            start?: string;
            target?: string;
            delta?: number;
        } | null) ?? {};
    const wadj: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 2],
            ["C", 5],
        ],
        B: [
            ["C", 1],
            ["D", 4],
        ],
        C: [["D", 1]],
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
    const target = task.target ?? "D";
    const delta = task.delta ?? 2;
    const dist = new Map(labels.map((v) => [v, Infinity]));
    const prev = new Map<string, string | null>(labels.map((v) => [v, null]));
    dist.set(start, 0);
    const buckets = new Map<number, Set<string>>();
    const put = (v: string): void => {
        const b = Math.floor((dist.get(v) as number) / delta);
        if (!buckets.has(b)) buckets.set(b, new Set());
        (buckets.get(b) as Set<string>).add(v);
    };
    put(start);
    yield snap(
        `Delta-stepping with width delta=${delta} from ${start}: bucket k holds distances [k*delta, (k+1)*delta).`,
        0,
        { delta, settled: 0, visits: 0 },
    );
    step += 1;
    let guard = 0;
    for (;;) {
        guard += 1;
        if (guard > 12) break;
        const keys = [...buckets.keys()].filter((k) => (buckets.get(k) as Set<string>).size > 0);
        if (keys.length === 0) break;
        const b = Math.min(...keys);
        const bucket = new Set(buckets.get(b) as Set<string>);
        buckets.set(b, new Set());
        clr();
        for (const v of bucket) setN(v, "comparing");
        const light = [...bucket];
        for (const u of light) {
            for (const [v, w] of wadj[u] ?? []) {
                if (w > delta) continue;
                if ((dist.get(u) as number) + w < (dist.get(v) as number)) {
                    const ob = Math.floor((dist.get(v) as number) / delta);
                    if (buckets.has(ob)) (buckets.get(ob) as Set<string>).delete(v);
                    dist.set(v, (dist.get(u) as number) + w);
                    prev.set(v, u);
                    put(v);
                    setE(u, v, "active");
                }
            }
        }
        for (const u of light) {
            for (const [v, w] of wadj[u] ?? []) {
                if (w <= delta) continue;
                if ((dist.get(u) as number) + w < (dist.get(v) as number)) {
                    const ob = Math.floor((dist.get(v) as number) / delta);
                    if (buckets.has(ob)) (buckets.get(ob) as Set<string>).delete(v);
                    dist.set(v, (dist.get(u) as number) + w);
                    prev.set(v, u);
                    put(v);
                    setE(u, v, "highlight");
                }
            }
        }
        for (const v of bucket) setN(v, "sorted");
        yield snap(
            `Bucket ${b} covering distances [${b * delta}, ${(b + 1) * delta}): relaxing light edges in parallel, then heavy edges.`,
            3,
            {
                bucket: b,
                settled: labels.length - [...buckets.values()].reduce((n, s) => n + s.size, 0),
                visits: b + 1,
            },
        );
        step += 1;
    }
    const path: string[] = [];
    let cur: string | null = target;
    while (cur !== null) {
        path.unshift(cur);
        cur = prev.get(cur) as string | null;
    }
    const ok = path[0] === start;
    clr();
    if (ok) for (const v of path) setN(v, "path");
    yield snap(
        ok
            ? `Shortest path ${start} to ${target} costs ${dist.get(target)} via ${path.join(" → ")} with delta=${delta}.`
            : `${target} is unreachable from ${start}.`,
        6,
        {
            distance: ok ? (dist.get(target) as number) : -1,
            path: ok ? path.join("→") : "",
            settled: labels.length,
            visits: labels.length,
        },
    );
}

const module: AlgorithmModule = {
    id: "delta-stepping-parallel-sssp",
    name: "Delta-Stepping (Parallel SSSP)",
    category: "shortest-path",
    complexity: { time: "O(E + V·(L/Δ))", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 2],
                ["C", 5],
            ],
            B: [
                ["C", 1],
                ["D", 4],
            ],
            C: [["D", 1]],
            D: [],
        },
        start: "A",
        target: "D",
        delta: 2,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "dist[s] ← 0, bucket vertices by floor(dist/delta)",
        "take smallest nonempty bucket k for parallel work",
        "relax light edges with weight at most delta first",
        "relax heavy edges jumping to later buckets",
        "settle bucket k once no light edge still improves",
        "repeat until every bucket is empty",
        "done: reconstruct path to t via predecessors",
    ],
};

export default module;
