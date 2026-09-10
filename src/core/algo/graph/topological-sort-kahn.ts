/**
 * topological-sort-kahn.ts – Topological Sort (Kahn's algorithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A topological ordering of a directed acyclic graph (DAG) is an ordering of
 * the vertices such that every edge points from an earlier vertex to a later
 * one – in other words, "prerequisites always come first". Kahn's algorithm
 * computes one by repeatedly removing vertices with zero in-degree: such a
 * vertex has no remaining prerequisites, so it can be output, and removing it
 * decrements the in-degree of its successors, possibly freeing new zero-in-
 * degree vertices.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) – each vertex and edge is processed once
 *   Space: O(V) for the in-degree map and the queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being emitted is YELLOW (comparing).
 *   - Vertices with in-degree zero (ready to go) are ORANGE (visited).
 *   - Emitted vertices are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Only defined for DAGs; a cycle means no valid ordering exists.
 *   - Kahn's queue-based method contrasts with the DFS-based approach.
 *   - The output order is not unique in general.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

/**
 * The Kahn's Topological Sort generator.
 *
 * @param input The graph as an adjacency list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: [],
        B: ["A"],
        C: ["A"],
        D: ["B", "C"],
        E: ["D"],
    };

    const vertices = Object.keys(adjacency);
    const nodes = makeGraphNodes(vertices);
    const edges = makeGraphEdges(adjacency);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Compute the in-degree of every vertex (number of incoming edges).
    const inDegree: Record<string, number> = {};
    for (const v of vertices) {
        inDegree[v] = 0;
    }
    for (const neighbors of Object.values(adjacency)) {
        for (const neighbor of neighbors) {
            inDegree[neighbor] = (inDegree[neighbor] ?? 0) + 1;
        }
    }

    let step = 0;
    const order: string[] = [];

    // Frame 0: the untouched graph with in-degrees shown.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Computing topological order with Kahn's algorithm (in-degrees listed).",
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
    };
    step += 1;

    // The ready queue holds vertices with no remaining prerequisites.
    const queue: string[] = vertices.filter((v) => (inDegree[v] ?? 0) === 0);

    // Mark the initially-ready vertices.
    for (const v of queue) {
        const node = nodeById.get(`node-${v}`);
        if (node) {
            node.state = "visited";
        }
    }

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "graph",
        meta: { emitted: order.length },
    });

    yield buildFrame(`Ready queue seeded with zero-in-degree vertices: [${queue.join(", ")}].`);
    step += 1;

    while (queue.length > 0) {
        // Dequeue the next ready vertex.
        const current = queue.shift();
        if (!current) {
            continue;
        }

        const currentNode = nodeById.get(`node-${current}`);
        if (currentNode) {
            currentNode.state = "comparing";
        }
        yield buildFrame(`Dequeued ${current} – it has no remaining prerequisites.`);
        step += 1;

        // Emit the vertex and free its successors.
        order.push(current);
        const freed: string[] = [];
        for (const neighbor of adjacency[current] ?? []) {
            inDegree[neighbor] = (inDegree[neighbor] ?? 0) - 1;
            // A successor that reached zero in-degree is now ready.
            if ((inDegree[neighbor] ?? 0) === 0) {
                queue.push(neighbor);
                freed.push(neighbor);
                const neighborNode = nodeById.get(`node-${neighbor}`);
                if (neighborNode) {
                    neighborNode.state = "visited";
                }
            }
        }

        if (currentNode) {
            currentNode.state = "sorted";
        }
        yield buildFrame(
            freed.length > 0
                ? `Emitted ${current} (#${order.length}); freed ${freed.join(", ")} – queue: [${queue.join(", ")}].`
                : `Emitted ${current} (#${order.length}); nothing newly freed – queue: [${queue.join(", ")}].`,
        );
        step += 1;
    }

    // If the order is shorter than the vertex count, a cycle blocked progress.
    const hasCycle = order.length < vertices.length;
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: hasCycle
            ? "Cycle detected – no topological order exists."
            : `Topological order: ${order.join(" → ")}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { emitted: order.length, hasCycle },
    };
}

/** The Topological Sort (Kahn) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "topological-sort-kahn",
    name: "Topological Sort (Kahn)",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // A classic prerequisite chain: E depends on D, D on B and C, B and C on A.
    defaultInput: {
        graph: { A: [], B: ["A"], C: ["A"], D: ["B", "C"], E: ["D"] },
    },
    visualType: "graph",
    run,
};

export default module;
