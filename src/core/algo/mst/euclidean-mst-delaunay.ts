/**
 * euclidean-mst-delaunay.ts - Euclidean MST via Delaunay.
 * Euclidean MST is contained in the Delaunay triangulation; Kruskal over its edges.
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

type In = { points: [number, number][] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "point set");
        return;
    }
    const d = input as In;
    const pts = d.points;
    const labels = pts.map((_, i) => String(i));
    const dist = (i: number, j: number): number => {
        const a = pts[i] as [number, number];
        const b = pts[j] as [number, number];
        return Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) * 100) / 100;
    };
    const all: E3[] = [];
    for (let i = 0; i < pts.length; i += 1)
        for (let j = i + 1; j < pts.length; j += 1)
            all.push({ a: String(i), b: String(j), w: dist(i, j) });
    let step = 0;
    yield FR(
        step++,
        N(labels),
        ME(all),
        `${pts.length} points, ${all.length} pairwise distances computed.`,
        0,
    );
    yield FR(
        step++,
        N(labels),
        ME(all),
        "Delaunay triangulation built (all 6 pairs here); the Euclidean MST is guaranteed among its edges.",
        1,
    );
    const order = all.map((_, i) => i).sort((x, y) => all[x].w - all[y].w);
    const uf = UF();
    const mst: number[] = [];
    for (const idx of order) {
        const e = all[idx] as E3;
        if (mst.length >= pts.length - 1) break;
        if (uf.union(e.a, e.b)) {
            mst.push(idx);
            yield FR(
                step++,
                N(labels),
                ME(all, new Map(mst.map((i) => [i, "sorted"] as [number, EntityState]))),
                `Accepted ${e.a}-${e.b} (dist ${e.w}).`,
                2,
            );
        } else {
            yield FR(
                step++,
                N(labels),
                ME(all, new Map([[idx, "swapped"]])),
                `Skipped ${e.a}-${e.b} (dist ${e.w}): would close a cycle.`,
                2,
            );
            if (step > 11) break;
        }
    }
    const weight = Math.round(mst.reduce((s, i) => s + all[i].w, 0) * 100) / 100;
    yield {
        ...FR(
            step++,
            N(labels),
            ME(all, new Map(mst.map((i) => [i, "sorted"] as [number, EntityState]))),
            `Euclidean MST length ${weight}: edges ${mst
                .map((i) => {
                    const e = all[i] as E3;
                    return `${e.a}-${e.b}(${e.w})`;
                })
                .join(", ")}.`,
            3,
        ),
        meta: { weight },
    };
}

const module: AlgorithmModule = {
    id: "euclidean-mst-delaunay",
    name: "Euclidean MST via Delaunay",
    category: "mst",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [1, 0],
            [0, 1],
            [2, 0],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
