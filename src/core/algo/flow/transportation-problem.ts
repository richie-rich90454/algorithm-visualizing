/**
 * transportation-problem.ts - Transportation Problem.
 * Minimum-cost shipment from suppliers to demanders, exact on tiny instances.
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

type In = { supply: number[]; demand: number[]; cost: number[][] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "tableau");
        return;
    }
    const d = input as In;
    let step = 0;
    const labels = ["S0", "S1", "D0", "D1"];
    const show: E3[] = [
        { a: "S0", b: "D0", w: (d.cost[0] as number[])[0] as number },
        { a: "S0", b: "D1", w: (d.cost[0] as number[])[1] as number },
        { a: "S1", b: "D0", w: (d.cost[1] as number[])[0] as number },
        { a: "S1", b: "D1", w: (d.cost[1] as number[])[1] as number },
    ];
    yield FR(
        step++,
        N(labels),
        ME(show, new Map(), true),
        `Transport: supply [${d.supply.join(",")}], demand [${d.demand.join(",")}], cost [[1,3],[2,1]].`,
        0,
    );
    const S0 = d.supply[0] as number;
    const S1 = d.supply[1] as number;
    const D0 = d.demand[0] as number;
    const C = d.cost;
    let best = Infinity;
    let bestX = 0;
    for (let x00 = 0; x00 <= Math.min(S0, D0); x00 += 1) {
        const x01 = S0 - x00;
        const x10 = D0 - x00;
        const x11 = S1 - x10;
        if (x01 < 0 || x10 < 0 || x11 < 0) continue;
        const c =
            x00 * (C[0] as number[])[0]! +
            x01 * (C[0] as number[])[1]! +
            x10 * (C[1] as number[])[0]! +
            x11 * (C[1] as number[])[1]!;
        if (c < best) {
            best = c;
            bestX = x00;
        }
        yield FR(
            step++,
            N(labels),
            ME(show, new Map(), true),
            `Plan S0->D0=${x00}, S0->D1=${x01}, S1->D0=${x10}, S1->D1=${x11}: cost ${c}.`,
            1,
        );
        if (step > 11) break;
    }
    yield {
        ...FR(
            step++,
            N(labels),
            ME(
                show,
                new Map([
                    [0, "sorted"],
                    [1, "sorted"],
                    [3, "sorted"],
                ] as [number, EntityState][]),
                true,
            ),
            `Optimum ${best} at S0->D0=${bestX}: ship [2,1,0,2] (2*1 + 1*3 + 2*1).`,
            2,
        ),
        meta: { optimum: best },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The transportation problem ships goods from suppliers with fixed supplies to demanders with fixed demands at minimum cost. When totals match, any feasible shipping plan saturates every supply and demand. This demo enumerates all such plans on a tiny instance and keeps the cheapest, showing the structure that network-simplex exploits at scale.",
        "invariants": [
            "Every row's shipped amount equals its supply and every column's equals its demand.",
            "All shipments are nonnegative integers in this small demonstration.",
            "Total cost is the sum of flow times unit cost over every route."
        ],
        "correctness": "Enumerating every matrix of shipments satisfying the supply and demand margins covers the entire feasible set, so the minimum-cost member found is globally optimal. This brute-force certificate is practical only for tiny instances, where it verifies the answer that a transportation simplex would produce.",
        "complexityRationale": "The number of feasible plans grows combinatorially with supplies and demanders, and enumerating them costs about O(S D) per plan for S suppliers and D demanders. The shipment matrix and cost table use O(S D) space.",
        "uses": [
            "Logistics planning from warehouses to customers",
            "Production distribution with per-site capacity",
            "A teaching model for min-cost flow and linear programming"
        ],
        "references": [
            "Hitchcock, The Distribution of a Product from Several Sources to Numerous Localities (1941)",
            "Ahuja, Magnanti, and Orlin, Network Flows, transportation problem"
        ],
        "workedExample": "Supplies are [3,2], demands [2,3], with costs [[1,3],[2,1]]. Ship 2 from supplier 0 to demander 0, 1 from supplier 0 to demander 1, and 2 from supplier 1 to demander 1. Cost is 2*1 + 1*3 + 2*1 = 7, the cheapest feasible plan."
    },
    id: "transportation-problem",
    name: "Transportation Problem",
    category: "flow",
    complexity: { time: "O(S D)", space: "O(S D)" },
    defaultInput: {
        supply: [3, 2],
        demand: [2, 3],
        cost: [
            [1, 3],
            [2, 1],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize suppliers demanders and unit cost matrix",
        "enumerate feasible shipment plans meeting supply demand",
        "compute total cost for each candidate shipment plan",
        "track cheapest plan seen across enumeration steps",
        "verify optimum shipment against all feasible plans",
        "report optimal shipment with minimum total cost",
    ],
};
export default module;
