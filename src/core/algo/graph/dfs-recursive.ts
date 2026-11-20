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
 * Visualization mapping
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
        const buildFrame = (message: string, line = 2): VisualFrame => ({
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: { visits },
        });

        yield buildFrame(`Visiting node ${current} (visit #${visits}).`, 1);
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

            yield buildFrame(`Following edge ${current} → ${neighbor}.`);
            step += 1;

            // Recurse into the neighbor's subtree.
            yield* dfs(neighbor);
        }

        // This node is fully explored – mark it done.
        const doneNode = nodeById.get(`node-${current}`);
        if (doneNode) {
            doneNode.state = "visited";
        }

        yield buildFrame(`Finished node ${current} – backtracking.`, 3);
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

    education: {
        "intuition": "Go as deep as possible along one branch before backtracking. Mark a vertex when first reached, recurse into each unvisited neighbor, and finish the vertex when all neighbors are explored.",
        "invariants": [
            "The recursion stack is a path in the graph of currently active vertices.",
            "A vertex marked visited is either finished or an ancestor on that path."
        ],
        "correctness": "Recursion explores every reachable neighbor, so all reachable vertices are visited. The discovery and finish times give a valid depth-first forest and support classification of tree, back, forward, and cross edges.",
        "complexityRationale": "Each vertex is discovered once and each edge examined once or twice, giving O(V + E) time. Space is O(V) for the visited set and recursion stack.",
        "uses": [
            "Topological ordering and cycle detection",
            "Connected and strongly connected components",
            "Backtracking search and puzzle solving"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 22",
            "Tarjan, Depth-First Search and Linear Graph Algorithms, 1972"
        ],
        "workedExample": "Graph A-B, A-C, B-D. Start at A, mark it, recurse into B, mark it, recurse into D, mark and finish D, finish B, then recurse into C and finish C, finally finish A. Discovery order is A, B, D, C."
    },
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
    pseudocode: [
        "call dfs(s) to start the search",
        "mark u visited the first time it is reached",
        "for each unvisited neighbor: cross over and recurse",
        "finish u once its whole subtree is explored, then backtrack",
        "done: depth-first spanning tree of the reachable vertices",
    ],
};

export default module;
