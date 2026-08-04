/**
 * gabow-scc.ts – Gabow's Algorithm (Strongly Connected Components)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gabow's algorithm is the iterative cousin of Tarjan's SCC algorithm. Where
 * Tarjan tracks a single `lowlink` value per vertex, Gabow keeps two stacks:
 *
 *   - `stack`     – the vertices of the current DFS path (candidates for the
 *                   current SCC).
 *   - `pathStack` – a mirror that remembers where each new SCC boundary sits.
 *
 * When a back edge is found, the path stack is popped back, and when a vertex
 * finishes as the root of a component, everything above its boundary on the
 * main stack is popped into one SCC.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E)
 *   Space: O(V) – two explicit stacks, no recursion
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices on the DFS stack are YELLOW (comparing).
 *   - Popped SCCs are colored per component (sorted / path / highlight).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Same O(V + E) as Tarjan, but iterative and using two stacks.
 *   - A great bridge between the recursive Tarjan version and fully
 *     iterative graph algorithms.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

/**
 * The Gabow SCC generator.
 *
 * @param input The graph as an adjacency list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B"],
        B: ["C", "E"],
        C: ["A", "F"],
        D: ["C"],
        E: ["D"],
        F: ["F"],
    };

    const vertices = Object.keys(adjacency);
    const nodes = makeGraphNodes(vertices);
    const edges = makeGraphEdges(adjacency);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    let step = 0;
    let nextIndex = 0;
    const index = new Map<string, number>();
    const stack: string[] = [];
    const pathStack: string[] = [];
    const components: string[][] = [];

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Gabow's algorithm – iterative SCC with two stacks.",
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
        meta: { components: components.length },
    });

    const componentColors = ["sorted", "path", "highlight"] as const;

    // Process each unvisited vertex.
    for (const start of vertices) {
        if (index.get(start) !== undefined) {
            continue;
        }

        // Push the start vertex onto both stacks and assign its index.
        index.set(start, nextIndex);
        nextIndex += 1;
        stack.push(start);
        pathStack.push(start);

        const startNode = nodeById.get(`node-${start}`);
        if (startNode) {
            startNode.state = "comparing";
        }
        yield buildFrame(`Starting DFS from ${start}.`);
        step += 1;

        // Iterative DFS using an explicit work stack of (vertex, neighbourPos).
        type Work = { vertex: string; pos: number };
        const work: Work[] = [{ vertex: start, pos: 0 }];

        while (work.length > 0) {
            const frame = work[work.length - 1];
            if (!frame) {
                break;
            }
            const { vertex, pos } = frame;
            const neighbors = adjacency[vertex] ?? [];

            if (pos < neighbors.length) {
                frame.pos += 1;
                const neighbor = neighbors[pos];
                if (neighbor === undefined) {
                    continue;
                }

                if (index.get(neighbor) === undefined) {
                    // Tree edge: discover the neighbor.
                    index.set(neighbor, nextIndex);
                    nextIndex += 1;
                    stack.push(neighbor);
                    pathStack.push(neighbor);

                    const neighborNode = nodeById.get(`node-${neighbor}`);
                    if (neighborNode) {
                        neighborNode.state = "comparing";
                    }
                    yield buildFrame(`Descending into ${neighbor}.`);
                    step += 1;

                    work.push({ vertex: neighbor, pos: 0 });
                } else if (pathStack.includes(neighbor)) {
                    // Back edge to a vertex on the current path: pop the path
                    // stack down to it, marking the SCC boundary.
                    while (pathStack.length > 0 && pathStack[pathStack.length - 1] !== neighbor) {
                        pathStack.pop();
                    }
                    yield buildFrame(
                        `Back edge from ${vertex} to ${neighbor} – shrinking the path.`,
                    );
                    step += 1;
                }
            } else {
                // All neighbors processed: finish this vertex.
                work.pop();
                if (pathStack[pathStack.length - 1] === vertex) {
                    // Vertex is the root of an SCC: pop everything above its
                    // boundary on the main stack.
                    pathStack.pop();
                    const component: string[] = [];
                    let popped: string | undefined;
                    do {
                        popped = stack.pop();
                        if (popped) {
                            component.push(popped);
                        }
                    } while (popped !== vertex && popped !== undefined);

                    components.push(component);
                    const color =
                        componentColors[(components.length - 1) % componentColors.length];
                    for (const member of component) {
                        const memberNode = nodeById.get(`node-${member}`);
                        if (memberNode) {
                            memberNode.state = color;
                        }
                    }
                    yield buildFrame(`SCC #${components.length}: {${component.join(", ")}}.`);
                    step += 1;
                }
            }
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Gabow complete – found ${components.length} strongly connected component(s).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { components: components.length },
    };
}

/** The Gabow SCC module, registered with the engine. */
const module: AlgorithmModule = {
    id: "gabow-scc",
    name: "Gabow SCC",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // Same SCC test graph as Tarjan/Kosaraju for comparison.
    defaultInput: {
        graph: {
            A: ["B"],
            B: ["C", "E"],
            C: ["A", "F"],
            D: ["C"],
            E: ["D"],
            F: ["F"],
        },
    },
    visualType: "graph",
    run,
};

export default module;
