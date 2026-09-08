/**
 * dial-bucket-dijkstra.ts – Dial's Bucket Dijkstra
 *
 * Integer weights ≤ C go into buckets 0..C·V: extract-min is O(1), each
 * edge relaxes once. A→D: A–B–C–D costs 4.
 * Time: O(C·V + E) Space: O(C·V)
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
    yield snap(`Dial's: buckets 0..${C * labels.length}, source ${start} in bucket 0.`, 0, {
        maxEdge: C,
    });
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
            yield snap(`Settle ${u} at distance ${d} (bucket ${d}).`, 1, { settled, distance: d });
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
            ? `Shortest ${start}→${target} = ${dist.get(target)} via ${path.join("→")}.`
            : `${target} unreachable from ${start}.`,
        2,
        { distance: ok ? (dist.get(target) as number) : -1 },
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
};

export default module;
