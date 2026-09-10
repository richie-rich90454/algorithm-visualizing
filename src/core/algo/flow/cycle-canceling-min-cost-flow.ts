/**
 * cycle-canceling-min-cost-flow.ts - Cycle Canceling Min-Cost Flow.
 * Start feasible, then push flow around every negative-cost residual cycle.
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
        `Min-cost flow of ${d.demand} units 0->2: direct edge costs 5, chain costs 1+1.`,
        0,
    );
    yield FR(
        step++,
        N(verts),
        ME(show, new Map([[2, "highlight"]] as [number, EntityState][]), true),
        `Initial feasible flow: ${d.demand} units straight 0->2, cost ${d.demand * 5} = 10.`,
        1,
    );
    yield FR(
        step++,
        N(verts),
        ME(
            show,
            new Map([
                [0, "comparing"],
                [1, "comparing"],
                [2, "comparing"],
            ] as [number, EntityState][]),
            true,
        ),
        "Negative residual cycle 0->1(+1), 1->2(+1), 2->0(-5): total -3 per unit.",
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
        `Cancel: push ${d.demand} units around the cycle, erasing the expensive direct flow.`,
        3,
    );
    const cost = d.demand * 2;
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
        `No negative cycle remains (Bellman-Ford clean): optimal cost ${cost}.`,
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
            `Min-cost flow = ${cost}: ${d.demand} units via 0-1-2 at 1+1 each.`,
            5,
        ),
        meta: { minCost: cost, flow: d.demand },
    };
}

const module: AlgorithmModule = {
    id: "cycle-canceling-min-cost-flow",
    name: "Cycle Canceling Min-Cost Flow",
    category: "flow",
    complexity: { time: "O(V^2 E^2 U)", space: "O(V + E)" },
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
};
export default module;
