/**
 * topological-sort-dfs.ts – Topological Sort (DFS-based)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The recursive route to a topological ordering. Perform a depth-first search
 * over every vertex; when a vertex has finished exploring all of its
 * successors, prepend it to the output list. Because a vertex is prepended
 * only *after* its descendants, every edge ends up pointing from a vertex that
 * appears earlier in the final list to one that appears later. A back edge
 * encountered during the DFS reveals a cycle, which makes topological ordering
 * impossible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E)
 *   Space: O(V) for the recursion stack and visited set
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The vertex currently being explored is YELLOW (comparing).
 *   - Finished vertices are GREEN (sorted) in output order.
 *   - The DFS tree edges are BLUE (active).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The ordering is the reverse of a DFS finish-time order.
 *   - Complements Kahn's algorithm; both are O(V + E) on a DAG.
 *   - Cycle detection is a natural by-product of the DFS coloring.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

/**
 * The DFS-based Topological Sort generator.
 *
 * @param input The graph as an adjacency list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["D"],
        C: ["D"],
        D: ["E"],
        E: [],
    };

    const vertices = Object.keys(adjacency);
    const nodes = makeGraphNodes(vertices);
    const edges = makeGraphEdges(adjacency);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // 0 = unvisited, 1 = in-progress (on the recursion stack), 2 = finished.
    const state = new Map<string, number>();
    for (const v of vertices) {
        state.set(v, 0);
    }

    const order: string[] = [];
    let step = 0;
    let hasCycle = false;

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Computing topological order with a DFS.",
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
    };
    step += 1;

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "graph",
        meta: { outputSize: order.length },
    });

    /**
     * Recursive DFS. Marks the vertex in-progress, explores every successor,
     * then marks it finished and prepends it to the topological order.
     */
    function* dfs(v: string): Generator<VisualFrame, void, unknown> {
        // Grey the vertex: it is now on the recursion stack.
        state.set(v, 1);
        const node = nodeById.get(`node-${v}`);
        if (node) {
            node.state = "comparing";
        }
        yield buildFrame(`Exploring ${v}.`);
        step += 1;

        for (const edge of edges) {
            edge.state = "idle";
        }
        for (const neighbor of adjacency[v] ?? []) {
            const neighborState = state.get(neighbor);
            if (neighborState === 1) {
                // A back edge to an in-progress vertex means a cycle.
                hasCycle = true;
                const edge = edges.find(
                    (e) => e.sourceId === `node-${v}` && e.targetId === `node-${neighbor}`,
                );
                if (edge) {
                    edge.state = "highlight";
                }
                yield buildFrame(`Back edge to ${neighbor} – cycle detected!`);
                step += 1;
                continue;
            }
            if (neighborState === 0) {
                // Highlight the edge into the unvisited successor.
                const edge = edges.find(
                    (e) => e.sourceId === `node-${v}` && e.targetId === `node-${neighbor}`,
                );
                if (edge) {
                    edge.state = "active";
                }
                yield buildFrame(`Descending into ${neighbor}.`);
                step += 1;
                yield* dfs(neighbour);
            }
        }

        // Finished: prepend to the order so ancestors come before descendants.
        state.set(v, 2);
        order.unshift(v);
        if (node) {
            node.state = "sorted";
        }
        yield buildFrame(`${v} finished – prepended to the order.`);
        step += 1;
    }

    // Run the DFS from every unvisited vertex (the graph may be disconnected).
    for (const v of vertices) {
        if (state.get(v) === 0) {
            yield* dfs(v);
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: hasCycle
            ? "Cycle detected – no topological order exists."
            : `Topological order: ${order.join(" → ")}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { outputSize: order.length, hasCycle },
    };
}

/** The Topological Sort (DFS) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "topological-sort-dfs",
    name: "Topological Sort (DFS)",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // Same prerequisite structure as Kahn's version for a direct comparison.
    defaultInput: {
        graph: { A: ["B", "C"], B: ["D"], C: ["D"], D: ["E"], E: [] },
    },
    visualType: "graph",
    run,
};

export default module;
