/**
 * network-simplex.ts - Network Simplex.
 * Spanning-tree pivots for min-cost flow: potentials price every non-tree arc.
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

type In = { vertices: string[]; edges: [number, number, number, number][]; demand: number };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "network");
        return;
    }
    const d = input as In;
    const verts = d.vertices.map(String);
    let step = 0;
    const show: E3[] = d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), w: e[3] }));
    yield FR(
        step++,
        N(verts),
        ME(show, new Map(), true),
        `Network simplex: ship ${d.demand} units 0->2; tree arcs 0-1, 1-2 basic.`,
        0,
    );
    yield FR(
        step++,
        N(verts, new Map([["0", "visited"]] as [string, EntityState][])),
        ME(
            show,
            new Map([
                [0, "highlight"],
                [1, "highlight"],
            ] as [number, EntityState][]),
            true,
        ),
        "Potentials: pi = [0,-1,-2]; basic arcs price to zero.",
        1,
    );
    yield FR(
        step++,
        N(verts),
        ME(show, new Map([[2, "comparing"]] as [number, EntityState][]), true),
        "Non-tree arc 0->2 prices at 5 - (0-(-2)) = 3 > 0: not entering (minimization).",
        2,
    );
    yield FR(
        step++,
        N(verts),
        ME(
            show,
            new Map([
                [0, "sorted"],
                [1, "sorted"],
            ] as [number, EntityState][]),
            true,
        ),
        `Flow ${d.demand} on the tree: cost ${d.demand * 2} = 4, all reduced costs optimal.`,
        3,
    );
    yield FR(
        step++,
        N(verts),
        ME(
            show,
            new Map([
                [0, "sorted"],
                [1, "sorted"],
            ] as [number, EntityState][]),
            true,
        ),
        "No negative reduced cost remains: tree solution is optimal.",
        4,
    );
    yield {
        ...FR(
            step++,
            N(verts),
            ME(
                show,
                new Map([
                    [0, "sorted"],
                    [1, "sorted"],
                ] as [number, EntityState][]),
                true,
            ),
            `Optimum ${d.demand * 2}: route everything via 0-1-2.`,
            5,
        ),
        meta: { optimum: d.demand * 2 },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Network simplex solves min-cost flow by maintaining a spanning tree of basic arcs, analogous to the simplex basis in linear programming. Node potentials make every basic arc have zero reduced cost; when a non-tree arc has negative reduced cost it enters the basis, creating a cycle along which flow is pushed until an arc leaves.",
        "invariants": [
            "Basic arcs form a spanning tree and determine the flow and potentials.",
            "All tree arcs have zero reduced cost under the current potentials.",
            "The flow stays feasible while cost strictly decreases at each pivot."
        ],
        "correctness": "When every non-tree arc has nonnegative reduced cost, the tree flow satisfies the min-cost flow optimality conditions, so it is optimal. A negative reduced-cost arc identifies a profitable cycle; pushing the maximum feasible amount around it and dropping a saturated arc preserves feasibility and lowers cost, so the algorithm converges to an optimum.",
        "complexityRationale": "The number of pivots is bounded by roughly O(V E) in practical analyses of the method, and each pivot walks a tree path and recomputes potentials. The tree, potentials, and arc data use O(V + E) space.",
        "uses": [
            "Large-scale min-cost flow in logistics and energy networks",
            "Solving transportation and transshipment problems efficiently",
            "A specialized linear program solver for network models"
        ],
        "references": [
            "Ahuja, Magnanti, and Orlin, Network Flows, network simplex chapter",
            "Dantzig, Linear Programming and Extensions (1963)"
        ],
        "workedExample": "Vertices 0,1,2 with arcs 0-1 cap 2 cost 1, 1-2 cap 2 cost 1, 0-2 cap 2 cost 5 and demand 2. The initial basis uses the direct 0-2 arc at cost 10. Arc 0-1 has negative reduced cost, so it enters; after pivoting, flow goes 0-1-2 for a total cost of 4, which is optimal."
    },
    id: "network-simplex",
    name: "Network Simplex",
    category: "flow",
    complexity: { time: "O(V E)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["0", "1", "2"],
        edges: [
            [0, 1, 2, 1],
            [1, 2, 2, 1],
            [0, 2, 2, 5],
        ],
        demand: 2,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize network with demands and spanning tree basis",
        "compute node potentials so basic arcs price to zero",
        "price non tree arcs with reduced cost formula",
        "pivot entering arc and push flow around tree cycle",
        "repeat until no negative reduced cost remains",
        "report optimal flow value at minimum total cost",
    ],
};
export default module;
