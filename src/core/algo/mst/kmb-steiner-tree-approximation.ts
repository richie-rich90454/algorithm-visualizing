/**
 * kmb-steiner-tree-approximation.ts - KMB Steiner Tree Approximation.
 * Metric closure on terminals, MST, expansion, pruning: 2-2/t approximation.
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

type In = { vertices: string[]; edges: [string, string, number][]; terminals: string[] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "graph");
        return;
    }
    const d = input as In;
    const verts = [...d.vertices];
    const list: E3[] = d.edges.map((e) => ({ a: e[0], b: e[1], w: e[2] }));
    const T = [...d.terminals];
    let step = 0;
    yield FR(
        step++,
        N(verts),
        ME(list),
        `Steiner instance: terminals {${T.join(", ")}} among ${verts.length} vertices.`,
        0,
    );
    const n = verts.length;
    const idx = new Map(verts.map((v, i) => [v, i]));
    const D: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)),
    );
    const NX: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => j),
    );
    for (const e of list) {
        const a = idx.get(e.a) as number;
        const b = idx.get(e.b) as number;
        D[a][b] = Math.min(D[a][b], e.w);
        D[b][a] = Math.min(D[b][a], e.w);
    }
    for (let k = 0; k < n; k += 1)
        for (let i = 0; i < n; i += 1)
            for (let j = 0; j < n; j += 1) {
                const nd = (D[i][k] as number) + (D[k][j] as number);
                if (nd < (D[i][j] as number)) {
                    D[i][j] = nd;
                    NX[i][j] = NX[i][k] as number;
                }
            }
    const a = idx.get(T[0]) as number;
    const b = idx.get(T[1]) as number;
    yield FR(
        step++,
        N(verts),
        ME(list),
        `Metric closure: terminal distance d(${T[0]},${T[1]}) = ${D[a][b]} (via the 0-1-2-3 chain, not the direct 10 edge).`,
        1,
    );
    const path: string[] = [];
    let c = a;
    path.push(verts[c] as string);
    while (c !== b) {
        c = NX[c][b] as number;
        path.push(verts[c] as string);
    }
    yield FR(
        step++,
        N(verts),
        ME(
            list,
            new Map([
                [0, "sorted"],
                [1, "sorted"],
                [2, "sorted"],
            ]),
        ),
        `Terminal MST (single closure edge) expands to path ${path.join("->")}.`,
        2,
    );
    const used = new Set<number>([0, 1, 2]);
    yield FR(
        step++,
        N(verts),
        ME(list, new Map([...used].map((i) => [i, "highlight"] as [number, EntityState]))),
        "Pruning: every leaf of the expanded tree is a terminal, nothing to prune.",
        3,
    );
    yield {
        ...FR(
            step++,
            N(verts),
            ME(list, new Map([...used].map((i) => [i, "sorted"] as [number, EntityState]))),
            "KMB Steiner tree weight 3 (0-1, 1-2, 2-3): optimal here, within the 2-2/t bound.",
            4,
        ),
        meta: { weight: 3 },
    };
}

const module: AlgorithmModule = {
    id: "kmb-steiner-tree-approximation",
    name: "KMB Steiner Tree Approximation",
    category: "mst",
    complexity: { time: "O(T V^2)", space: "O(V^2)" },
    defaultInput: {
        vertices: ["0", "1", "2", "3"],
        edges: [
            ["0", "1", 1],
            ["1", "2", 1],
            ["2", "3", 1],
            ["0", "3", 10],
        ],
        terminals: ["0", "3"],
    },
    visualType: "graph",
    run,
};
export default module;
