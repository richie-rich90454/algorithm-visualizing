/**
 * beam-search.ts – Beam Search
 *
 * Level-by-level expansion that keeps only the top-w nodes by heuristic
 * at each level. Runs on a tiny explicit graph; the goal goes green.
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
    const task = (input as { start?: string; goal?: string; width?: number } | null) ?? {};
    const start = typeof task.start === "string" && NODES.includes(task.start) ? task.start : "A";
    const goal = typeof task.goal === "string" && NODES.includes(task.goal) ? task.goal : "G";
    const width = typeof task.width === "number" && task.width >= 1 ? Math.floor(task.width) : 2;
    let step = 0;
    let level = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(new Map([[start, "comparing"]])),
        edges: [],
        description: `Beam search (width ${width}) from ${start} to ${goal}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { level, start, goal, width },
    };
    step += 1;
    let beam = [start];
    const seen = new Set<string>([start]);
    while (beam.length > 0 && step < 13) {
        const candidates = [
            ...new Set(beam.flatMap((n) => neighbors(n)).filter((n) => !seen.has(n))),
        ];
        if (candidates.length > 0) {
            const candStates = new Map<string, EntityState>(
                candidates.map((n) => [n, "comparing"] as [string, EntityState]),
            );
            yield {
                stepNumber: step,
                entities: makeNodes(candStates),
                edges: [],
                description: `Level ${level + 1} candidates: ${candidates.join(", ")}.`,
                codeLineNumber: 1,
                layout: "graph",
                meta: { level, start, goal, width },
            };
            step += 1;
        }
        candidates.sort((x, y) => (H[x] as number) - (H[y] as number));
        beam = candidates.slice(0, width);
        for (const n of beam) seen.add(n);
        level += 1;
        const beamStates = new Map<string, EntityState>(
            beam.map((n) => [n, "highlight"] as [string, EntityState]),
        );
        if (beam.includes(goal)) {
            yield {
                stepNumber: step,
                entities: makeNodes(new Map([[goal, "sorted"]])),
                edges: [],
                description: `Goal ${goal} survived the beam at level ${level}.`,
                codeLineNumber: 2,
                layout: "graph",
                meta: { level, start, goal, width },
            };
            return;
        }
        if (beam.length === 0) break;
        yield {
            stepNumber: step,
            entities: makeNodes(beamStates),
            edges: [],
            description: `Level ${level} beam keeps: ${beam.join(", ")}.`,
            codeLineNumber: 1,
            layout: "graph",
            meta: { level, start, goal, width },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeNodes(),
        edges: [],
        description: `Goal ${goal} was pruned from the beam.`,
        codeLineNumber: 3,
        layout: "graph",
        meta: { level, start, goal, width },
    };
}

const module: AlgorithmModule = {
    id: "beam-search",
    name: "Beam Search",
    category: "searching",
    complexity: { time: "O(w × b × d)", space: "O(w)" },
    defaultInput: { start: "A", goal: "G", width: 2 },
    visualType: "graph",
    run,
};

export default module;
