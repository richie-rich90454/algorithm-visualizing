/**
 * zero-one-bfs.ts – 0-1 BFS
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Finds shortest paths when every edge weight is 0 or 1, without a heap. A
 * double-ended queue replaces the priority queue: relaxing a 0-weight edge
 * pushes the vertex to the front, while a 1-weight edge pushes to the back,
 * so the deque stays ordered by distance. On the demo both candidate routes
 * from A to D cost 1.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) with deque operations in O(1)
 *   Space: O(V) for distances and the deque
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex popped from the deque is YELLOW (comparing).
 *   - Relaxed edges are BLUE (active), improved vertices ORANGE (visited).
 *   - Settled vertices are GREEN (sorted).
 *   - The final shortest path is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Only valid for weights 0 and 1; Dial's buckets generalize it.
 *   - Zero edges act as free shortcuts that jump the queue.
 *   - A clean example of matching the data structure to the weights.
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
            ["B", 0],
            ["C", 1],
        ],
        B: [["D", 1]],
        C: [["D", 0]],
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
    const dist = new Map(labels.map((v) => [v, Infinity]));
    const prev = new Map<string, string | null>(labels.map((v) => [v, null]));
    dist.set(start, 0);
    const deque = [start];
    yield snap(
        `0-1 BFS setup from ${start}: distances set with ${start}=0, weight 0 edges jump to the front of the deque.`,
        0,
        { settled: 0, visits: 0 },
    );
    step += 1;
    while (deque.length > 0) {
        const u = deque.shift() as string;
        clr();
        setN(u, "comparing");
        for (const [v, w] of wadj[u] ?? []) {
            const nd = (dist.get(u) as number) + w;
            if (nd < (dist.get(v) as number)) {
                dist.set(v, nd);
                prev.set(v, u);
                if (w === 0) deque.unshift(v);
                else deque.push(v);
                setE(u, v, "active");
                setN(v, "visited");
            }
        }
        setN(u, "sorted");
        yield snap(
            `Pop vertex ${u} at distance ${dist.get(u)} from the deque front (remaining deque holds [${deque.join(", ") || "empty"}]).`,
            3,
            {
                distance: dist.get(u) as number,
                settled: labels.filter((v) => (dist.get(v) as number) < Infinity).length,
                visits: step,
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
    if (ok) {
        for (const v of path) setN(v, "path");
        for (let i = 0; i + 1 < path.length; i += 1)
            setE(path[i] as string, path[i + 1] as string, "path");
    }
    yield snap(
        ok
            ? `Shortest path ${start} to ${target} costs ${dist.get(target)} via ${path.join(" → ")} using 0 and 1 weights.`
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
    id: "zero-one-bfs",
    name: "0-1 BFS",
    category: "shortest-path",
    complexity: { time: "O(V + E)", space: "O(V)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 0],
                ["C", 1],
            ],
            B: [["D", 1]],
            C: [["D", 0]],
            D: [],
        },
        start: "A",
        target: "D",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "dist[s] ← 0, deque holds only source s",
        "pop front vertex u with smallest distance",
        "for each edge u→v with weight w in {0,1}",
        "if dist[u]+w < dist[v]: update dist[v] via u",
        "push v front when w = 0, else push v back",
        "repeat until the deque is empty",
        "done: reconstruct path to t via predecessors",
    ],
};

export default module;
