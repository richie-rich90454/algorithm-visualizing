/**
 * dial-bucket-dijkstra.ts – Dial's Bucket Dijkstra
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dial's algorithm is Dijkstra specialized for small integer weights. When
 * every edge weight is at most C, distances grow by bounded steps, so
 * vertices live in buckets 0 through C x V and extract-min scans forward
 * for the next nonempty bucket in amortized O(1). Each edge relaxes once.
 * On the demo graph the route A to B to C to D costs 4.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(C x V + E) for bounded integer weights
 *   Space: O(C x V) for the bucket array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex settled from its bucket is YELLOW (comparing).
 *   - Relaxed edges are BLUE (active), improved vertices ORANGE (visited).
 *   - Settled vertices are GREEN (sorted).
 *   - The final shortest path is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires non-negative integer weights with a small maximum C.
 *   - Beats a binary heap when C is small; loses when C is huge.
 *   - The ancestor of modern radix-heap priority queues.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            start?: string;
            target?: string;
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
    const INF = Infinity;
    const dist = new Map(labels.map((v) => [v, INF]));
    const prev = new Map<string, string | null>(labels.map((v) => [v, null]));
    dist.set(start, 0);
    const C = Math.max(1, ...Object.values(wadj).flatMap((vs) => vs.map(([, w]) => w)));
    const buckets = new Map<number, string[]>();
    buckets.set(0, [start]);
    let settled = 0;
    yield snap(
        `Dial's setup from ${start}: integer weights up to ${C}, source distance 0 sits in bucket 0.`,
        0,
        {
            maxEdge: C,
            settled: 0,
            visits: 0,
        },
    );
    step += 1;
    for (let d = 0; d <= C * labels.length && settled < labels.length; d += 1) {
        const b = buckets.get(d) ?? [];
        while (b.length > 0) {
            const u = b.shift() as string;
            if ((dist.get(u) as number) < d) continue;
            settled += 1;
            clr();
            setN(u, "comparing");
            for (const [v, w] of wadj[u] ?? []) {
                const nd = d + w;
                if (nd < (dist.get(v) as number)) {
                    dist.set(v, nd);
                    prev.set(v, u);
                    if (!buckets.has(nd)) buckets.set(nd, []);
                    (buckets.get(nd) as string[]).push(v);
                    setE(u, v, "active");
                    setN(v, "visited");
                }
            }
            yield snap(
                `Settle vertex ${u} at distance ${d} from bucket ${d}, relaxing each outgoing edge once.`,
                3,
                { settled, visits: settled, distance: d },
            );
            step += 1;
            setN(u, "sorted");
        }
    }
    const path: string[] = [];
    let cur: string | null = target;
    while (cur !== null) {
        path.unshift(cur);
        cur = prev.get(cur) as string | null;
    }
    const ok = path[0] === start;
    clr();
    if (ok) {
        for (const v of path) setN(v, "path");
        for (let i = 0; i + 1 < path.length; i += 1)
            setE(path[i] as string, path[i + 1] as string, "path");
    }
    yield snap(
        ok
            ? `Shortest path ${start} to ${target} costs ${dist.get(target)} via ${path.join(" → ")}.`
            : `${target} is unreachable from ${start}.`,
        6,
        {
            distance: ok ? (dist.get(target) as number) : -1,
            path: ok ? path.join("→") : "",
            settled,
            visits: settled,
        },
    );
}

const module: AlgorithmModule = {
    id: "dial-bucket-dijkstra",
    name: "Dial's Bucket Dijkstra",
    category: "shortest-path",
    complexity: { time: "O(C·V + E)", space: "O(C·V)" },
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
    },
    visualType: "graph",
    run,
    pseudocode: [
        "dist[s] ← 0, buckets 0..C×V hold integer distances",
        "scan forward for the next nonempty bucket d",
        "pop u from bucket d and settle it as final",
        "for each edge u→v with weight w: relax edge",
        "if d+w < dist[v]: move v into bucket d+w",
        "repeat until every reachable bucket is empty",
        "done: reconstruct path to t via predecessors",
    ],
};

export default module;
