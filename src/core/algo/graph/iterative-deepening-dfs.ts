/**
 * iterative-deepening-dfs.ts – Iterative Deepening DFS
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Iterative deepening reruns a depth-limited DFS with limits 0, 1, 2, and so
 * on. Each probe explores only paths within the limit, so the first probe
 * that reaches the target used the shallowest possible depth – the BFS
 * optimality guarantee – while the stack never holds more than d vertices.
 * The repeated shallow work looks wasteful but costs only a constant factor
 * extra. Here the limit ring grows until E is found at depth 2 via A→C→E.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b^d) – repeated probes cost a constant factor over BFS
 *   Space: O(d) for the depth-limited stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The probe origin is PINK (highlight).
 *   - The current path is YELLOW (comparing).
 *   - The found target path turns GREEN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Optimal like BFS, memory-light like DFS: the default for huge spaces.
 *   - Powers game-tree search (with alpha-beta) and route planning.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { graph?: Record<string, string[]>; start?: string; target?: string } | null) ??
        {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["D"],
        C: ["E"],
        D: [],
        E: [],
    };

    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(adjacency);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
    };
    const setE = (a: string, b: string, s: EntityState): void => {
        const e = edges.find((x) => x.sourceId === `node-${a}` && x.targetId === `node-${b}`);
        if (e) e.state = s;
    };
    const clr = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph" as const,
        meta,
    });
    if (labels.length === 0) {
        yield snap("Empty graph – nothing to explore.", 0);
        return;
    }
    const start =
        task.start && adjacency[task.start] !== undefined ? task.start : (labels[0] as string);
    const target = task.target ?? "E";
    yield snap(`IDDFS from ${start} seeking ${target}: grow the depth limit 0, 1, 2, …`, 0, {
        limit: 0,
    });
    step += 1;
    let found: string[] | null = null;
    for (let limit = 0; limit <= labels.length && !found; limit += 1) {
        clr();
        setN(start, "highlight");
        yield snap(`Depth limit ${limit} – probe from ${start}.`, 1, { limit });
        step += 1;
        const stack: Array<{ v: string; depth: number; path: string[] }> = [
            { v: start, depth: 0, path: [start] },
        ];
        while (stack.length > 0 && !found) {
            const top = stack.pop();
            if (!top) break;
            clr();
            for (const p of top.path) setN(p, "comparing");
            setN(top.v, "highlight");
            yield snap(`Visiting ${top.v} at depth ${top.depth} (path ${top.path.join("→")}).`, 2, {
                limit,
                depth: top.depth,
            });
            step += 1;
            if (top.v === target) {
                found = top.path;
                break;
            }
            if (top.depth < limit) {
                for (const nb of [...(adjacency[top.v] ?? [])].reverse()) {
                    if (!top.path.includes(nb))
                        stack.push({ v: nb, depth: top.depth + 1, path: [...top.path, nb] });
                }
            }
        }
        if (found) break;
        if (limit >= labels.length) break;
    }
    clr();
    if (found) {
        for (const p of found) setN(p, "path");
        yield snap(`Found ${target} at depth ${found.length - 1} via ${found.join("→")}.`, 4, {
            depth: found.length - 1,
        });
    } else {
        yield snap(`${target} unreachable from ${start} at any depth.`, 4, {});
    }
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Iterative deepening reruns a depth-limited depth-first search with limits 0, 1, 2, and so on. The first limit that reaches the target gives the shallowest possible path, matching breadth-first optimality, while the search stack never grows beyond the target depth.",
        "invariants": [
            "A probe with limit L visits exactly the vertices within L edges of the start.",
            "If a target is found at limit L, no shallower path exists.",
            "Increasing the limit explores all previously visited vertices plus one more layer."
        ],
        "correctness": "Each probe is a complete depth-limited DFS, so it finds any vertex within its limit. The smallest limit that reaches the target is the minimum number of edges on any path to it, giving a shortest path. Repeating shallow levels costs only a constant-factor overhead because the geometric series of work is dominated by the last probe.",
        "complexityRationale": "The total work is O(b^d) for a branching factor b and target depth d, the same order as BFS, and the stack uses O(d) space.",
        "uses": [
            "Pathfinding when memory is limited but optimal depth matters",
            "Game-tree search with progressive deepening",
            "A space-efficient alternative to breadth-first search"
        ],
        "references": [
            "Korf, Iterative-Deepening A*: A Simple and Optimal Admissible Heuristic Search (1985)",
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, uninformed search"
        ],
        "workedExample": "From A toward E, probes at limits 0 and 1 find nothing. At limit 2 the DFS explores A-C-E and reaches E, so the shortest path has length 2 and the search stops without deeper exploration."
    },
    id: "iterative-deepening-dfs",
    name: "Iterative Deepening DFS",
    category: "graph",
    complexity: { time: "O(b^d)", space: "O(d)" },
    defaultInput: {
        graph: { A: ["B", "C"], B: ["D"], C: ["E"], D: [], E: [] },
        start: "A",
        target: "E",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "set limit ← 0 to seek the target from the start",
        "run a depth-limited DFS probe from the start",
        "visit each vertex with its depth and current path",
        "target found: record the path, else raise the limit and repeat",
        "done: shallowest path to the target, or unreachable",
    ],
};

export default module;
