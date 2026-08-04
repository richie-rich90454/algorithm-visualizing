/**
 * hierholzer-eulerian.ts – Hierholzer's Algorithm (Eulerian Circuit)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An Eulerian circuit is a closed walk that uses every edge exactly once. For
 * a directed graph to have one, every vertex must have equal in-degree and
 * out-degree, and the graph must be strongly connected (ignoring isolated
 * vertices). Hierholzer's algorithm builds the circuit greedily:
 *
 *   1. Start at any vertex and follow unused edges until you return to the
 *      start (a subtour).
 *   2. If any vertex on the subtour still has unused edges, splice a new
 *      subtour into the circuit at that vertex.
 *   3. Repeat until every edge is consumed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E) – every edge is traversed once
 *   Space: O(V + E) for the adjacency bookkeeping
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The edge currently being traversed is BLUE (active).
 *   - Edges already in the circuit are GREEN (sorted).
 *   - The current vertex is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Solves the "postman problem" on a directed graph.
 *   - The splice-in-subtour trick is the algorithmic heart to teach.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

/**
 * The Hierholzer Eulerian Circuit generator.
 *
 * @param input The directed graph as an adjacency list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    // A graph with a clean Eulerian circuit: A→B→C→A→D→E→A.
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "D"],
        B: ["C"],
        C: ["A"],
        D: ["E"],
        E: ["A"],
    };

    const vertices = Object.keys(adjacency);
    const nodes = makeGraphNodes(vertices);
    const edges = makeGraphEdges(adjacency);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const edgeById = new Map(edges.map((e) => [e.id, e]));

    // A mutable work copy of the adjacency so edges can be "consumed".
    const remaining: Record<string, string[]> = {};
    for (const [v, neighbors] of Object.entries(adjacency)) {
        remaining[v] = [...neighbors];
    }

    let step = 0;
    const circuit: string[] = [];

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Hierholzer's algorithm – building an Eulerian circuit edge by edge.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { circuitLength: 0 },
    };
    step += 1;

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "graph",
        meta: { circuitLength: circuit.length },
    });

    // Find a vertex with any edges left to start from.
    let start = "";
    for (const v of vertices) {
        if ((remaining[v]?.length ?? 0) > 0) {
            start = v;
            break;
        }
    }

    if (!start) {
        // No edges at all – trivially empty circuit.
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: "Empty graph – the circuit is empty.",
            codeLineNumber: 4,
            layout: "graph",
            meta: { circuitLength: 0 },
        };
        return;
    }

    // The work stack implements the recursive subtour construction iteratively.
    const stack: string[] = [start];
    const startNode = nodeById.get(`node-${start}`);
    if (startNode) {
        startNode.state = "comparing";
    }
    yield buildFrame(`Starting the circuit at ${start}.`);
    step += 1;

    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        if (!current) {
            break;
        }

        const nextNeighbor = remaining[current]?.pop();
        if (nextNeighbor === undefined) {
            // No more edges from here: the current vertex is done, pop it into
            // the circuit (this reverses the discovery order, which is the
            // classic Hierholzer final step).
            stack.pop();
            circuit.push(current);
            continue;
        }

        // Traverse the edge current → nextNeighbor.
        const edge = edgeById.get(`edge-${current}-${nextNeighbor}`);
        if (edge) {
            edge.state = "sorted";
        }

        const currentNode = nodeById.get(`node-${current}`);
        const nextNode = nodeById.get(`node-${nextNeighbor}`);
        if (currentNode) {
            currentNode.state = "visited";
        }
        if (nextNode) {
            nextNode.state = "comparing";
        }

        yield buildFrame(`Traversing edge ${current} → ${nextNeighbor}.`);
        step += 1;

        stack.push(nextNeighbor);
    }

    // The circuit built by popping is reversed; reverse it for display order.
    const orderedCircuit = [...circuit].reverse();

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Eulerian circuit: ${orderedCircuit.join(" → ")}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { circuitLength: orderedCircuit.length },
    };
}

/** The Hierholzer Eulerian module, registered with the engine. */
const module: AlgorithmModule = {
    id: "hierholzer-eulerian",
    name: "Hierholzer Eulerian",
    category: "graph",
    complexity: { time: "O(E)", space: "O(V + E)" },
    // A balanced directed graph admitting an Eulerian circuit.
    defaultInput: {
        graph: { A: ["B", "D"], B: ["C"], C: ["A"], D: ["E"], E: ["A"] },
    },
    visualType: "graph",
    run,
};

export default module;
