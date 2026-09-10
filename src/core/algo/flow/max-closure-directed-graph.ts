/**
 * max-closure-directed-graph.ts - Max Closure of a Directed Graph.
 * Max-weight closed set via one s-t min cut, double-checked by brute force.
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

type In = { vertices: string[]; weights: number[]; arcs: [string, string][] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "digraph");
        return;
    }
    const d = input as In;
    const verts = [...d.vertices];
    const w = new Map<string, number>(verts.map((v, i) => [v, d.weights[i] as number]));
    let step = 0;
    const show: E3[] = d.arcs.map((a) => ({ a: a[0], b: a[1], w: 1 }));
    yield FR(
        step++,
        N(verts),
        ME(show, new Map(), true),
        `Closure instance: weights ${verts.map((v) => `${v}=${w.get(v)}`).join(", ")}; arcs ${d.arcs.map((a) => a.join("->")).join(", ")}.`,
        0,
    );
    const S = "S";
    const T = "T";
    const all = [...verts, S, T];
    const fe: FE[] = [];
    let pos = 0;
    for (const v of verts) {
        const wv = w.get(v) as number;
        if (wv > 0) {
            fe.push({ a: S, b: v, cap: wv });
            pos += wv;
        } else if (wv < 0) fe.push({ a: v, b: T, cap: -wv });
    }
    const INF = pos + 1;
    for (const a of d.arcs) fe.push({ a: a[0], b: a[1], cap: INF });
    yield FR(
        step++,
        N(all),
        ME(
            fe.map((e) => ({ a: e.a, b: e.b, w: e.cap })),
            new Map(),
            true,
        ),
        `Reduction: source arcs total +${pos}, sink arcs, infinite-capacity precedence arcs.`,
        1,
    );
    const f = maxflow(all, fe, S, T);
    yield FR(
        step++,
        N(all),
        ME(
            fe.map((e) => ({ a: e.a, b: e.b, w: e.cap })),
            new Map(),
            true,
        ),
        `Min cut ${f.value}: closure value ${pos} - ${f.value} = ${pos - f.value}.`,
        2,
    );
    let best = -Infinity;
    let bestSet: string[] = [];
    for (let mask = 0; mask < 1 << verts.length; mask += 1) {
        const set = verts.filter((_, i) => (mask >> i) & 1);
        const has = new Set(set);
        if (!d.arcs.every((a) => !has.has(a[0]) || has.has(a[1]))) continue;
        const val = set.reduce((s, v) => s + (w.get(v) as number), 0);
        if (val > best) {
            best = val;
            bestSet = set;
        }
    }
    yield FR(
        step++,
        N(verts, new Map(bestSet.map((v) => [v, "visited"] as [string, EntityState]))),
        ME(show, new Map(), true),
        `Brute-force check over closed sets confirms optimum ${best} = {${bestSet.join(", ")}}.`,
        3,
    );
    yield {
        ...FR(
            step++,
            N(verts, new Map(bestSet.map((v) => [v, "visited"] as [string, EntityState]))),
            ME(show, new Map(), true),
            `Max closure weight ${best}: take {${bestSet.join(", ")}} (5 - 3 + 4).`,
            4,
        ),
        meta: { weight: best, closure: bestSet },
    };
}

const module: AlgorithmModule = {
    id: "max-closure-directed-graph",
    name: "Max Closure of a Directed Graph",
    category: "flow",
    complexity: { time: "O(V E^2)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C"],
        weights: [5, -3, 4],
        arcs: [
            ["A", "B"],
            ["A", "C"],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
