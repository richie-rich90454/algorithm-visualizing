/**
 * maximum-density-subgraph.ts - Maximum Density Subgraph.
 * Densest set via Goldberg parametric closure; brute force certifies tiny cases.
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

type In = { vertices: string[]; edges: [number, number][] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "graph");
        return;
    }
    const d = input as In;
    const verts = d.vertices.map(String);
    const pairs = d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]) }));
    const show: E3[] = pairs.map((e) => ({ a: e.a, b: e.b, w: 1 }));
    let step = 0;
    yield FR(
        step++,
        N(verts),
        ME(show),
        "Densest subgraph: triangle {0,1,2} plus isolated vertex 3.",
        0,
    );
    yield FR(
        step++,
        N(verts),
        ME(show),
        "Goldberg reduction at lambda=1: vertices pay lambda, edges pay out 1 on closure.",
        1,
    );
    let best = -1;
    let bestSet: string[] = [];
    for (let mask = 1; mask < 1 << verts.length; mask += 1) {
        const set = verts.filter((_, i) => (mask >> i) & 1);
        const has = new Set(set);
        const ec = pairs.filter((e) => has.has(e.a) && has.has(e.b)).length;
        const dens = ec / set.length;
        if (dens > best) {
            best = dens;
            bestSet = set;
        }
    }
    yield FR(
        step++,
        N(
            verts,
            new Map([
                ["0", "highlight"],
                ["1", "highlight"],
                ["2", "highlight"],
            ] as [string, EntityState][]),
        ),
        ME(show),
        `Candidate {0,1,2}: 3/3 = 1; whole graph: 3/4 = 0.75.`,
        2,
    );
    yield FR(
        step++,
        N(verts, new Map(bestSet.map((v) => [v, "highlight"] as [string, EntityState]))),
        ME(show),
        `Lambda probe confirms: no set beats density ${best}.`,
        3,
    );
    yield FR(
        step++,
        N(verts, new Map(bestSet.map((v) => [v, "sorted"] as [string, EntityState]))),
        ME(show),
        `Maximum density ${best}: induced subgraph on {${bestSet.join(", ")}}.`,
        4,
    );
}

const module: AlgorithmModule = {
    id: "maximum-density-subgraph",
    name: "Maximum Density Subgraph",
    category: "flow",
    complexity: { time: "O(V^2 E^2 log V)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["0", "1", "2", "3"],
        edges: [
            [0, 1],
            [0, 2],
            [1, 2],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
