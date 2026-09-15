/**
 * bidirectional-dijkstra.ts – Bidirectional Dijkstra
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Two Dijkstra searches grow at once, one forward from the source and one
 * backward from the target, until their frontiers meet. Every vertex tracks
 * a forward distance and a backward distance; the best meeting vertex
 * minimizes their sum and yields the optimal path. On the demo graph the
 * searches meet at C with total cost 4, visiting far fewer vertices than a
 * one-sided search.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log V) worst case, typically much faster in practice
 *   Space: O(V + E) for both frontiers and bookkeeping
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The forward frontier vertex is YELLOW (comparing).
 *   - The backward frontier vertex is PINK (highlight).
 *   - The current best meeting vertex is ORANGE (visited).
 *   - The final shortest path is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Optimal on graphs with non-negative weights, like plain Dijkstra.
 *   - Stops early once no unvisited pair can beat the best meeting cost.
 *   - Most effective when source and target are far apart.
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
            ["A", 2],
            ["C", 1],
            ["D", 4],
        ],
        C: [
            ["A", 5],
            ["B", 1],
            ["D", 1],
        ],
        D: [
            ["B", 4],
            ["C", 1],
        ],
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
    const df = new Map(labels.map((v) => [v, Infinity]));
    const db = new Map(labels.map((v) => [v, Infinity]));
    const pf = new Map<string, string | null>(labels.map((v) => [v, null]));
    const pb = new Map<string, string | null>(labels.map((v) => [v, null]));
    df.set(start, 0);
    db.set(target, 0);
    const sf = new Set<string>();
    const sb = new Set<string>();
    yield snap(
        `Bidirectional search: forward distances from ${start}, backward distances from ${target}.`,
        0,
        { settled: 0, visits: 0 },
    );
    step += 1;
    let best = Infinity;
    let meet = "";
    const extract = (d: Map<string, number>, s: Set<string>): string | null => {
        let u: string | null = null;
        let bd = Infinity;
        for (const v of labels)
            if (!s.has(v) && (d.get(v) as number) < bd) {
                bd = d.get(v) as number;
                u = v;
            }
        return u;
    };
    for (let round = 0; round < labels.length * 2; round += 1) {
        const u = extract(df, sf);
        const w = extract(db, sb);
        if (u === null || w === null) break;
        sf.add(u);
        sb.add(w);
        for (const [v, c] of wadj[u] ?? [])
            if ((df.get(u) as number) + c < (df.get(v) as number)) {
                df.set(v, (df.get(u) as number) + c);
                pf.set(v, u);
            }
        for (const [v, c] of wadj[w] ?? [])
            if ((db.get(w) as number) + c < (db.get(v) as number)) {
                db.set(v, (db.get(w) as number) + c);
                pb.set(v, w);
            }
        for (const v of labels) {
            const tot = (df.get(v) as number) + (db.get(v) as number);
            if (tot < best) {
                best = tot;
                meet = v;
            }
        }
        clr();
        setN(u, "comparing");
        setN(w, "highlight");
        setN(meet, "visited");
        yield snap(
            `Round ${round + 1}: forward settles ${u} at distance ${df.get(u)}, backward settles ${w} at distance ${db.get(w)}; best via ${meet} costs ${best}.`,
            2,
            { best, settled: sf.size + sb.size, visits: round + 1 },
        );
        step += 1;
        const fu = extract(df, sf);
        const bw = extract(db, sb);
        if (fu !== null && bw !== null && (df.get(fu) as number) + (db.get(bw) as number) >= best)
            break;
    }
    const fwd: string[] = [];
    let c: string | null = meet;
    while (c !== null) {
        fwd.unshift(c);
        c = pf.get(c) as string | null;
    }
    clr();
    for (const v of fwd) setN(v, "sorted");
    yield snap(
        `Forward settled {${[...sf].join(", ")}}, backward settled {${[...sb].join(", ")}} with frontiers overlapping at ${meet}.`,
        4,
        { best, settled: sf.size + sb.size, visits: sf.size + sb.size },
    );
    step += 1;
    const bwd: string[] = [];
    let c2: string | null = pb.get(meet) as string | null;
    while (c2 !== null) {
        bwd.push(c2);
        c2 = pb.get(c2) as string | null;
    }
    const path = [...fwd, ...bwd];
    clr();
    for (const v of path) setN(v, "path");
    for (let i = 0; i + 1 < path.length; i += 1)
        setE(path[i] as string, path[i + 1] as string, "path");
    yield snap(
        `Frontiers met at ${meet}: shortest path ${start} to ${target} costs ${best} via ${path.join(" → ")}.`,
        6,
        {
            distance: best,
            path: path.join("→"),
            settled: sf.size + sb.size,
            visits: sf.size + sb.size,
        },
    );
}

const module: AlgorithmModule = {
    id: "bidirectional-dijkstra",
    name: "Bidirectional Dijkstra",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 2],
                ["C", 5],
            ],
            B: [
                ["A", 2],
                ["C", 1],
                ["D", 4],
            ],
            C: [
                ["A", 5],
                ["B", 1],
                ["D", 1],
            ],
            D: [
                ["B", 4],
                ["C", 1],
            ],
        },
        start: "A",
        target: "D",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "distF[s] ← 0, distB[t] ← 0, both frontiers open",
        "pop u from forward frontier with smallest distance",
        "pop w from backward frontier with smallest distance",
        "relax edges out of u and into w on each side",
        "update best meeting vertex minimizing distF+distB",
        "stop when frontiers cannot beat the best cost",
        "done: rebuild full path through meeting vertex",
    ],
};

export default module;
