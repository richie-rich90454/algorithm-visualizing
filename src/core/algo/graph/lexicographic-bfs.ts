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
 *   - Labeled vertices are GREEN (sorted).
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
        meta: { selected: labelCount },
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
        // All remaining labels tie (e.g. the empty first round): honor the
        // requested start, otherwise take the first remaining vertex.
        if (best === "") {
            best = labels.has(start) ? start : ([...labels.keys()][0] ?? "");
            bestLabel = labels.get(best) ?? "";
        }

        // Remove it and record its position in the LBFS ordering.
        labels.delete(best);
        labelCount += 1;

        const node = nodeById.get(`node-${best}`);
        if (node) {
            node.state = "comparing";
            node.label = best;
        }

        const buildFrame = (message: string, line = 2): VisualFrame => ({
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: { selected: labelCount },
        });

        yield buildFrame(`Selecting ${best} (label "${bestLabel}") as vertex #${labelCount}.`, 1);
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

        yield buildFrame(`Updated neighbor labels after selecting ${best}.`);
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

    education: {
        "intuition": "Lexicographic BFS orders vertices by the lexicographic order of their neighborhood sequences, which is useful in chordal graph recognition and perfect graph theory. Instead of a plain queue it repeatedly picks the unvisited vertex with the largest label and appends a bit to each remaining label according to whether that vertex is a neighbor.",
        "invariants": [
            "Labels encode the adjacency pattern to already-selected vertices.",
            "The next selected vertex is the unvisited one with the largest label.",
            "Two vertices share a label prefix exactly when their neighborhoods to the selected set agree."
        ],
        "correctness": "Appending a one or zero for adjacency to the chosen vertex extends labels in a way that preserves lexicographic ordering of neighborhood sequences. Always taking the largest label therefore reproduces the lexicographic ordering, and the resulting order satisfies the properties needed by perfect elimination ordering algorithms.",
        "complexityRationale": "With proper partitioned-set data structures the ordering takes O(V + E); the simple label-string version shown is slower but uses O(V) space for labels and the visited set.",
        "uses": [
            "Chordal graph recognition and perfect elimination orderings",
            "Algorithms for perfect graphs",
            "Canonical labeling heuristics in graph isomorphism"
        ],
        "references": [
            "Rose, Tarjan, and Lueker, Algorithmic Aspects of Vertex Elimination on Graphs (1976)",
            "Golumbic, Algorithmic Graph Theory and Perfect Graphs"
        ],
        "workedExample": "Vertices start with empty labels; the largest label is chosen first and every remaining vertex gets a bit appended for whether it neighbors the choice. Repeating until all vertices are selected gives an ordering such as A, B, D, C, E that reflects their neighborhood patterns."
    },
    id: "lexicographic-bfs",
    name: "Lexicographic BFS",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // A chordal graph – a good first demonstration of LBFS's labeling.
    defaultInput: {
        graph: { A: ["B", "C"], B: ["A", "D"], C: ["A", "E"], D: ["B", "E"], E: ["C", "D"] },
        start: "A",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "label every vertex with the empty string",
        "pick the unselected vertex of lexicographically largest label",
        "append 1 (neighbor) or 0 to each remaining label and repeat",
        "mark each selected vertex done in LBFS order",
        "done: full lexicographic ordering of all vertices",
    ],
};

export default module;
