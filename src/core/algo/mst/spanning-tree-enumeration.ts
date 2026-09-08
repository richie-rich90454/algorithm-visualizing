/**
 * spanning-tree-enumeration.ts - Spanning Tree Enumeration.
 * Enumerates every spanning tree of a tiny graph by subset filtering.
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
const connected = (verts: string[], edges: E3[]): boolean => {
    if (verts.length === 0) return true;
    const adj = new Map<string, string[]>();
    for (const v of verts) adj.set(v, []);
    for (const e of edges) {
        adj.get(e.a)?.push(e.b);
        adj.get(e.b)?.push(e.a);
    }
    const first = verts[0] as string;
    const seen = new Set<string>([first]);
    const q: string[] = [first];
    while (q.length > 0) {
        const u = q.pop() as string;
        for (const nb of adj.get(u) ?? [])
            if (!seen.has(nb)) {
                seen.add(nb);
                q.push(nb);
            }
    }
    return seen.size === verts.length;
};

type In = { vertices: string[]; edges: [string, string, number][] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "graph");
        return;
    }
    const d = input as In;
    const verts = [...d.vertices];
    const list: E3[] = d.edges.map((e) => ({ a: e[0], b: e[1], w: e[2] }));
    let step = 0;
    yield FR(
        step++,
        N(verts),
        ME(list),
        `Enumerating spanning trees of a ${verts.length}-node graph (${list.length} edges).`,
        0,
    );
    const need = verts.length - 1;
    const combos: number[][] = [];
    const rec = (s: number, cur: number[]): void => {
        if (cur.length === need) {
            combos.push([...cur]);
            return;
        }
        for (let i = s; i < list.length; i += 1) rec(i + 1, [...cur, i]);
    };
    rec(0, []);
    const trees: number[][] = [];
    for (const c of combos) {
        const es = c.map((i) => list[i] as E3);
        if (!connected(verts, es)) continue;
        trees.push(c);
        const w = es.reduce((s, e) => s + e.w, 0);
        yield FR(
            step++,
            N(verts),
            ME(list, new Map(c.map((i) => [i, "highlight"] as [number, EntityState]))),
            `Tree #${trees.length}: ${es.map((e) => `${e.a}-${e.b}(${e.w})`).join(", ")} weight ${w}.`,
            1,
        );
    }
    yield FR(
        step++,
        N(verts),
        ME(list, new Map((trees[0] ?? []).map((i) => [i, "sorted"] as [number, EntityState]))),
        `Exactly ${trees.length} spanning trees (weights ${trees.map((t) => t.reduce((s, i) => s + (list[i] as E3).w, 0)).join(", ")}).`,
        2,
    );
}

const module: AlgorithmModule = {
    id: "spanning-tree-enumeration",
    name: "Spanning Tree Enumeration",
    category: "mst",
    complexity: { time: "O(2^E V)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C"],
        edges: [
            ["A", "B", 1],
            ["B", "C", 2],
            ["A", "C", 3],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
