/**
 * widest-path-max-capacity.ts – Widest Path (Max Capacity)
 *
 * Dijkstra with max-heap semantics: width(v) = max over paths of the
 * bottleneck edge. A→D via C: bottleneck min(3,4) = 3.
 * Time: O(E log V) Space: O(V + E)
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
    yield snap(`Widest path from ${start}: always expand the largest bottleneck first.`, 0, {});
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
        yield snap(`Settle ${u} with bottleneck ${bw}.`, 1, { bottleneck: bw });
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
            ? `Widest ${start}→${target}: capacity ${width.get(target)} via ${path.join("→")}.`
            : `${target} unreachable.`,
        2,
        { capacity: ok ? (width.get(target) as number) : -1 },
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
};

export default module;
