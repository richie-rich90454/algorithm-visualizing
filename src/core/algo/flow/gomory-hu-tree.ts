/**
 * gomory-hu-tree.ts - Gomory-Hu Tree.
 * All-pairs min cuts compressed into one tree: MaxST over exact pairwise mincut values.
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
        yield EMPTY(0, "graph");
        return;
    }
    const d = input as In;
    const verts = d.vertices.map(String);
    const list: E3[] = d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), w: e[2] }));
    let step = 0;
    yield FR(
        step++,
        N(verts),
        ME(list),
        `Gomory-Hu on ${verts.length} vertices: ${(verts.length * (verts.length - 1)) / 2} pairwise min cuts, one cut tree.`,
        0,
    );
    const dir: FE[] = [];
    for (const e of list) {
        dir.push({ a: e.a, b: e.b, cap: e.w });
        dir.push({ a: e.b, b: e.a, cap: e.w });
    }
    const cutOf = (u: string, v: string): number => maxflow(verts, dir, u, v).value;
    const pairs: Array<{ u: string; v: string; c: number }> = [];
    for (let i = 0; i < verts.length; i += 1)
        for (let j = i + 1; j < verts.length; j += 1)
            pairs.push({
                u: verts[i] as string,
                v: verts[j] as string,
                c: cutOf(verts[i] as string, verts[j] as string),
            });
    yield FR(
        step++,
        N(verts),
        ME(list),
        `Pairwise cuts (1/2): ${pairs
            .slice(0, 3)
            .map((p) => `(${p.u},${p.v})=${p.c}`)
            .join(", ")}.`,
        1,
    );
    yield FR(
        step++,
        N(verts),
        ME(list),
        `Pairwise cuts (2/2): ${pairs
            .slice(3)
            .map((p) => `(${p.u},${p.v})=${p.c}`)
            .join(", ")}.`,
        1,
    );
    const order = [...pairs].sort((a, b) => b.c - a.c);
    const par = new Map<string, string>(verts.map((v) => [v, v]));
    const find = (x: string): string => {
        const r = par.get(x) as string;
        if (r === x) return x;
        const rr = find(r);
        par.set(x, rr);
        return rr;
    };
    const tree: E3[] = [];
    for (const p of order) {
        if (tree.length >= verts.length - 1) break;
        if (find(p.u) !== find(p.v)) {
            par.set(find(p.u), find(p.v));
            tree.push({ a: p.u, b: p.v, w: p.c });
        }
    }
    for (const t of tree)
        yield FR(
            step++,
            N(verts),
            ME(
                tree,
                new Map(tree.map((e) => [tree.indexOf(e), "sorted"] as [number, EntityState])),
            ),
            `Tree edge ${t.a}-${t.b} (${t.w}): maximum spanning step over cut values.`,
            2,
        );
    const wsum = tree.reduce((s, e) => s + e.w, 0);
    yield FR(
        step++,
        N(verts),
        ME(tree, new Map(tree.map((_, i) => [i, "sorted"] as [number, EntityState]))),
        `Gomory-Hu tree (weight ${wsum}): every pair's min cut equals the bottleneck on its tree path.`,
        3,
    );
}

const module: AlgorithmModule = {
    id: "gomory-hu-tree",
    name: "Gomory-Hu Tree",
    category: "flow",
    complexity: { time: "O(V E^2)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["0", "1", "2", "3"],
        edges: [
            [0, 1, 3],
            [1, 2, 2],
            [2, 3, 4],
            [0, 2, 1],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
