/**
 * zero-one-bfs.ts – 0-1 BFS
 *
 * Weights in {0,1}: a deque replaces the heap – 0-edges to the front,
 * 1-edges to the back. A→D costs 1.
 * Time: O(V + E) Space: O(V)
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
    yield snap(`0-1 BFS from ${start}: 0-edges jump the queue, 1-edges queue up.`, 0, {});
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
        yield snap(`Pop ${u} at distance ${dist.get(u)} (deque: [${deque.join(", ")}]).`, 1, {
            distance: dist.get(u) as number,
        });
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
            ? `Shortest ${start}→${target} = ${dist.get(target)} via ${path.join("→")}.`
            : `${target} unreachable.`,
        2,
        { distance: ok ? (dist.get(target) as number) : -1 },
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
};

export default module;
