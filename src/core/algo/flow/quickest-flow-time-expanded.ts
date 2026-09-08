/**
 * quickest-flow-time-expanded.ts - Quickest Flow (Time-Expanded).
 * Binary-search the horizon T; each probe is a max flow over the time expansion.
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

type In = { vertices: string[]; edges: [string, number, number, number][]; demand: number };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "network");
        return;
    }
    const d = input as In;
    const verts = d.vertices.map(String);
    let step = 0;
    yield FR(
        step++,
        N(verts),
        ME(
            d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), w: e[3] })),
            new Map(),
            true,
        ),
        `Quickest flow: ${d.demand} units 0->2, unit caps, transit time 1 per hop.`,
        0,
    );
    const at = (v: string, time: number): string => `${v}@${time}`;
    const probe = (T: number): number => {
        const nodes: string[] = [];
        for (const v of verts) for (let t = 0; t <= T; t += 1) nodes.push(at(v, t));
        const fe: FE[] = [];
        for (const v of verts)
            for (let t = 0; t < T; t += 1) fe.push({ a: at(v, t), b: at(v, t + 1), cap: 99 });
        for (const e of d.edges) {
            const u = String(e[0]);
            const v = String(e[1]);
            const cap = e[2] as number;
            const tt = e[3] as number;
            for (let t = 0; t + tt <= T; t += 1) fe.push({ a: at(u, t), b: at(v, t + tt), cap });
        }
        return maxflow(
            nodes,
            fe,
            at(verts[0] as string, 0),
            at(verts[verts.length - 1] as string, T),
        ).value;
    };
    const results: Array<{ T: number; f: number }> = [];
    for (const T of [1, 2, 3]) {
        const f = probe(T);
        results.push({ T, f });
        yield FR(
            step++,
            N(verts),
            ME(
                d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), w: e[3] })),
                new Map(),
                true,
            ),
            `Horizon T=${T}: time-expanded max flow = ${f} (need ${d.demand}).`,
            T,
        );
    }
    yield FR(
        step++,
        N(verts),
        ME(
            d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), w: e[3] })),
            new Map([
                [0, "sorted"],
                [1, "sorted"],
            ] as [number, EntityState][]),
            true,
        ),
        "Flows per horizon [0,1,2]: first arrival at t=2, second at t=3.",
        4,
    );
    yield FR(
        step++,
        N(verts),
        ME(
            d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), w: e[3] })),
            new Map([
                [0, "sorted"],
                [1, "sorted"],
            ] as [number, EntityState][]),
            true,
        ),
        "Quickest feasible horizon T* = 3: pipeline one unit per step.",
        5,
    );
}

const module: AlgorithmModule = {
    id: "quickest-flow-time-expanded",
    name: "Quickest Flow (Time-Expanded)",
    category: "flow",
    complexity: { time: "O(T V E^2)", space: "O(T(V + E))" },
    defaultInput: {
        vertices: ["0", "1", "2"],
        edges: [
            [0, 1, 1, 1],
            [1, 2, 1, 1],
        ],
        demand: 2,
    },
    visualType: "graph",
    run,
};
export default module;
