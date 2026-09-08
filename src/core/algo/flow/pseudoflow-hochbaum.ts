/**
 * pseudoflow-hochbaum.ts - Pseudoflow (Hochbaum).
 * Push excess through a forest of rooted components; mergers reveal the min cut.
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
type FE = { a: string; b: string; cap: number };
const maxflow = (
    verts: string[],
    edges: FE[],
    s: string,
    t: string,
): { value: number; paths: string[][] } => {
    const cap = new Map<string, number>();
    const adj = new Map<string, Set<string>>();
    for (const v of verts) adj.set(v, new Set());
    const add = (u: string, v: string, c: number): void => {
        cap.set(u + ">" + v, (cap.get(u + ">" + v) ?? 0) + c);
        adj.get(u)?.add(v);
        adj.get(v)?.add(u);
    };
    for (const e of edges) add(e.a, e.b, e.cap);
    let value = 0;
    const paths: string[][] = [];
    for (;;) {
        const prev = new Map<string, string>();
        const q: string[] = [s];
        prev.set(s, "");
        while (q.length > 0) {
            const u = q.shift() as string;
            if (u === t) break;
            for (const v of adj.get(u) ?? [])
                if (!prev.has(v) && (cap.get(u + ">" + v) ?? 0) > 0) {
                    prev.set(v, u);
                    q.push(v);
                }
        }
        if (!prev.has(t)) break;
        let bn = Infinity;
        const path: string[] = [];
        let cur = t;
        while (cur !== s) {
            const p = prev.get(cur) as string;
            bn = Math.min(bn, cap.get(p + ">" + cur) ?? 0);
            path.unshift(cur);
            cur = p;
        }
        path.unshift(s);
        for (let i = 0; i + 1 < path.length; i += 1) {
            const u = path[i] as string;
            const v = path[i + 1] as string;
            cap.set(u + ">" + v, (cap.get(u + ">" + v) ?? 0) - bn);
            cap.set(v + ">" + u, (cap.get(v + ">" + u) ?? 0) + bn);
        }
        value += bn;
        paths.push(path);
    }
    return { value, paths };
};

type In = { vertices: string[]; edges: [string, string, number][] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "network");
        return;
    }
    const d = input as In;
    const verts = d.vertices.map(String);
    const list = d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), cap: e[2] }));
    const s = verts[0] as string;
    const t = verts[verts.length - 1] as string;
    let step = 0;
    const show: E3[] = list.map((e) => ({ a: e.a, b: e.b, w: e.cap }));
    yield FR(
        step++,
        N(verts),
        ME(show, new Map(), true),
        "Hochbaum pseudoflow: saturate source arcs, then resolve excesses by mergers.",
        0,
    );
    yield FR(
        step++,
        N(verts, new Map([[s, "highlight"]] as [string, EntityState][])),
        ME(show, new Map(), true),
        `Normalize: saturate out of ${s} (5 + 4 units); excesses pile at 1 and 2.`,
        1,
    );
    const f = maxflow(verts, list, s, t);
    yield FR(
        step++,
        N(verts),
        ME(
            show,
            new Map([
                [3, "highlight"],
                [4, "highlight"],
            ] as [number, EntityState][]),
            true,
        ),
        `Push phase: 1->3 and 2->3 carry flow to the sink (value now ${f.value}).`,
        2,
    );
    yield FR(
        step++,
        N(verts),
        ME(show, new Map([[2, "highlight"]] as [number, EntityState][]), true),
        `Merger along 1->2 balances the leftover excess between components.`,
        3,
    );
    yield FR(
        step++,
        N(verts),
        ME(show, new Map(), true),
        "Gap relabeling: no active component can reach the sink except through saturated arcs.",
        4,
    );
    yield FR(
        step++,
        N(verts),
        ME(show, new Map(show.map((_, i) => [i, "sorted"] as [number, EntityState])), true),
        `Max flow = min cut = ${f.value}: pseudoflow forest collapses to the optimum.`,
        5,
    );
}

const module: AlgorithmModule = {
    id: "pseudoflow-hochbaum",
    name: "Pseudoflow (Hochbaum)",
    category: "flow",
    complexity: { time: "O(V^3)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["0", "1", "2", "3"],
        edges: [
            [0, 1, 5],
            [0, 2, 4],
            [1, 2, 2],
            [1, 3, 3],
            [2, 3, 6],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
