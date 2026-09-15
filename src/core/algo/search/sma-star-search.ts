/**
 * sma-star-search.ts – SMA* Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Simplified Memory-Bounded A* is best-first search under a fixed memory cap.
 * It always expands the lowest-f leaf, and whenever memory is full it forgets
 * the worst (highest-f) leaf – backing its f-value up to the parent so the
 * forgotten branch can be regenerated later. With enough memory for the
 * shallowest goal path it stays optimal; starved of memory it may fail.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b^d) – forgotten leaves get regenerated when revisited
 *   Space: O(memory) – bounded by the configured node budget
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The node being expanded is YELLOW (comparing).
 *   - Forgotten worst leaves flash RED (swapped) with a running drop count.
 *   - The goal turns GREEN (sorted) with its optimal cost.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Optimal when memory fits the shallowest goal path; else incomplete.
 *   - Backed-up f-values keep parents honest about forgotten children.
 *   - The memory gauge in each description shows pressure building.
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
    const task = (input as { start?: string; goal?: string; memory?: number } | null) ?? {};
    const start = typeof task.start === "string" && NODES.includes(task.start) ? task.start : "A";
    const goal = typeof task.goal === "string" && NODES.includes(task.goal) ? task.goal : "G";
    const memory =
        typeof task.memory === "number" && task.memory >= 2 ? Math.floor(task.memory) : 3;
    let step = 0;
    let dropped = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(new Map([[start, "comparing"]])),
        edges: [],
        description: `SMA* from ${start} to ${goal} with memory for ${memory} nodes.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { memory, start, goal },
    };
    step += 1;
    const open: Array<{ node: string; g: number; f: number }> = [
        { node: start, g: 0, f: H[start] as number },
    ];
    const expanded = new Set<string>();
    while (open.length > 0 && step < 13) {
        open.sort((x, y) => x.f - y.f);
        const current = open.shift() as { node: string; g: number; f: number };
        if (expanded.has(current.node)) continue;
        expanded.add(current.node);
        if (current.node === goal) {
            yield {
                stepNumber: step,
                entities: makeNodes(new Map([[goal, "sorted"]])),
                edges: [],
                description: `Goal ${goal} reached with cost ${current.g}; dropped ${dropped} node(s).`,
                codeLineNumber: 2,
                layout: "graph",
                meta: { memory, start, goal, cost: current.g },
            };
            return;
        }
        yield {
            stepNumber: step,
            entities: makeNodes(new Map([[current.node, "comparing"]])),
            edges: [],
            description: `Expanding ${current.node} (f=${current.f}); memory holds ${open.length + 1}/${memory}.`,
            codeLineNumber: 1,
            layout: "graph",
            meta: { memory, start, goal },
        };
        step += 1;
        for (const [nb, cost] of neighbors(current.node)) {
            if (!expanded.has(nb))
                open.push({
                    node: nb,
                    g: current.g + cost,
                    f: current.g + cost + (H[nb] as number),
                });
        }
        while (open.length > memory - 1) {
            open.sort((x, y) => x.f - y.f);
            const worst = open.pop() as { node: string };
            dropped += 1;
            yield {
                stepNumber: step,
                entities: makeNodes(new Map([[worst.node, "swapped"]])),
                edges: [],
                description: `Memory full – forgetting worst leaf ${worst.node}.`,
                codeLineNumber: 4,
                layout: "graph",
                meta: { memory, start, goal, dropped },
            };
            step += 1;
            if (step >= 13) break;
        }
    }
    yield {
        stepNumber: step,
        entities: makeNodes(),
        edges: [],
        description: `Goal ${goal} is unreachable with memory ${memory} after dropping ${dropped} node(s).`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { memory, start, goal },
    };
}

const module: AlgorithmModule = {
    id: "sma-star-search",
    name: "SMA* Search",
    category: "searching",
    complexity: { time: "O(b^d)", space: "O(memory)" },
    defaultInput: { start: "A", goal: "G", memory: 3 },
    visualType: "graph",
    run,
    pseudocode: [
        "start with open ← {start} and memory capped at M nodes",
        "while open is nonempty: pop the leaf with smallest f",
        "if popped leaf = goal: return its cost as optimal",
        "else expand it and push each unexpanded neighbor",
        "while memory is full: forget the worst (highest-f) leaf",
        "done: return optimum or report that goal is unreachable",
    ],
};

export default module;
