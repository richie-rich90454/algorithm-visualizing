/**
 * minimax-path-mst.ts – Minimax Path via MST
 *
 * The minimax edge on the best path equals the minimax edge on the MST
 * path (bottleneck property). Kruskal MST: BC1, CD2, AC3; A→D max-edge 3.
 * Time: O(E log E) Space: O(V + E)
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
            ["B", 4],
            ["C", 3],
        ],
        B: [
            ["A", 4],
            ["C", 1],
        ],
        C: [
            ["A", 3],
            ["B", 1],
            ["D", 2],
        ],
        D: [["C", 2]],
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
    const seenE = new Set<string>();
    const allE: Array<{ u: string; v: string; w: number }> = [];
    for (const [u, vs] of Object.entries(wadj))
        for (const [v, w] of vs) {
            const k = [u, v].sort().join("|");
            if (!seenE.has(k)) {
                seenE.add(k);
                allE.push({ u, v, w });
            }
        }
    allE.sort((a, b) => a.w - b.w);
    const parent = new Map(labels.map((v) => [v, v]));
    const find = (x: string): string => {
        let r = x;
        while (parent.get(r) !== r) r = parent.get(r) as string;
        return r;
    };
    const mst: Array<{ u: string; v: string; w: number }> = [];
    yield snap(`Kruskal: scan ${allE.length} edges lightest-first for the MST.`, 0, {
        edges: allE.length,
    });
    step += 1;
    for (const e of allE) {
        const ru = find(e.u);
        const rv = find(e.v);
        if (ru !== rv) {
            parent.set(rv, ru);
            mst.push(e);
            setE(e.u, e.v, "path");
            setE(e.v, e.u, "path");
            yield snap(`MST takes ${e.u}–${e.v} (weight ${e.w}).`, 1, { mstEdges: mst.length });
            step += 1;
        }
        if (mst.length === labels.length - 1) break;
    }
    const mstAdj = new Map(labels.map((v) => [v, [] as Array<[string, number]>]));
    for (const e of mst) {
        (mstAdj.get(e.u) as Array<[string, number]>).push([e.v, e.w]);
        (mstAdj.get(e.v) as Array<[string, number]>).push([e.u, e.w]);
    }
    const prev = new Map<string, string | null>(labels.map((v) => [v, null]));
    const prevW = new Map<string, number>(labels.map((v) => [v, 0]));
    const q = [start];
    const seen = new Set([start]);
    while (q.length > 0) {
        const u = q.shift() as string;
        for (const [v, w] of mstAdj.get(u) as Array<[string, number]>) {
            if (!seen.has(v)) {
                seen.add(v);
                prev.set(v, u);
                prevW.set(v, w);
                q.push(v);
            }
        }
    }
    const path: string[] = [];
    let cur: string | null = target;
    while (cur !== null) {
        path.unshift(cur);
        cur = prev.get(cur) as string | null;
    }
    let mm = 0;
    for (let i = 1; i < path.length; i += 1)
        mm = Math.max(mm, prevW.get(path[i] as string) as number);
    clr();
    for (const e of mst) {
        setE(e.u, e.v, "sorted");
        setE(e.v, e.u, "sorted");
    }
    for (const v of path) setN(v, "path");
    yield snap(`Minimax ${start}→${target} on the MST: ${path.join("→")} with max edge ${mm}.`, 2, {
        minimax: mm,
    });
}

const module: AlgorithmModule = {
    id: "minimax-path-mst",
    name: "Minimax Path via MST",
    category: "shortest-path",
    complexity: { time: "O(E log E)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 4],
                ["C", 3],
            ],
            B: [
                ["A", 4],
                ["C", 1],
            ],
            C: [
                ["A", 3],
                ["B", 1],
                ["D", 2],
            ],
            D: [["C", 2]],
        },
        start: "A",
        target: "D",
    },
    visualType: "graph",
    run,
};

export default module;
