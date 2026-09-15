/**
 * ida-star-search.ts – IDA* Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Iterative-deepening A* gets A*'s optimality with only linear memory. It
 * runs depth-first search bounded by an f-cost threshold (starting at h of
 * the start node), cutting off any path whose f = g + h exceeds it. When a
 * round ends without the goal, the threshold rises to the smallest cutoff
 * seen, and the search repeats – each round re-explores, but memory stays
 * proportional to the path depth.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b^d) – rounds re-expand nodes, like iterative deepening
 *   Space: O(d) – only the current depth-first path plus the threshold
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes expanded inside the threshold are YELLOW (comparing).
 *   - Cutoff nodes over the threshold are PINK (highlight).
 *   - The goal turns GREEN (sorted) with its optimal cost and path.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Optimal and complete with an admissible heuristic, like A*.
 *   - The threshold schedule is the lesson: min-cutoff guarantees progress.
 *   - Re-expansion is the price paid for linear memory.
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
const H: Record<string, number> = { A: 5, B: 3, C: 4, D: 2, G: 0 };

function makeNodes(states: Map<string, EntityState> = new Map()): VisualEntity[] {
    return NODES.map((id, i) => ({
        id: `node-${id}`,
        type: "node" as const,
        label: `${id}(h=${H[id]})`,
        value: i,
        state: states.get(id) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { name: id, heuristic: H[id] },
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
    let threshold = H[start] as number;

    yield {
        stepNumber: step,
        entities: makeNodes(new Map([[start, "comparing"]])),
        edges: [],
        description: `IDA* from ${start} to ${goal}; initial threshold f=${threshold}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { threshold, start, goal },
    };
    step += 1;
    for (let round = 0; round < 3 && step < 12; round += 1) {
        let nextThreshold = Number.POSITIVE_INFINITY;
        const stack: Array<[string, number]> = [[start, 0]];
        const path: string[] = [];
        while (stack.length > 0 && step < 12) {
            const [current, g] = stack.pop() as [string, number];
            const f = g + (H[current] as number);
            if (f > threshold) {
                nextThreshold = Math.min(nextThreshold, f);
                yield {
                    stepNumber: step,
                    entities: makeNodes(new Map([[current, "highlight"]])),
                    edges: [],
                    description: `Cut off ${current} (f=${f} > threshold ${threshold}).`,
                    codeLineNumber: 1,
                    layout: "graph",
                    meta: { threshold, start, goal },
                };
                step += 1;
                continue;
            }
            path.push(current);
            if (current === goal) {
                yield {
                    stepNumber: step,
                    entities: makeNodes(new Map([[goal, "sorted"]])),
                    edges: [],
                    description: `Goal ${goal} reached with cost ${g} at threshold ${threshold}. Path: ${[...path].join("→")}.`,
                    codeLineNumber: 2,
                    layout: "graph",
                    meta: { threshold, start, goal, cost: g },
                };
                return;
            }
            yield {
                stepNumber: step,
                entities: makeNodes(new Map([[current, "comparing"]])),
                edges: [],
                description: `Expanding ${current} (g=${g}, f=${f}) within threshold ${threshold}.`,
                codeLineNumber: 1,
                layout: "graph",
                meta: { threshold, start, goal },
            };
            step += 1;
            const nbs = neighbors(current);
            for (let i = nbs.length - 1; i >= 0; i -= 1) {
                const [nb, cost] = nbs[i] as [string, number];
                stack.push([nb, g + cost]);
            }
        }
        if (nextThreshold === Number.POSITIVE_INFINITY) break;
        threshold = nextThreshold;
        yield {
            stepNumber: step,
            entities: makeNodes(),
            edges: [],
            description: `Raising threshold to ${threshold} for round ${round + 2}.`,
            codeLineNumber: 4,
            layout: "graph",
            meta: { threshold, start, goal },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeNodes(),
        edges: [],
        description: `Goal ${goal} stayed beyond 3 threshold rounds ending at ${threshold}.`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { threshold, start, goal },
    };
}

const module: AlgorithmModule = {
    id: "ida-star-search",
    name: "IDA* Search",
    category: "searching",
    complexity: { time: "O(b^d)", space: "O(d)" },
    defaultInput: { start: "A", goal: "G" },
    visualType: "graph",
    run,
    pseudocode: [
        "start with threshold ← h(start) over the weighted graph",
        "run depth-first search cutting paths with f = g+h > threshold",
        "if goal pops within threshold: return its cost and path",
        "track nextThreshold ← smallest f that exceeded the threshold",
        "raise threshold ← nextThreshold and repeat the round",
        "done: return optimum or report that goal is unreachable",
    ],
};

export default module;
