/**
 * vertex-split-disjoint-paths.ts - Vertex-Split Disjoint Paths.
 * Split every vertex into in/out with unit capacity: max flow counts disjoint paths.
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

type In = { vertices: string[]; edges: [number, number][] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "digraph");
        return;
    }
    const d = input as In;
    const verts = d.vertices.map(String);
    const s = verts[0] as string;
    const t = verts[verts.length - 1] as string;
    let step = 0;
    const show: E3[] = d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), w: 1 }));
    yield FR(
        step++,
        N(verts),
        ME(show, new Map(), true),
        `Vertex-disjoint ${s}->${t} paths: splitting makes sharing a vertex impossible.`,
        0,
    );
    const fe: FE[] = [];
    for (const v of verts) {
        if (v !== s && v !== t) fe.push({ a: v + "_in", b: v + "_out", cap: 1 });
    }
    const io = (v: string, end: string): string => (v === s || v === t ? v : v + end);
    for (const e of d.edges)
        fe.push({ a: io(String(e[0]), "_out"), b: io(String(e[1]), "_in"), cap: 99 });
    const splitLabels = fe.length > 0 ? [...new Set(fe.flatMap((e) => [e.a, e.b]))] : [];
    yield FR(
        step++,
        N(splitLabels),
        ME(
            fe.map((e) => ({ a: e.a, b: e.b, w: e.cap })),
            new Map(),
            true,
        ),
        `Split network: ${verts.filter((v) => v !== s && v !== t).join(", ")} become in->out unit arcs.`,
        1,
    );
    const f = maxflow(splitLabels, fe, s, t);
    const clean = (p: string[]): string[] =>
        p
            .map((x) => x.replace("_in", "").replace("_out", ""))
            .filter((x, i, a) => i === 0 || x !== a[i - 1]);
    let k = 2;
    for (const p of f.paths) {
        yield FR(
            step++,
            N(verts),
            ME(show, new Map(), true),
            `Disjoint path ${k - 1}: ${clean(p).join("->")}.`,
            k,
        );
        k += 1;
        if (step > 11) break;
    }
    yield {
        ...FR(
            step++,
            N(verts),
            ME(show, new Map(), true),
            `Maximum ${f.value} vertex-disjoint paths: 0-1-3 and 0-2-3.`,
            k,
        ),
        meta: { count: f.value, paths: f.paths.map((p) => clean(p).join("-")) },
    };
}

const module: AlgorithmModule = {
    id: "vertex-split-disjoint-paths",
    name: "Vertex-Split Disjoint Paths",
    category: "flow",
    complexity: { time: "O(V E^2)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["0", "1", "2", "3"],
        edges: [
            [0, 1],
            [0, 2],
            [1, 3],
            [2, 3],
            [1, 2],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
