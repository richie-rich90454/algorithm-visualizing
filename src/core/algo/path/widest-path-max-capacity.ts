/**
 * widest-path-max-capacity.ts – Widest Path (Max Capacity)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Finds the route whose bottleneck edge is as large as possible, which
 * models maximum truck weight or network throughput. Like Dijkstra with a
 * max-heap, each vertex tracks width(v), the best bottleneck so far, always
 * expanding the largest width first and updating width(v) to
 * max(width(v), min(width(u), capacity(u,v))). From A to D the route via C
 * has bottleneck min(3,4) = 3 and beats the route via B.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log V) with a max-heap frontier
 *   Space: O(V + E) for widths and predecessors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex settled from the max frontier is YELLOW (comparing).
 *   - Improved edges are BLUE (active), vertices ORANGE (visited).
 *   - Settled vertices are GREEN (sorted).
 *   - The widest route is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The greedy max-first order is optimal for bottleneck objectives.
 *   - Also solvable from any maximum spanning tree of the graph.
 *   - Models evacuation, freight, and bandwidth routing directly.
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
            ["B", 5],
            ["C", 3],
        ],
        B: [["D", 2]],
        C: [["D", 4]],
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
    const width = new Map(labels.map((v) => [v, 0]));
    const prev = new Map<string, string | null>(labels.map((v) => [v, null]));
    width.set(start, Infinity);
    const done = new Set<string>();
    yield snap(
        `Widest path setup from ${start}: widths start at 0 with source infinite, always expanding the largest bottleneck first.`,
        0,
        { settled: 0, visits: 0 },
    );
    step += 1;
    while (done.size < labels.length) {
        let u: string | null = null;
        let bw = -1;
        for (const v of labels)
            if (!done.has(v) && (width.get(v) as number) > bw) {
                bw = width.get(v) as number;
                u = v;
            }
        if (u === null || bw <= 0) break;
        done.add(u);
        clr();
        setN(u, "comparing");
        for (const [v, c] of wadj[u] ?? []) {
            const nw = Math.min(bw, c);
            if (nw > (width.get(v) as number)) {
                width.set(v, nw);
                prev.set(v, u);
                setE(u, v, "active");
                setN(v, "visited");
            }
        }
        setN(u, "sorted");
        yield snap(
            `Settle vertex ${u} with bottleneck width ${bw}, relaxing each outgoing capacity edge.`,
            3,
            { bottleneck: bw, settled: done.size, visits: done.size },
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
            ? `Widest path ${start} to ${target} has capacity ${width.get(target)} via ${path.join(" → ")}.`
            : `${target} is unreachable from ${start}.`,
        6,
        {
            capacity: ok ? (width.get(target) as number) : -1,
            distance: ok ? (width.get(target) as number) : -1,
            path: ok ? path.join("→") : "",
            settled: done.size,
            visits: done.size,
        },
    );
}

const module: AlgorithmModule = {
    id: "widest-path-max-capacity",
    name: "Widest Path (Max Capacity)",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 5],
                ["C", 3],
            ],
            B: [["D", 2]],
            C: [["D", 4]],
            D: [],
        },
        start: "A",
        target: "D",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "width[s] ← infinite, width[v] ← 0 for v not equal to s",
        "pop unsettled u with largest bottleneck width",
        "for each edge u→v with capacity c: relax edge",
        "candidate ← min(width[u], c) through this edge",
        "if candidate > width[v]: update width[v] via u",
        "settle u, repeat until target is settled",
        "done: rebuild widest path via predecessors",
    ],
};

export default module;
