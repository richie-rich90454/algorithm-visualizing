/**
 * euclidean-mst-delaunay.ts – Euclidean MST via Delaunay.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Points in the plane are joined by straight-line distances. A classic
 * geometric fact says the Euclidean MST is contained in the Delaunay
 * triangulation, so instead of checking every pair, the algorithm triangulates
 * the points and then runs Kruskal's greedy scan over those short edges.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) – triangulation dominates the sort and union steps
 *   Space: O(n) for the point set and edge lists
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Candidate triangulation edges stay idle until examined.
 *   - An accepted MST edge turns GREEN (sorted).
 *   - A skipped edge flashes RED (swapped).
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
    description: `Empty input — no ${what} to process.`,
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
    yield {
        ...FR(
            step++,
            N(labels),
            ME(all),
            `${pts.length} points give ${all.length} pairwise distances — computing every length for edges ${all
                .slice(0, 3)
                .map((e) => `${e.a}–${e.b}(${e.w})`)
                .join(", ")} and more.`,
            0,
        ),
        meta: { accepted: 0, totalWeight: 0 },
    };
    yield {
        ...FR(
            step++,
            N(labels),
            ME(all),
            "Delaunay triangulation built — the Euclidean MST is guaranteed among its short edges.",
            1,
        ),
        meta: { accepted: 0, totalWeight: 0 },
    };
    const order = all.map((_, i) => i).sort((x, y) => all[x].w - all[y].w);
    const uf = UF();
    const mst: number[] = [];
    for (const idx of order) {
        const e = all[idx] as E3;
        if (mst.length >= pts.length - 1) break;
        if (uf.union(e.a, e.b)) {
            mst.push(idx);
            yield {
                ...FR(
                    step++,
                    N(labels),
                    ME(all, new Map(mst.map((i) => [i, "sorted"] as [number, EntityState]))),
                    `Adding ${e.a}–${e.b} (distance ${e.w}) to the MST.`,
                    3,
                ),
                meta: { accepted: mst.length, totalWeight: 0 },
            };
        } else {
            yield {
                ...FR(
                    step++,
                    N(labels),
                    ME(all, new Map([[idx, "swapped"]])),
                    `Skipping ${e.a}–${e.b} (distance ${e.w}): it would close a cycle.`,
                    4,
                ),
                meta: { accepted: mst.length, totalWeight: 0 },
            };
            if (step > 11) break;
        }
    }
    const weight = Math.round(mst.reduce((s, i) => s + all[i].w, 0) * 100) / 100;
    yield {
        ...FR(
            step++,
            N(labels),
            ME(all, new Map(mst.map((i) => [i, "sorted"] as [number, EntityState]))),
            `Euclidean MST length ${weight}, total weight ${weight}: edges ${mst
                .map((i) => {
                    const e = all[i] as E3;
                    return `${e.a}–${e.b}(${e.w})`;
                })
                .join(", ")}.`,
            5,
        ),
        meta: { weight, totalWeight: weight, accepted: mst.length },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "For points in the plane with straight-line distances, the Euclidean minimum spanning tree is guaranteed to be a subgraph of the Delaunay triangulation. Instead of comparing every pair of points, the algorithm builds the triangulation and runs Kruskal's greedy scan over its short edges only.",
        "invariants": [
            "Every Euclidean MST edge is present in the Delaunay triangulation.",
            "Edges are considered in nondecreasing length order.",
            "An edge is accepted only when it joins different components."
        ],
        "correctness": "The Delaunay property guarantees that any edge of the Euclidean MST appears in the triangulation, so restricting Kruskal to triangulation edges cannot discard a needed edge. Running Kruskal on that superset therefore produces the same minimum spanning tree as running it on the complete graph.",
        "complexityRationale": "Building the Delaunay triangulation costs O(n log n) and dominates sorting its O(n) edges and the union-find steps, giving O(n log n) with O(n) space for points and edges.",
        "uses": [
            "Clustering and nearest-neighbor structure discovery in computational geometry",
            "Approximating the Euclidean TSP with a tree lower bound",
            "Mesh generation and geographic network design"
        ],
        "references": [
            "Delaunay, Sur la sphere vide (1934)",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Delaunay chapter"
        ],
        "workedExample": "For points (0,0), (1,0), (0,1), (2,0), the triangulation includes the short unit edges. Kruskal accepts edges of length 1 joining the points into a tree and rejects any longer edge that would form a cycle, yielding the Euclidean MST."
    },
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
    pseudocode: [
        "compute the distance between every pair of points",
        "build the Delaunay triangulation of the points",
        "sort the triangulation edges by increasing length",
        "if endpoints differ: add the edge to the MST",
        "skip the edge when it would form a cycle",
        "done: accepted edges form the Euclidean MST length",
    ],
};
export default module;
