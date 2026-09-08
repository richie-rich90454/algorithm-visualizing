/**
 * alt-landmark-routing.ts – ALT Landmark Routing
 *
 * Landmarks precompute distances; triangle inequality turns them into an
 * admissible A* heuristic h(v) = max |d(L,v) − d(L,t)|. Landmarks A, D
 * guide A→D = 4 with tighter bounds than straight Dijkstra.
 * Time: O(E log V) query Space: O(L·V + E)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            start?: string;
            target?: string;
            landmarks?: string[];
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
    const landmarks = (task.landmarks ?? ["A", "D"]).filter((l) => labels.includes(l));
    const dij = (s: string): Map<string, number> => {
        const d = new Map(labels.map((v) => [v, Infinity]));
        d.set(s, 0);
        const done = new Set<string>();
        for (;;) {
            let u: string | null = null;
            let bd = Infinity;
            for (const v of labels)
                if (!done.has(v) && (d.get(v) as number) < bd) {
                    bd = d.get(v) as number;
                    u = v;
                }
            if (u === null) break;
            done.add(u);
            for (const [t, w] of wadj[u] ?? [])
                if ((d.get(u) as number) + w < (d.get(t) as number))
                    d.set(t, (d.get(u) as number) + w);
        }
        return d;
    };
    const fromL = new Map(landmarks.map((l) => [l, dij(l)]));
    yield snap(`ALT preprocess: distances from landmark(s) ${landmarks.join(", ")}.`, 0, {
        landmarks: landmarks.length,
    });
    step += 1;
    for (const l of landmarks) {
        clr();
        setN(l, "highlight");
        yield snap(
            `Landmark ${l}: ${labels.map((v) => `${v}=${(fromL.get(l) as Map<string, number>).get(v)}`).join(", ")}.`,
            1,
            {},
        );
        step += 1;
    }
    const h = (v: string): number => {
        let m = 0;
        for (const l of landmarks) {
            const dl = fromL.get(l) as Map<string, number>;
            m = Math.max(m, Math.abs((dl.get(v) as number) - (dl.get(target) as number)));
        }
        return m;
    };
    const g = new Map(labels.map((v) => [v, Infinity]));
    const prev = new Map<string, string | null>(labels.map((v) => [v, null]));
    g.set(start, 0);
    const open: Array<[number, string]> = [[h(start), start]];
    const done = new Set<string>();
    let expanded = 0;
    while (open.length > 0) {
        open.sort((a, b) => a[0] - b[0]);
        const [, u] = open.shift() as [number, string];
        if (done.has(u)) continue;
        done.add(u);
        expanded += 1;
        clr();
        setN(u, "comparing");
        setN(target, "highlight");
        if (u === target) {
            yield snap(`Goal ${target} expanded after ${expanded} expansions: g=${g.get(u)}.`, 2, {
                expanded,
            });
            step += 1;
            break;
        }
        for (const [t, w] of wadj[u] ?? []) {
            if ((g.get(u) as number) + w < (g.get(t) as number)) {
                g.set(t, (g.get(u) as number) + w);
                prev.set(t, u);
                open.push([(g.get(t) as number) + h(t), t]);
                setE(u, t, "active");
            }
        }
        yield snap(`Expand ${u}: g=${g.get(u)}, h=${h(u)} (landmark bound).`, 2, { expanded });
        step += 1;
    }
    const path: string[] = [];
    let cur: string | null = target;
    while (cur !== null) {
        path.unshift(cur);
        cur = prev.get(cur) as string | null;
    }
    clr();
    for (const v of path) setN(v, "path");
    yield snap(
        `ALT: shortest ${start}→${target} = ${g.get(target)} via ${path.join("→")} in ${expanded} expansions.`,
        3,
        { distance: g.get(target) as number },
    );
}

const module: AlgorithmModule = {
    id: "alt-landmark-routing",
    name: "ALT Landmark Routing",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(L·V + E)" },
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
        landmarks: ["A", "D"],
    },
    visualType: "graph",
    run,
};

export default module;
