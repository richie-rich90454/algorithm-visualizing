/**
 * reverse-delete-mst.ts – Reverse-Delete MST.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Reverse-Delete starts from the full graph and removes edges from heaviest
 * to lightest. An edge is deleted when its endpoints stay connected without
 * it; otherwise it is a bridge and must be kept. The edges that survive form
 * a minimum spanning tree.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E^2) – each removal test runs a connectivity search
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The edge under test is YELLOW (comparing).
 *   - A deleted edge flashes RED (swapped).
 *   - A kept bridge is highlighted, final MST edges are GREEN (sorted).
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
const connected = (verts: string[], edges: E3[]): boolean => {
    if (verts.length === 0) return true;
    const adj = new Map<string, string[]>();
    for (const v of verts) adj.set(v, []);
    for (const e of edges) {
        adj.get(e.a)?.push(e.b);
        adj.get(e.b)?.push(e.a);
    }
    const first = verts[0] as string;
    const seen = new Set<string>([first]);
    const q: string[] = [first];
    while (q.length > 0) {
        const u = q.pop() as string;
        for (const nb of adj.get(u) ?? [])
            if (!seen.has(nb)) {
                seen.add(nb);
                q.push(nb);
            }
    }
    return seen.size === verts.length;
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
            `Reverse-Delete on ${verts.length} vertices, ${list.length} edges — heaviest edge examined first.`,
            0,
        ),
        meta: { kept: list.length, removed: 0, accepted: list.length, totalWeight: 0 },
    };
    const order = list.map((_, i) => i).sort((x, y) => (list[y] as E3).w - (list[x] as E3).w);
    const kept = new Set<number>(list.map((_, i) => i));
    for (const idx of order) {
        const e = list[idx] as E3;
        const rest = [...kept].filter((i) => i !== idx).map((i) => list[i] as E3);
        if (connected(verts, rest)) {
            kept.delete(idx);
            yield {
                ...FR(
                    step++,
                    N(verts),
                    ME(list, new Map([[idx, "swapped"]])),
                    `Removing ${e.a}–${e.b} (weight ${e.w}): endpoints stay connected without it.`,
                    3,
                ),
                meta: {
                    kept: kept.size,
                    removed: list.length - kept.size,
                    accepted: kept.size,
                    totalWeight: 0,
                },
            };
        } else {
            yield {
                ...FR(
                    step++,
                    N(verts),
                    ME(list, new Map([[idx, "highlight"]])),
                    `Keeping ${e.a}–${e.b} (weight ${e.w}): it is a bridge, removal would disconnect the graph.`,
                    4,
                ),
                meta: {
                    kept: kept.size,
                    removed: list.length - kept.size,
                    accepted: kept.size,
                    totalWeight: 0,
                },
            };
        }
    }
    const mst = [...kept].map((i) => list[i] as E3);
    const weight = mst.reduce((s, e) => s + e.w, 0);
    const fin = new Map<number, EntityState>();
    for (const i of kept) fin.set(i, "sorted");
    const allV = new Map<string, EntityState>();
    for (const v of verts) allV.set(v, "visited");
    yield {
        ...FR(
            step++,
            N(verts, allV),
            ME(list, fin),
            `Reverse-Delete MST weight ${weight}, total weight ${weight}: ${mst.map((e) => `${e.a}–${e.b}(${e.w})`).join(", ")}.`,
            5,
        ),
        meta: { weight, totalWeight: weight, kept: kept.size, accepted: kept.size },
    };
}

const module: AlgorithmModule = {
    id: "reverse-delete-mst",
    name: "Reverse-Delete MST",
    category: "mst",
    complexity: { time: "O(E^2)", space: "O(V + E)" },
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
        "start with every edge kept as a candidate",
        "sort all edges by decreasing weight",
        "for each edge u–v from heaviest to lightest: test it",
        "if u and v stay connected without it: delete the edge",
        "else keep the edge because it is a bridge",
        "done: surviving edges form the MST with minimum total weight",
    ],
};
export default module;
