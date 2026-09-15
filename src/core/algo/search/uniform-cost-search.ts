/**
 * uniform-cost-search.ts – Uniform-Cost Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Finds the cheapest path from a start node to a goal in a weighted graph.
 * It keeps a frontier ordered by path cost g and always expands the cheapest
 * unexpanded node (Dijkstra's algorithm on an explicit graph). The first time
 * the goal is expanded – not merely reached – its cost is optimal, because
 * every alternative still waiting is at least as expensive.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b^(Cstar/e)) – exponential in the cheapest-solution cost
 *   Space: O(b^(Cstar/e)) – the frontier holds every candidate path
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The node being expanded is YELLOW (comparing).
 *   - Already expanded nodes stay PINK (highlight).
 *   - The goal turns GREEN (sorted) with its optimal cost.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Optimal and complete for non-negative edge costs; labels show g values.
 *   - Expanding, not generating, the goal is what guarantees optimality.
 *   - Breadth-first search is the special case where every cost equals 1.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const NODES = ["A", "B", "C", "D", "G"];
const EDGES: Array<[string, string, number]> = [
    ["A", "B", 1],
    ["A", "C", 4],
    ["B", "D", 2],
    ["C", "D", 1],
    ["D", "G", 3],
];

function makeNodes(
    costs: Map<string, number>,
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    return NODES.map((id, i) => ({
        id: `node-${id}`,
        type: "node" as const,
        label: costs.has(id) ? `${id}(g=${costs.get(id)})` : id,
        value: i,
        state: states.get(id) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { name: id, cost: costs.get(id) ?? -1 },
    }));
}

function neighbors(id: string): Array<[string, number]> {
    return EDGES.filter(([from]) => from === id).map(
        ([, to, cost]) => [to, cost] as [string, number],
    );
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { start?: string; goal?: string } | null) ?? {};
    const start = typeof task.start === "string" && NODES.includes(task.start) ? task.start : "A";
    const goal = typeof task.goal === "string" && NODES.includes(task.goal) ? task.goal : "G";
    let step = 0;
    let expansions = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(new Map([[start, 0]])),
        edges: [],
        description: `Uniform-cost search from ${start} to ${goal}; expanding lowest g.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { expansions, start, goal },
    };
    step += 1;
    const best = new Map<string, number>([[start, 0]]);
    const frontier: Array<[string, number]> = [[start, 0]];
    const expanded = new Set<string>();
    while (frontier.length > 0 && step < 13) {
        frontier.sort((x, y) => x[1] - y[1]);
        const [current, g] = frontier.shift() as [string, number];
        if (expanded.has(current)) continue;
        if ((best.get(current) as number) < g) continue;
        expanded.add(current);
        expansions += 1;
        const states = new Map<string, EntityState>([[current, "comparing"]]);
        for (const v of expanded) {
            if (v !== current) states.set(v, "highlight");
        }
        if (current === goal) {
            yield {
                stepNumber: step,
                entities: makeNodes(best, new Map([[goal, "sorted"]])),
                edges: [],
                description: `Goal ${goal} reached with optimal cost ${g} after ${expansions} expansions.`,
                codeLineNumber: 2,
                layout: "graph",
                meta: { expansions, start, goal, cost: g },
            };
            return;
        }
        yield {
            stepNumber: step,
            entities: makeNodes(best, states),
            edges: [],
            description: `Expanding ${current} (g=${g}); relaxing ${
                neighbors(current)
                    .map(([n]) => n)
                    .join(", ") || "no neighbors"
            }.`,
            codeLineNumber: 1,
            layout: "graph",
            meta: { expansions, start, goal, current, g },
        };
        step += 1;
        for (const [nb, cost] of neighbors(current)) {
            const ng = g + cost;
            if (ng < (best.get(nb) ?? Number.POSITIVE_INFINITY)) {
                best.set(nb, ng);
                frontier.push([nb, ng]);
            }
        }
    }
    yield {
        stepNumber: step,
        entities: makeNodes(best),
        edges: [],
        description: `Goal ${goal} is unreachable after ${expansions} expansions.`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { expansions, start, goal },
    };
}

const module: AlgorithmModule = {
    id: "uniform-cost-search",
    name: "Uniform-Cost Search",
    category: "searching",
    complexity: { time: "O(b^(C*/ε))", space: "O(b^(C*/ε))" },
    defaultInput: { start: "A", goal: "G" },
    visualType: "graph",
    run,
    pseudocode: [
        "start with frontier ← {(start, g=0)} and best costs ← {start: 0}",
        "while frontier is nonempty: pop the node with smallest g",
        "if popped node = goal: return its path cost as optimal",
        "else expand it and relax every neighbor with g+edge cost",
        "record cheaper arrivals and push them onto the frontier",
        "done: return optimal cost or report that goal is unreachable",
    ],
};

export default module;
