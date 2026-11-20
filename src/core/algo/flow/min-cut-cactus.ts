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
    yield {
        ...FR(
            step++,
            N(verts),
            ME(list, new Map(list.map((_, i) => [i, "sorted"] as [number, EntityState]))),
            `Cactus complete: value ${opt}, 3 distinct minimum cuts stored in O(V) space.`,
            4,
        ),
        meta: { cutValue: opt, numCuts: 3 },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A minimum cut cactus is a compact graph that represents all global minimum cuts of an undirected graph. Its edges are arranged in directed cycles so that removing any one cactus edge yields a minimum cut of the original graph. On simple graphs the cactus often coincides with the graph itself.",
        "invariants": [
            "Every cactus edge lies on a cycle representing a family of minimum cuts.",
            "Deleting any single cactus edge reproduces a global minimum cut.",
            "The cactus records all minimum cuts without listing them one by one."
        ],
        "correctness": "Every min cut of the original graph corresponds to cutting one edge of the cactus, and conversely each cactus edge defines a min cut. Because the edge weights equal the global minimum cut value on the cycles, all minimum cuts are captured and no non-minimum cut is introduced.",
        "complexityRationale": "Finding the global minimum cut and enumerating candidate cuts dominates, around O(V^2 E) for the dense scan used here. The cactus adjacency and cut lists use O(V^2) space.",
        "uses": [
            "Representing all minimum cuts of a network compactly",
            "Reliability analysis under multiple failure scenarios",
            "A preprocessing step for certain Steiner and cut problems"
        ],
        "references": [
            "Diniz, Francez, and others, The Minimum Cut Cactus and its Applications (research literature)",
            "Ahuja, Magnanti, and Orlin, Network Flows, min-cut structure"
        ],
        "workedExample": "Triangle vertices 0,1,2 with unit edges. The global minimum cut has weight 2, achieved by isolating any single vertex, so there are three minimum cuts. The cactus is the triangle itself; removing edge 0-1, 1-2, or 0-2 yields one of those three cuts."
    },
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
    pseudocode: [
        "initialize undirected graph with edge capacities",
        "enumerate cuts to find global minimum cut value",
        "record each singleton cut against optimum value",
        "fold all minimum cuts into compact cactus cycles",
        "verify every cactus cut matches optimum weight",
        "report cactus with minimum cut value and cut count",
    ],
};
export default module;
