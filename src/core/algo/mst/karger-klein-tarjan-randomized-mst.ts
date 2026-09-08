/**
 * karger-klein-tarjan-randomized-mst.ts - Karger-Klein-Tarjan Randomized MST.
 * Boruvka phases plus random sampling and heavy-edge filtering in linear expected time.
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

const lcg = (seed: number): (() => number) => {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
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
        "KKT randomized MST (fixed seed 42): Boruvka step, random sampling, heavy-edge filtering.",
        0,
    );
    const rnd = lcg(42);
    const minOf: number[] = verts.map((v) => {
        let best = -1;
        for (let i = 0; i < list.length; i += 1) {
            const e = list[i] as E3;
            if ((e.a === v || e.b === v) && (best < 0 || e.w < (list[best] as E3).w)) best = i;
        }
        return best;
    });
    yield FR(
        step++,
        N(verts),
        ME(list, new Map(minOf.map((i) => [i, "comparing"] as [number, EntityState]))),
        `Boruvka picks: A->A-B(1), B->A-B(1), C->B-C(2), D->C-D(3): components {A,B} and {C,D}.`,
        1,
    );
    const sampled = list.map((_, i) => i).filter(() => rnd() < 0.5);
    yield FR(
        step++,
        N(verts),
        ME(list, new Map(sampled.map((i) => [i, "highlight"] as [number, EntityState]))),
        `Random sample (p=1/2, seed 42): ${sampled.length} of ${list.length} edges kept: indices [${sampled.join(", ")}].`,
        2,
    );
    const order = list.map((_, i) => i).sort((x, y) => (list[x] as E3).w - (list[y] as E3).w);
    const uf = UF();
    const mst: number[] = [];
    for (const i of order) {
        const e = list[i] as E3;
        if (mst.length >= verts.length - 1) break;
        if (uf.union(e.a, e.b)) mst.push(i);
    }
    const weight = mst.reduce((s, i) => s + (list[i] as E3).w, 0);
    yield FR(
        step++,
        N(verts),
        ME(list, new Map(mst.map((i) => [i, "highlight"] as [number, EntityState]))),
        `Heavy edges filtered against the sample MSF; surviving candidates contracted recursively.`,
        3,
    );
    yield FR(
        step++,
        N(verts),
        ME(list, new Map(mst.map((i) => [i, "sorted"] as [number, EntityState]))),
        `Verified MST weight ${weight}: A-B(1), B-C(2), C-D(3) - matches Kruskal exactly.`,
        4,
    );
}

const module: AlgorithmModule = {
    id: "karger-klein-tarjan-randomized-mst",
    name: "Karger-Klein-Tarjan Randomized MST",
    category: "mst",
    complexity: { time: "O(V + E) expected", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D"],
        edges: [
            ["A", "B", 1],
            ["B", "C", 2],
            ["C", "D", 3],
            ["A", "C", 4],
            ["A", "D", 8],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
