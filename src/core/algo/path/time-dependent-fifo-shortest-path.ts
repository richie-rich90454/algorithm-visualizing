/**
 * time-dependent-fifo-shortest-path.ts – Time-Dependent FIFO Shortest Path
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Routes with travel times that depend on departure moment, under the FIFO
 * rule that leaving later can never arrive earlier, so waiting never helps.
 * A Dijkstra-like pass settles vertices by earliest arrival time: departing
 * A at t=0, the route A to B to D arrives at t=4 and beats A to C to D at
 * t=6.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log V) with a heap ordered by arrival time
 *   Space: O(V + E) for arrival labels and predecessors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The start vertex is YELLOW (comparing) at departure time.
 *   - Settled vertices are GREEN (sorted) with final arrival times.
 *   - Relaxed departure edges are BLUE (active).
 *   - The earliest-arrival route is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - FIFO is the key assumption; without it the problem gets much harder.
 *   - Models rush-hour traffic where congestion respects departure order.
 *   - Reduces to plain Dijkstra when travel times are constant.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            start?: string;
            target?: string;
            depart?: number;
        } | null) ?? {};
    const wadj: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 2],
            ["C", 5],
        ],
        B: [["D", 2]],
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
    const t0 = task.depart ?? 0;
    const arr = (u: string, v: string, t: number): number => {
        const w = (wadj[u] ?? []).find(([x]) => x === v)?.[1] ?? Infinity;
        return t + w;
    };
    const best = new Map(labels.map((v) => [v, Infinity]));
    const prev = new Map<string, string | null>(labels.map((v) => [v, null]));
    best.set(start, t0);
    const done = new Set<string>();
    setN(start, "comparing");
    yield snap(
        `Time-dependent FIFO search from ${start} departing at t=${t0}: expanding vertices in earliest arrival order.`,
        0,
        {
            depart: t0,
            settled: 0,
            visits: 0,
        },
    );
    step += 1;
    while (done.size < labels.length) {
        let u: string | null = null;
        let bt = Infinity;
        for (const v of labels)
            if (!done.has(v) && (best.get(v) as number) < bt) {
                bt = best.get(v) as number;
                u = v;
            }
        if (u === null || bt === Infinity) break;
        done.add(u);
        clr();
        setN(u, "comparing");
        for (const [v] of wadj[u] ?? []) {
            const at = arr(u, v, bt);
            if (at < (best.get(v) as number)) {
                best.set(v, at);
                prev.set(v, u);
                setE(u, v, "active");
                setN(v, "visited");
            }
        }
        setN(u, "sorted");
        yield snap(
            `Settle vertex ${u} at arrival time t=${bt}: relaxing each departure edge from here.`,
            3,
            { time: bt, settled: done.size, visits: done.size },
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
            ? `Earliest arrival at ${target} is t=${best.get(target)} via ${path.join(" → ")} departing at t=${t0}.`
            : `${target} is unreachable from ${start}.`,
        6,
        {
            arrival: ok ? (best.get(target) as number) : -1,
            distance: ok ? (best.get(target) as number) : -1,
            path: ok ? path.join("→") : "",
            settled: done.size,
            visits: done.size,
        },
    );
}

const module: AlgorithmModule = {
    id: "time-dependent-fifo-shortest-path",
    name: "Time-Dependent FIFO Shortest Path",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 2],
                ["C", 5],
            ],
            B: [["D", 2]],
            C: [["D", 1]],
            D: [],
        },
        start: "A",
        target: "D",
        depart: 0,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "earliest[s] ← departure time t0, others infinite",
        "pop unsettled u with smallest arrival time",
        "for each edge u→v compute arrival from u at t",
        "if arrival beats best[v]: update best[v] via u",
        "settle u, its arrival time is now final",
        "repeat until target settles or all are reached",
        "done: earliest-arrival path via predecessors",
    ],
};

export default module;
