/**
 * dfs-iterative.ts – Depth-First Search (Iterative)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The iterative twin of recursive DFS. Instead of relying on the call stack,
 * it manages an explicit stack of vertices to visit. On each step it pops the
 * top vertex, marks it visited, and pushes its unvisited neighbours. Because
 * the traversal order depends on the stack, an iterative DFS is a great
 * lesson in *explicit vs implicit* state: the recursion's hidden stack is made
 * visible and controllable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E)
 *   Space: O(V) for the explicit stack
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The node at the top of the stack (being processed) is YELLOW (comparing).
 *   - Nodes waiting in the stack are ORANGE (visited).
 *   - The edge taken to reach a node is BLUE (active).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Produces a valid DFS order, though not necessarily the *same* order as
 *     the recursive version (stack discipline differs from call-stack order).
 *   - Avoids stack-overflow risk on very deep graphs.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

/**
 * The iterative DFS generator.
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
        description: `Starting iterative depth-first search from ${start}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { visits },
    };
    step += 1;

    // The explicit stack: vertices discovered but not yet fully explored.
    const stack: string[] = [start];

    while (stack.length > 0) {
        // Pop the most recently discovered vertex (LIFO discipline).
        const current = stack.pop();
        if (!current || visited.has(current)) {
            continue;
        }

        visited.add(current);
        visits += 1;

        const currentNode = nodeById.get(`node-${current}`);
        if (currentNode) {
            currentNode.state = "comparing";
        }

        const buildFrame = (): VisualFrame => ({
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Popping ${current} off the stack and visiting it.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { visits, stackSize: stack.length },
        });

        yield buildFrame();
        step += 1;

        // Reset all edge states to idle before marking new active edges.
        for (const edge of edges) {
            edge.state = "idle";
        }

        // Push unvisited neighbours so they are explored next. Reversed so the
        // first neighbour is popped first (mimics recursive order).
        const neighbours = adjacency[current] ?? [];
        for (let i = neighbours.length - 1; i >= 0; i -= 1) {
            const neighbour = neighbours[i];
            if (!neighbour || visited.has(neighbour)) {
                continue;
            }
            stack.push(neighbour);

            // Light up the edge that will lead us to this neighbour.
            const edge = edges.find(
                (e) => e.sourceId === `node-${current}` && e.targetId === `node-${neighbour}`,
            );
            if (edge) {
                edge.state = "active";
            }
        }

        // Mark the current node fully visited (exploration continues elsewhere).
        const doneNode = nodeById.get(`node-${current}`);
        if (doneNode) {
            doneNode.state = "visited";
        }

        yield buildFrame();
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Iterative DFS complete – visited ${visits} node(s).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { visits },
    };
}

/** The DFS (Iterative) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "dfs-iterative",
    name: "DFS (Iterative)",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // Same graph as the recursive version for a direct comparison.
    defaultInput: {
        graph: { A: ["B", "C"], B: ["A", "D"], C: ["A", "E"], D: ["B", "E"], E: ["C", "D"] },
        start: "A",
    },
    visualType: "graph",
    run,
};

export default module;
