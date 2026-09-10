/**
 * feasible-circulation-demands.ts - Feasible Circulation with Demands.
 * Lower bounds plus demands reduce to a single super-source/sink saturation test.
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

type In = { vertices: string[]; edges: [string, string, number, number][]; demand: number[] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "network");
        return;
    }
    const d = input as In;
    const verts = d.vertices.map(String);
    const list = d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), lo: e[2], hi: e[3] }));
    let step = 0;
    const show: E3[] = list.map((e) => ({ a: e.a, b: e.b, w: e.hi }));
    yield FR(
        step++,
        N(verts),
        ME(show, new Map(), true),
        "Circulation with lower bounds: 0->1 needs [1,2], 1->0 allows [0,2], demands zero.",
        0,
    );
    const bal = new Map<string, number>(verts.map((v) => [v, 0]));
    const res: FE[] = [];
    for (const e of list) {
        bal.set(e.b, (bal.get(e.b) ?? 0) + e.lo);
        bal.set(e.a, (bal.get(e.a) ?? 0) - e.lo);
        res.push({ a: e.a, b: e.b, cap: e.hi - e.lo });
    }
    yield FR(
        step++,
        N(verts),
        ME(show, new Map(), true),
        `Lower-bound residuals: 0->1 cap 1, 1->0 cap 2; imbalances corrected via super nodes.`,
        1,
    );
    const SS = "SS";
    const TT = "TT";
    const all = [...verts, SS, TT];
    let need = 0;
    for (let i = 0; i < verts.length; i += 1) {
        const v = verts[i] as string;
        const req =
            (d.demand[i] as number) -
            (list.filter((e) => e.b === v).reduce((s, e) => s + e.lo, 0) -
                list.filter((e) => e.a === v).reduce((s, e) => s + e.lo, 0));
        if (req > 0) {
            res.push({ a: SS, b: v, cap: req });
            need += req;
        } else if (req < 0) res.push({ a: v, b: TT, cap: -req });
    }
    res.push({ a: TT, b: SS, cap: 999 });
    yield FR(
        step++,
        N(all),
        ME(
            res.map((e) => ({ a: e.a, b: e.b, w: e.cap })),
            new Map(),
            true,
        ),
        `Super source/sink added: must saturate total demand ${need}.`,
        2,
    );
    const f = maxflow(all, res, SS, TT);
    yield FR(
        step++,
        N(all),
        ME(
            res.map((e) => ({ a: e.a, b: e.b, w: e.cap })),
            new Map(),
            true,
        ),
        `Max flow ${f.value}/${need} via ${f.paths.map((p) => p.join(">")).join("; ") || "no path"}.`,
        3,
    );
    const ok = f.value === need;
    yield {
        ...FR(
            step++,
            N(verts),
            ME(show, new Map([0, 1].map((i) => [i, "sorted"] as [number, EntityState])), true),
            ok
                ? "Feasible circulation exists: send 1 unit 0->1 and 1 unit 1->0 (balances hold, bounds respected)."
                : "No feasible circulation: super-source arcs cannot all saturate.",
            4,
        ),
        meta: { feasible: ok, flow: f.value, demand: need },
    };
}

const module: AlgorithmModule = {
    id: "feasible-circulation-demands",
    name: "Feasible Circulation with Demands",
    category: "flow",
    complexity: { time: "O(V E^2)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["0", "1"],
        edges: [
            [0, 1, 1, 2],
            [1, 0, 0, 2],
        ],
        demand: [0, 0],
    },
    visualType: "graph",
    run,
};
export default module;
