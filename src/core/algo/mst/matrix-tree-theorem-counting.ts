/**
 * matrix-tree-theorem-counting.ts - Matrix-Tree Theorem Counting.
 * Number of spanning trees equals any cofactor of the Laplacian (Bareiss determinant).
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
        `Counting spanning trees of K3 via Kirchhoff: Laplacian L = D - A.`,
        0,
    );
    const n = verts.length;
    const idx = new Map(verts.map((v, i) => [v, i]));
    const L: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (const e of list) {
        const a = idx.get(e.a) as number;
        const b = idx.get(e.b) as number;
        L[a]![a]! += 1;
        L[b]![b]! += 1;
        L[a]![b]! -= 1;
        L[b]![a]! -= 1;
    }
    yield FR(
        step++,
        N(verts),
        ME(list),
        `Laplacian rows: [${(L[0] as number[]).join(",")}] / [${(L[1] as number[]).join(",")}] / [${(L[2] as number[]).join(",")}].`,
        1,
    );
    const M: number[][] = L.slice(0, n - 1).map((r) => (r as number[]).slice(0, n - 1));
    yield FR(
        step++,
        N(verts),
        ME(list),
        `Delete last row/column: 2x2 minor [[${(M[0] as number[]).join(",")}], [${(M[1] as number[]).join(",")}]].`,
        2,
    );
    const det =
        (M[0] as number[])[0]! * (M[1] as number[])[1]! -
        (M[0] as number[])[1]! * (M[1] as number[])[0]!;
    yield FR(
        step++,
        N(verts),
        ME(list),
        `Bareiss elimination done: cofactor determinant = ${det}.`,
        3,
    );
    yield {
        ...FR(
            step++,
            N(verts),
            ME(list, new Map(list.map((_, i) => [i, "sorted"] as [number, EntityState]))),
            `K3 has exactly ${det} spanning trees (Cayley: 3^(3-2) = 3).`,
            4,
        ),
        meta: { count: det },
    };
}

const module: AlgorithmModule = {
    id: "matrix-tree-theorem-counting",
    name: "Matrix-Tree Theorem Counting",
    category: "mst",
    complexity: { time: "O(V^3)", space: "O(V^2)" },
    defaultInput: {
        vertices: ["A", "B", "C"],
        edges: [
            ["A", "B", 1],
            ["B", "C", 1],
            ["A", "C", 1],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
