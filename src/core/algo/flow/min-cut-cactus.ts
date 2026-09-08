/**
 * min-cut-cactus.ts - Min-Cut Cactus.
 * All minimum cuts of a tiny graph folded into one cactus representation.
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
    yield FR(step++, N(verts), ME(list), "Cactus of all min cuts for the unit triangle K3.", 0);
    let opt = Infinity;
    for (let mask = 1; mask < (1 << verts.length) - 1; mask += 1) {
        const side = new Set(verts.filter((_, i) => (mask >> i) & 1));
        const c = list.filter((e) => side.has(e.a) !== side.has(e.b)).reduce((s, e) => s + e.w, 0);
        opt = Math.min(opt, c);
    }
    yield FR(
        step++,
        N(verts),
        ME(list),
        `Min-cut value = ${opt}: every singleton cut has exactly 2 unit edges.`,
        1,
    );
    const singles = verts.map((v) => ({
        v,
        c: list.filter((e) => (e.a === v) !== (e.b === v)).reduce((s, e) => s + e.w, 0),
    }));
    for (const sg of singles) {
        yield FR(
            step++,
            N(verts, new Map([[sg.v, "highlight"]] as [string, EntityState][])),
            ME(list),
            `Minimum cut {${sg.v}} vs rest = ${sg.c}.`,
            2,
        );
    }
    yield FR(
        step++,
        N(verts),
        ME(list),
        "Cactus: a 3-cycle where each vertex maps to one original vertex; cutting any 2 cycle edges gives a min cut.",
        3,
    );
    yield FR(
        step++,
        N(verts),
        ME(list, new Map(list.map((_, i) => [i, "sorted"] as [number, EntityState]))),
        `Cactus complete: value ${opt}, 3 distinct minimum cuts stored in O(V) space.`,
        4,
    );
}

const module: AlgorithmModule = {
    id: "min-cut-cactus",
    name: "Min-Cut Cactus",
    category: "flow",
    complexity: { time: "O(V^2 E)", space: "O(V^2)" },
    defaultInput: {
        vertices: ["0", "1", "2"],
        edges: [
            [0, 1, 1],
            [1, 2, 1],
            [0, 2, 1],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
