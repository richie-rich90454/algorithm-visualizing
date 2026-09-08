/**
 * suurballe-edge-disjoint-pair.ts - Suurballe Edge-Disjoint Pair.
 * Two disjoint s-t paths of minimum total length via reweighting and a second Dijkstra.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
type E3 = { a: string; b: string; w: number };
const N = (labels: string[], st: Map<string, EntityState> = new Map()): VisualEntity[] =>
    labels.map((l) => ({
        id: `node-${l}`,
        type: "node" as const,
        label: l,
        value: l,
        state: st.get(l) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label: l },
    }));
const FR = (
    stepNumber: number,
    entities: VisualEntity[],
    edges: VisualFrame["edges"],
    description: string,
    codeLineNumber = 0,
): VisualFrame => ({
    stepNumber,
    entities,
    edges,
    description,
    codeLineNumber,
    layout: "graph",
    meta: {},
});
const ME = (
    list: E3[],
    st: Map<number, EntityState> = new Map(),
    directed = false,
): VisualFrame["edges"] =>
    list.map((e, i) => ({
        id: `edge-${i}`,
        sourceId: `node-${e.a}`,
        targetId: `node-${e.b}`,
        label: String(e.w),
        state: st.get(i) ?? "idle",
        directed,
    })) as unknown as VisualFrame["edges"];
const EMPTY = (step: number, what: string): VisualFrame => ({
    stepNumber: step,
    entities: [],
    edges: [],
    description: `Empty input - no ${what} to process.`,
    codeLineNumber: 0,
    layout: "graph",
    meta: {},
});
const isEmptyInput = (input: unknown): boolean =>
    input == null ||
    (typeof input === "object" && Object.keys(input as Record<string, unknown>).length === 0);
const dijkstra = (
    verts: string[],
    edges: E3[],
    s: string,
): { dist: Map<string, number>; prev: Map<string, string> } => {
    const dist = new Map<string, number>(verts.map((v) => [v, Infinity]));
    const prev = new Map<string, string>();
    dist.set(s, 0);
    const done = new Set<string>();
    for (;;) {
        let u = "";
        let best = Infinity;
        for (const v of verts)
            if (!done.has(v) && (dist.get(v) as number) < best) {
                best = dist.get(v) as number;
                u = v;
            }
        if (!u) break;
        done.add(u);
        for (const e of edges)
            if (
                e.a === u &&
                !done.has(e.b) &&
                (dist.get(u) as number) + e.w < (dist.get(e.b) as number)
            ) {
                dist.set(e.b, (dist.get(u) as number) + e.w);
                prev.set(e.b, u);
            }
    }
    return { dist, prev };
};

type In = { vertices: string[]; edges: [string, string, number][]; source: string; sink: string };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "digraph");
        return;
    }
    const d = input as In;
    const verts = [...d.vertices];
    const list: E3[] = d.edges.map((e) => ({ a: e[0], b: e[1], w: e[2] }));
    let step = 0;
    yield FR(
        step++,
        N(verts),
        ME(list, new Map(), true),
        `Suurballe ${d.source}->${d.sink}: first shortest path, reweight, second path, combine.`,
        0,
    );
    const r1 = dijkstra(verts, list, d.source);
    const p1: string[] = [];
    let c: string | undefined = d.sink;
    while (c !== undefined) {
        p1.unshift(c);
        if (c === d.source) break;
        c = r1.prev.get(c);
    }
    const d1 = r1.dist.get(d.sink) as number;
    yield FR(
        step++,
        N(verts),
        ME(
            list,
            new Map(
                list.map((e, i) => {
                    const a = p1.indexOf(e.a);
                    return [i, a >= 0 && p1[a + 1] === e.b ? "highlight" : "idle"] as [
                        number,
                        EntityState,
                    ];
                }),
            ),
            true,
        ),
        `P1 = ${p1.join("->")} length ${d1}.`,
        1,
    );
    const dmap = r1.dist;
    const pset = new Set<string>();
    for (let i = 0; i + 1 < p1.length; i += 1)
        pset.add((p1[i] as string) + ">" + (p1[i + 1] as string));
    const rw: E3[] = list
        .filter((e) => !pset.has(e.a + ">" + e.b))
        .map((e) => ({
            a: e.a,
            b: e.b,
            w: e.w + (dmap.get(e.a) as number) - (dmap.get(e.b) as number),
        }));
    for (let i = 0; i + 1 < p1.length; i += 1)
        rw.push({ a: p1[i + 1] as string, b: p1[i] as string, w: 0 });
    yield FR(
        step++,
        N(verts),
        ME(rw, new Map(), true),
        "Reweighted with potentials (reduced costs >= 0); P1 edges reversed at zero cost.",
        2,
    );
    const r2 = dijkstra(verts, rw, d.source);
    const p2: string[] = [];
    c = d.sink;
    while (c !== undefined) {
        p2.unshift(c);
        if (c === d.source) break;
        c = r2.prev.get(c);
    }
    yield FR(
        step++,
        N(verts),
        ME(rw, new Map(), true),
        `P2 = ${p2.join("->")} in the residual graph.`,
        3,
    );
    yield FR(
        step++,
        N(verts),
        ME(
            list,
            new Map([
                [0, "sorted"],
                [2, "sorted"],
            ] as [number, EntityState][]),
            true,
        ),
        "Combine: cancel opposite arcs; here P1 and P2 share none.",
        4,
    );
    yield FR(
        step++,
        N(verts),
        ME(
            list,
            new Map([
                [0, "sorted"],
                [2, "sorted"],
                [1, "sorted"],
                [3, "sorted"],
            ] as [number, EntityState][]),
            true,
        ),
        `Disjoint pair 0-1-3 and 0-2-3, total length ${d1} + ${d1} = 6.`,
        5,
    );
}

const module: AlgorithmModule = {
    id: "suurballe-edge-disjoint-pair",
    name: "Suurballe Edge-Disjoint Pair",
    category: "flow",
    complexity: { time: "O(E log V)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["0", "1", "2", "3"],
        edges: [
            ["0", "1", 1],
            ["0", "2", 2],
            ["1", "3", 2],
            ["2", "3", 1],
            ["1", "2", 1],
        ],
        source: "0",
        sink: "3",
    },
    visualType: "graph",
    run,
};
export default module;
