/**
 * bfs.ts – Breadth-First Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Breadth-first search explores a graph level by level. From the source, it
 * visits every vertex at distance 1, then every vertex at distance 2, and so
 * on, using a queue to remember "the next vertices to visit". Because it
 * expands in rings, the first time BFS reaches a vertex, the path taken to it
 * is guaranteed to be a *shortest path* (in unweighted graphs).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E)
 *   Space: O(V) for the queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being dequeued and visited is YELLOW (comparing).
 *   - Vertices waiting in the queue are ORANGE (visited).
 *   - The edge across which a vertex is discovered is BLUE (active).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Level-order traversal; the natural contrast to DFS's depth-first order.
 *   - Provides shortest paths in unweighted graphs, which is why it is the
 *     go-to for "minimum number of moves" problems.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

/**
 * The BFS generator.
 *
 * @param input The graph as an adjacency list plus a start vertex.
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

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const visited = new Set<string>();

    let step = 0;
    let visits = 0;

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Starting breadth-first search from ${start}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { visits },
    };
    step += 1;

    // The queue: vertices discovered but not yet expanded (FIFO discipline).
    const queue: string[] = [start];
    visited.add(start);
    visits += 1;

    const startNode = nodeById.get(`node-${start}`);
    if (startNode) {
        startNode.state = "visited";
    }

    while (queue.length > 0) {
        // Dequeue the oldest discovered vertex.
        const current = queue.shift();
        if (!current) {
            continue;
        }

        const currentNode = nodeById.get(`node-${current}`);
        if (currentNode) {
            currentNode.state = "comparing";
        }

        const buildFrame = (): VisualFrame => ({
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Dequeuing and visiting ${current} (queue: [${queue.join(", ")}]).`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { visits, queueSize: queue.length },
        });

        yield buildFrame();
        step += 1;

        // Reset all edge states to idle before marking new active edges.
        for (const edge of edges) {
            edge.state = "idle";
        }

        // Enqueue every unvisited neighbor – they form the next level.
        for (const neighbor of adjacency[current] ?? []) {
            if (visited.has(neighbor)) {
                continue;
            }
            visited.add(neighbor);
            visits += 1;
            queue.push(neighbor);

            const edge = edges.find(
                (e) => e.sourceId === `node-${current}` && e.targetId === `node-${neighbor}`,
            );
            if (edge) {
                edge.state = "active";
            }
            const neighborNode = nodeById.get(`node-${neighbor}`);
            if (neighborNode) {
                neighborNode.state = "visited";
            }
        }

        // This vertex's level is fully expanded.
        if (currentNode) {
            currentNode.state = "visited";
        }

        yield buildFrame();
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `BFS complete – visited ${visits} node(s) level by level.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { visits },
    };
}

/** The BFS module, registered with the engine. */
const module: AlgorithmModule = {
    id: "bfs",
    name: "BFS",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // Same graph as DFS so the traversal orders can be contrasted.
    defaultInput: {
        graph: { A: ["B", "C"], B: ["A", "D"], C: ["A", "E"], D: ["B", "E"], E: ["C", "D"] },
        start: "A",
    },
    visualType: "graph",
    run,
};

export default module;
