/**
 * minimum-bottleneck-spanning-tree.ts – Minimum Bottleneck Spanning Tree.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A minimum bottleneck spanning tree minimizes the largest edge weight rather
 * than the total weight. Every MST is also a minimum bottleneck tree, so this
 * demo runs Kruskal's greedy scan and tracks the maximum edge accepted. That
 * maximum is the smallest bottleneck any spanning tree can achieve.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log E) – dominated by sorting the edges
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The edge under test is YELLOW (comparing).
 *   - An accepted edge turns GREEN (sorted).
 *   - The final tree is GREEN (sorted) with the bottleneck noted.
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
    yield {
        ...FR(
            step++,
            N(verts),
            ME(list),
            `Minimum bottleneck search on ${verts.length} vertices, ${list.length} edges — Kruskal order minimizes the largest edge.`,
            0,
        ),
        meta: { accepted: 0, totalWeight: 0, bottleneck: 0 },
    };
    const order = list.map((_, i) => i).sort((x, y) => (list[x] as E3).w - (list[y] as E3).w);
    const uf = UF();
    const mst: number[] = [];
    let bottleneck = 0;
    for (const idx of order) {
        const e = list[idx] as E3;
        if (mst.length >= verts.length - 1) break;
        if (uf.union(e.a, e.b)) {
            mst.push(idx);
            bottleneck = Math.max(bottleneck, e.w);
            yield {
                ...FR(
                    step++,
                    N(verts),
                    ME(list, new Map(mst.map((i) => [i, "sorted"] as [number, EntityState]))),
                    `Adding ${e.a}–${e.b} (weight ${e.w}) to the MST; bottleneck so far ${bottleneck}.`,
                    2,
                ),
                meta: {
                    accepted: mst.length,
                    totalWeight: mst.reduce((s, i) => s + (list[i] as E3).w, 0),
                    bottleneck,
                },
            };
        }
    }
    const weight = mst.reduce((s, i) => s + (list[i] as E3).w, 0);
    yield {
        ...FR(
            step++,
            N(verts),
            ME(list, new Map(mst.map((i) => [i, "sorted"] as [number, EntityState]))),
            `Minimum bottleneck tree weight ${weight}, bottleneck ${bottleneck}: ${mst.map((i) => `${(list[i] as E3).a}–${(list[i] as E3).b}(${(list[i] as E3).w})`).join(", ")}.`,
            5,
        ),
        meta: { weight, totalWeight: weight, accepted: mst.length, bottleneck },
    };
}

const module: AlgorithmModule = {
    id: "minimum-bottleneck-spanning-tree",
    name: "Minimum Bottleneck Spanning Tree",
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
    },
    visualType: "graph",
    run,
    pseudocode: [
        "sort all edges by increasing weight for Kruskal order",
        "walk the sorted edges and track the largest edge used",
        "if endpoints differ: add the edge to the tree set",
        "skip the edge when it would form a cycle",
        "update the bottleneck to the maximum edge accepted",
        "done: tree edges give minimum bottleneck and total weight",
    ],
};
export default module;
