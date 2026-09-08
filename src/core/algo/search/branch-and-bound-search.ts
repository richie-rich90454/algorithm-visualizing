/**
 * branch-and-bound-search.ts – Branch and Bound Search
 *
 * Depth-first search that prunes any partial path whose cost already
 * meets the best solution found. Tiny explicit graph; the optimum goes
 * green.
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

function makeNodes(states: Map<string, EntityState> = new Map()): VisualEntity[] {
    return NODES.map((id, i) => ({
        id: `node-${id}`,
        type: "node" as const,
        label: id,
        value: i,
        state: states.get(id) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { name: id },
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
    let pruned = 0;
    let bound = Number.POSITIVE_INFINITY;
    let bestPath: string[] = [];

    yield {
        stepNumber: step,
        entities: makeNodes(new Map([[start, "comparing"]])),
        edges: [],
        description: `Branch and bound from ${start} to ${goal}; bound starts at ∞.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { bound: "inf", start, goal },
    };
    step += 1;
    const stack: Array<[string, number, string[]]> = [[start, 0, [start]]];
    while (stack.length > 0 && step < 12) {
        const [current, cost, path] = stack.pop() as [string, number, string[]];
        if (cost >= bound) {
            pruned += 1;
            yield {
                stepNumber: step,
                entities: makeNodes(new Map([[current, "swapped"]])),
                edges: [],
                description: `Pruning ${current}: partial cost ${cost} ≥ bound ${bound}.`,
                codeLineNumber: 2,
                layout: "graph",
                meta: { bound, pruned, start, goal },
            };
            step += 1;
            continue;
        }
        if (current === goal) {
            bound = cost;
            bestPath = path;
            yield {
                stepNumber: step,
                entities: makeNodes(new Map([[goal, "highlight"]])),
                edges: [],
                description: `New best path ${path.join("→")} with cost ${cost}. Bound drops to ${bound}.`,
                codeLineNumber: 3,
                layout: "graph",
                meta: { bound, pruned, start, goal },
            };
            step += 1;
            continue;
        }
        yield {
            stepNumber: step,
            entities: makeNodes(new Map([[current, "comparing"]])),
            edges: [],
            description: `Branching from ${current} (cost ${cost}, bound ${bound === Number.POSITIVE_INFINITY ? "∞" : bound}).`,
            codeLineNumber: 1,
            layout: "graph",
            meta: {
                bound: bound === Number.POSITIVE_INFINITY ? "inf" : bound,
                pruned,
                start,
                goal,
            },
        };
        step += 1;
        const nbs = neighbors(current);
        for (let i = nbs.length - 1; i >= 0; i -= 1) {
            const [nb, c] = nbs[i] as [string, number];
            if (!path.includes(nb)) stack.push([nb, cost + c, [...path, nb]]);
        }
    }
    yield {
        stepNumber: step,
        entities: makeNodes(new Map(bestPath.map((n) => [n, "sorted"] as [string, EntityState]))),
        edges: [],
        description:
            bestPath.length > 0
                ? `Optimal path ${bestPath.join("→")} costs ${bound}; pruned ${pruned} branch(es).`
                : `Goal ${goal} was not reached.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { bound: bound === Number.POSITIVE_INFINITY ? "inf" : bound, pruned, start, goal },
    };
}

const module: AlgorithmModule = {
    id: "branch-and-bound-search",
    name: "Branch and Bound Search",
    category: "searching",
    complexity: { time: "O(b^d) worst", space: "O(d)" },
    defaultInput: { start: "A", goal: "G" },
    visualType: "graph",
    run,
};

export default module;
