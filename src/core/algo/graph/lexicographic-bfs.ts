/**
 * lexicographic-bfs.ts – Lexicographic BFS (LBFS)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lexicographic BFS is a special BFS variant used in chordal-graph
 * recognition and other perfect-graph algorithms. Instead of a plain queue,
 * it keeps a set of "partitioned" sets: the unvisited vertices are arranged in
 * blocks, and each iteration chooses a vertex from the first non-empty block
 * while splitting other blocks according to whether their vertices are
 * adjacent to the chosen vertex. The label assigned to each vertex reflects
 * the order in which it is selected; two vertices get the same prefix of
 * labels iff their closed neighborhoods order identically.
 *
 * This educational version uses a simple priority queue keyed by a generated
 * binary label string, which produces the same *order* without the full
 * partition machinery.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) with proper data structures (O(V²) naive)
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being labeled is YELLOW (comparing).
 *   - Its label is shown on the node.
 *   - Labelled vertices are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - A refinement of BFS used in structural graph theory.
 *   - The name comes from the lexicographic ordering of the generated labels.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

/**
 * The Lexicographic BFS generator.
 *
 * @param input The graph as an adjacency list plus an optional start.
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
    const labels = new Map<string, string>();

    let step = 0;
    let labelCount = 0;

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Starting lexicographic BFS – every vertex gets a label.",
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
    };
    step += 1;

    // Initialize every vertex's label to the empty string.
    for (const v of vertices) {
        labels.set(v, "");
    }

    // Keep selecting until every vertex is labeled.
    while (labels.size > 0) {
        // Pick the vertex whose label is lexicographically greatest.
        let best = "";
        let bestLabel = "";
        for (const [vertex, label] of labels) {
            if (label > bestLabel) {
                best = vertex;
                bestLabel = label;
            }
        }

        // Remove it and record its position in the LBFS ordering.
        labels.delete(best);
        labelCount += 1;

        const node = nodeById.get(`node-${best}`);
        if (node) {
            node.state = "comparing";
            node.label = best;
        }

        const buildFrame = (): VisualFrame => ({
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Selecting ${best} (label "${bestLabel}") as vertex #${labelCount}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { selected: labelCount },
        });

        yield buildFrame();
        step += 1;

        // Append a bit to every remaining vertex's label: 1 if it is adjacent
        // to the selected vertex, 0 otherwise. This is the "splitting" step.
        for (const [vertex, label] of [...labels]) {
            const adjacent = (adjacency[best] ?? []).includes(vertex);
            labels.set(vertex, label + (adjacent ? "1" : "0"));
        }

        // Mark the selected vertex done.
        if (node) {
            node.state = "sorted";
        }

        yield buildFrame();
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `LBFS complete – labeled all ${labelCount} vertex(es).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { selected: labelCount },
    };
}

/** The Lexicographic BFS module, registered with the engine. */
const module: AlgorithmModule = {
    id: "lexicographic-bfs",
    name: "Lexicographic BFS",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // A chordal graph – a good first demonstration of LBFS's labelling.
    defaultInput: {
        graph: { A: ["B", "C"], B: ["A", "D"], C: ["A", "E"], D: ["B", "E"], E: ["C", "D"] },
        start: "A",
    },
    visualType: "graph",
    run,
};

export default module;
