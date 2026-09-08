/**
 * greedy-best-first-search.ts – Greedy Best-First Search
 *
 * Always expands the frontier node with the smallest heuristic, ignoring
 * path cost. Runs on a tiny explicit graph; the goal goes green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const NODES = ["A", "B", "C", "D", "G"];
const EDGES: Array<[string, string]> = [
    ["A", "B"],
    ["A", "C"],
    ["B", "D"],
    ["C", "D"],
    ["D", "G"],
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

function neighbors(id: string): string[] {
    return EDGES.filter(([from]) => from === id).map(([, to]) => to);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { start?: string; goal?: string } | null) ?? {};
    const start = typeof task.start === "string" && NODES.includes(task.start) ? task.start : "A";
    const goal = typeof task.goal === "string" && NODES.includes(task.goal) ? task.goal : "G";
    let step = 0;
    let expansions = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(),
        edges: [],
        description: `Greedy best-first from ${start} to ${goal}; expanding lowest h.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { expansions, start, goal },
    };
    step += 1;
    const visited = new Set<string>();
    let frontier = [start];
    while (frontier.length > 0 && step < 13) {
        frontier.sort((x, y) => (H[x] as number) - (H[y] as number));
        const current = frontier.shift() as string;
        if (visited.has(current)) continue;
        visited.add(current);
        expansions += 1;
        const states = new Map<string, EntityState>([[current, "comparing"]]);
        for (const v of visited) {
            if (v !== current) states.set(v, "highlight");
        }
        if (current === goal) {
            yield {
                stepNumber: step,
                entities: makeNodes(new Map([[goal, "sorted"]])),
                edges: [],
                description: `Reached goal ${goal} after ${expansions} expansions.`,
                codeLineNumber: 2,
                layout: "graph",
                meta: { expansions, start, goal },
            };
            return;
        }
        yield {
            stepNumber: step,
            entities: makeNodes(states),
            edges: [],
            description: `Expanding ${current} (h=${H[current]}); frontier adds ${neighbors(current).join(", ") || "none"}.`,
            codeLineNumber: 1,
            layout: "graph",
            meta: { expansions, start, goal },
        };
        step += 1;
        for (const nb of neighbors(current)) {
            if (!visited.has(nb)) frontier.push(nb);
        }
    }
    yield {
        stepNumber: step,
        entities: makeNodes(),
        edges: [],
        description: `Goal ${goal} was not reached.`,
        codeLineNumber: 3,
        layout: "graph",
        meta: { expansions, start, goal },
    };
}

const module: AlgorithmModule = {
    id: "greedy-best-first-search",
    name: "Greedy Best-First Search",
    category: "searching",
    complexity: { time: "O(b^m)", space: "O(b^m)" },
    defaultInput: { start: "A", goal: "G" },
    visualType: "graph",
    run,
};

export default module;
