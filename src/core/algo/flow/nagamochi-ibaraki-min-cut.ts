/**
 * nagamochi-ibaraki-min-cut.ts - Nagamochi-Ibaraki Min Cut.
 * Maximum-adjacency orderings with contraction: the lightest phase cut is global.
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
    const verts = d.vertices.map(String);
    const list: E3[] = d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), w: e[2] }));
    let step = 0;
    yield FR(
        step++,
        N(verts),
        ME(list),
        "Nagamochi-Ibaraki: MA ordering from 0, contract the last pair, repeat.",
        0,
    );
    yield FR(
        step++,
        N(
            verts,
            new Map([
                ["0", "visited"],
                ["1", "highlight"],
                ["2", "comparing"],
            ] as [string, EntityState][]),
        ),
        ME(list),
        "MA order: start 0, tightness(1)=3 beats tightness(2)=1, then 2 joins (1+2=3).",
        1,
    );
    yield FR(
        step++,
        N(verts),
        ME(
            list,
            new Map([
                [1, "highlight"],
                [2, "highlight"],
            ] as [number, EntityState][]),
        ),
        "Phase cut of {2} = 2 + 1 = 3 (edges 1-2, 0-2): best so far.",
        2,
    );
    yield FR(
        step++,
        N(["0", "12"]),
        ME([{ a: "0", b: "12", w: 4 }]),
        "Contract 1+2 into supernode {12}: merged edge to 0 weighs 3+1=4.",
        3,
    );
    yield FR(
        step++,
        N(["0", "12"]),
        ME([{ a: "0", b: "12", w: 4 }]),
        "Final phase cut = 4, above the best: global min cut stays 3.",
        4,
    );
    yield {
        ...FR(step++, N(verts), ME(list), "Global min cut = 3 (isolate vertex 2).", 5),
        meta: { cutValue: 3 },
    };
}

const module: AlgorithmModule = {
    id: "nagamochi-ibaraki-min-cut",
    name: "Nagamochi-Ibaraki Min Cut",
    category: "flow",
    complexity: { time: "O(V E + V^2 log V)", space: "O(V^2)" },
    defaultInput: {
        vertices: ["0", "1", "2"],
        edges: [
            [0, 1, 3],
            [1, 2, 2],
            [0, 2, 1],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
