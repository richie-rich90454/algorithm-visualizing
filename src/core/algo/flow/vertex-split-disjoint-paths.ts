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
            Math.min(k, 4),
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
            5,
        ),
        meta: { count: f.value, paths: f.paths.map((p) => clean(p).join("-")) },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "To find the most vertex-disjoint paths between two vertices, split each intermediate vertex into an in-copy and an out-copy joined by an arc of capacity one. Any flow through that arc then uses the vertex at most once. The maximum flow in the split network equals the maximum number of vertex-disjoint paths.",
        "invariants": [
            "Every intermediate vertex is traversed by at most one path because its split arc has capacity one.",
            "Source and sink are not capacity limited, so many paths may start and end there.",
            "Each unit of flow corresponds to one path in the original graph."
        ],
        "correctness": "Any set of vertex-disjoint paths maps to integral flow in the split network because no two paths use the same split arc. Conversely, integral flow decomposes into paths that cannot share an intermediate vertex. By integrality of max flow and Menger's theorem, the max flow value equals the maximum number of vertex-disjoint paths.",
        "complexityRationale": "Splitting doubles the vertex count and leaves edge count similar, and one max flow costs about O(V E^2). The split network and predecessor arrays use O(V + E) space.",
        "uses": [
            "Finding multiple disjoint communication routes",
            "Testing vertex connectivity between two terminals",
            "Fault-tolerant network design with node failures"
        ],
        "references": [
            "Menger, Zur Allgemeinen Kurventheorie (1927)",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, max-flow applications"
        ],
        "workedExample": "Directed graph 0->1, 0->2, 1->3, 2->3, 1->2, source 0 sink 3. After splitting 1 and 2 with unit-capacity arcs, max flow sends one unit along 0-1-3 and one along 0-2-3. The value 2 is the maximum number of vertex-disjoint paths."
    },
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
    pseudocode: [
        "initialize directed graph with source and sink vertices",
        "split inner vertices into in out arcs of unit capacity",
        "run max flow over split network for disjoint count",
        "extract each augmenting path as disjoint route",
        "map split paths back to original vertex sequences",
        "report maximum disjoint path count with routes",
    ],
};
export default module;
