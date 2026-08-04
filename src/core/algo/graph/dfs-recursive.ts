/**
 * dfs-recursive.ts – Depth-First Search (Recursive)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Depth-first search explores a graph by going as deep as possible along one
 * branch before backtracking. Starting from a source vertex, it visits the
 * source, then recursively visits each unvisited neighbor in turn. The
 * recursion itself is the stack: each call remembers where to resume when its
 * subtree is exhausted. DFS produces a spanning tree of the visited vertices
 * and is the backbone of many algorithms (topological sort, SCCs, bridges).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) – every vertex is visited once, every edge examined once
 *   Space: O(V) stack depth in the worst case (a long chain of vertices)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - Unvisited nodes are GRAY (unvisited).
 *   - The node currently being explored is YELLOW (comparing).
 *   - The edge taken to reach a node is BLUE (active).
 *   - Fully explored nodes are ORANGE (visited).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Visits in a "go deep first" order, unlike BFS's level-by-level order.
 *   - Not necessarily the shortest path; it just explores *something* fully.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

/**
 * The recursive DFS generator.
 *
 * @param input The graph as an adjacency list, e.g.
 *        `{ graph: { A: ["B", "C"], ... }, start: "A" }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; start?: string } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "D"],
        C: ["A", "E"],
        D: ["B", "E"],
        E: ["C", "D"],
    };
    const start = task.start ?? "A";

    const vertices = Object.keys(adjacency);
    const nodes = makeGraphNodes(vertices);
    const edges = makeGraphEdges(adjacency);

    // node/edge lookup maps make state updates trivial.
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const edgeById = new Map(edges.map((e) => [e.id, e]));

    // Track which vertices have been discovered and fully processed.
    const visited = new Set<string>();

    let step = 0;
    let visits = 0;

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Starting depth-first search from node ${start}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { visits },
    };
    step += 1;

    /**
     * Recursive DFS visit. Marks `current` visited, then recurses into each
     * unvisited neighbor. The generator yields a frame per visit.
     */
    function* dfs(current: string): Generator<VisualFrame, void, unknown> {
        visited.add(current);
        visits += 1;

        // Mark the current node as actively explored.
        const currentNode = nodeById.get(`node-${current}`);
        if (currentNode) {
            currentNode.state = "comparing";
        }

        // Build the frame with the current state of every node and edge.
        const buildFrame = (): VisualFrame => ({
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Visiting node ${current}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { visits },
        });

        yield buildFrame();
        step += 1;

        // Explore each neighbor that has not been visited yet.
        for (const neighbor of adjacency[current] ?? []) {
            // Skip already-visited vertices to avoid cycles.
            if (visited.has(neighbor)) {
                continue;
            }

            // Reset all edge states to idle before marking the new active edge.
            for (const edge of edges) {
                edge.state = "idle";
            }

            // Highlight the edge we are about to cross.
            const edge = edgeById.get(`edge-${current}-${neighbor}`);
            if (edge) {
                edge.state = "active";
            }

            yield buildFrame();
            step += 1;

            // Recurse into the neighbor's subtree.
            yield* dfs(neighbor);
        }

        // This node is fully explored – mark it done.
        const doneNode = nodeById.get(`node-${current}`);
        if (doneNode) {
            doneNode.state = "visited";
        }

        yield buildFrame();
        step += 1;
    }

    yield* dfs(start);

    // Final frame: everything visited, search complete.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Depth-first search complete – visited ${visits} node(s).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { visits },
    };
}

/** The DFS (Recursive) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "dfs-recursive",
    name: "DFS (Recursive)",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // A small connected graph; A is the natural starting point.
    defaultInput: {
        graph: { A: ["B", "C"], B: ["A", "D"], C: ["A", "E"], D: ["B", "E"], E: ["C", "D"] },
        start: "A",
    },
    visualType: "graph",
    run,
};

export default module;
