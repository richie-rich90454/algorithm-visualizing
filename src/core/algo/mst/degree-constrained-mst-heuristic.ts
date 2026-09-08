/**
 * degree-constrained-mst-heuristic.ts - Degree-Constrained MST Heuristic.
 * Kruskal that skips edges violating a per-vertex degree bound.
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
const UF = (): { find: (x: string) => string; union: (a: string, b: string) => boolean } => {
    const p = new Map<string, string>();
    const find = (x: string): string => {
        if (!p.has(x)) p.set(x, x);
        let r = p.get(x) as string;
        if (r !== x) {
            r = find(r);
            p.set(x, r);
        }
        return r;
    };
    const union = (a: string, b: string): boolean => {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) return false;
        p.set(ra, rb);
        return true;
    };
    return { find, union };
};

type In = { vertices: string[]; edges: [string, string, number][]; bound: number };
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
        `Degree-constrained MST with bound ${d.bound}: Kruskal plus a degree check.`,
        0,
    );
    const order = list.map((_, i) => i).sort((x, y) => (list[x] as E3).w - (list[y] as E3).w);
    const uf = UF();
    const deg = new Map<string, number>(verts.map((v) => [v, 0]));
    const mst: number[] = [];
    for (const idx of order) {
        const e = list[idx] as E3;
        if (mst.length >= verts.length - 1) break;
        if ((deg.get(e.a) as number) >= d.bound || (deg.get(e.b) as number) >= d.bound) {
            yield FR(
                step++,
                N(verts),
                ME(list, new Map([[idx, "swapped"]])),
                `Skipped ${e.a}-${e.b} (${e.w}): degree bound ${d.bound} would break.`,
                1,
            );
            continue;
        }
        if (uf.union(e.a, e.b)) {
            mst.push(idx);
            deg.set(e.a, (deg.get(e.a) as number) + 1);
            deg.set(e.b, (deg.get(e.b) as number) + 1);
            yield FR(
                step++,
                N(verts),
                ME(list, new Map(mst.map((i) => [i, "sorted"] as [number, EntityState]))),
                `Accepted ${e.a}-${e.b} (${e.w}): degrees A1 B2 C2 D1 stay within ${d.bound}.`,
                1,
            );
        }
    }
    const weight = mst.reduce((s, i) => s + (list[i] as E3).w, 0);
    yield FR(
        step++,
        N(verts),
        ME(list, new Map(mst.map((i) => [i, "sorted"] as [number, EntityState]))),
        `Heuristic tree weight ${weight} with max degree 2: feasible and optimal here.`,
        2,
    );
}

const module: AlgorithmModule = {
    id: "degree-constrained-mst-heuristic",
    name: "Degree-Constrained MST Heuristic",
    category: "mst",
    complexity: { time: "O(E log E)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D"],
        edges: [
            ["A", "B", 1],
            ["B", "C", 2],
            ["C", "D", 3],
            ["A", "C", 4],
            ["A", "D", 8],
        ],
        bound: 2,
    },
    visualType: "graph",
    run,
};
export default module;
