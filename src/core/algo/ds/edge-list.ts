/**
 * edge-list.ts – Edge List
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An edge list stores a graph as a flat list of (u, v, weight) triples. It is
 * the simplest representation: zero structure, just the edges. It is perfect
 * for algorithms that iterate over every edge (Kruskal, Bellman-Ford), but
 * poor for "which edges touch vertex x?" queries, which need a scan.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Iterate all edges: O(E)
 *   Edge check:        O(E)
 *   Space:             O(E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row is an edge (u, v, weight).
 *   - The scanned edge is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Just the edges, no structure" is the entire idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * The Edge List generator.
 *
 * @param input `{ edges }` – edges as [u, v, weight] triples.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { edges?: Array<[string, string, number]> } | null) ?? {};
    const edges = task.edges ?? [
        ["A", "B", 4],
        ["A", "C", 2],
        ["B", "D", 5],
        ["C", "D", 8],
    ];

    let step = 0;

    const makeCells = (active = -1): VisualEntity[] => {
        const cells: VisualEntity[] = [];
        edges.forEach(([u, v, weight], row) => {
            const parts = [u, v, String(weight)];
            parts.forEach((value, col) => {
                cells.push({
                    id: `cell-${row}-${col}`,
                    type: "cell" as const,
                    label: value,
                    value,
                    state: (row === active ? "comparing" : "unvisited") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col },
                });
            });
        });
        return cells;
    };

    // Frame 0: the edge list.
    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Edge list with ${edges.length} edge(s) – iterating for Kruskal/Bellman-Ford style.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { edges: edges.length },
    };
    step += 1;

    // Scan every edge.
    for (let i = 0; i < edges.length; i += 1) {
        const [u, v, weight] = edges[i] ?? ["", "", 0];
        yield {
            stepNumber: step,
            entities: makeCells(i),
            edges: [],
            description: `Scanning edge ${u}–${v} (weight ${weight}).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { edges: edges.length },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Edge list scan complete – every edge visited in O(E).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { edges: edges.length },
    };
}

/** The Edge List module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "An edge list stores a graph as a flat collection of (u, v, weight) triples with no additional indexing. It is the simplest representation and is ideal when an algorithm must examine every edge, such as Kruskal or Bellman-Ford. The price is that questions about a single vertex require scanning the whole list.",
        "invariants": [
            "Each stored triple corresponds to one graph edge.",
            "No separate vertex-to-edge index is maintained.",
            "Total list length equals the edge count."
        ],
        "correctness": "Inserting a triple records exactly that edge, so iterating the list visits every edge once, which is what global algorithms require. Edge existence or neighbor queries scan all triples and report a match exactly when a triple's endpoints fit, so they are correct even if linear.",
        "complexityRationale": "Iterating all edges is O(E) and uses O(E) space with minimal overhead. A single edge check or neighbor query is also O(E) because there is no index.",
        "uses": [
            "Kruskal's minimum spanning tree",
            "Bellman-Ford relaxation loops",
            "Simple graph interchange formats"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 23",
            "Robert Sedgewick and Kevin Wayne, Algorithms, Section 4.1"
        ],
        "workedExample": "Edges (A,B,1), (A,C,2), (B,C,3) are stored as three triples. Kruskal sorts them by weight and scans once; asking whether A connects to C scans all three and finds the second triple, while listing A's neighbors also scans all three."
    },
    id: "edge-list",
    name: "Edge List",
    category: "data-structures",
    complexity: { time: "O(E) iterate", space: "O(E)" },
    defaultInput: {
        edges: [
            ["A", "B", 4],
            ["A", "C", 2],
            ["B", "D", 5],
            ["C", "D", 8],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty edge list with no pairs",
        "insert each edge as (u, v) pair in order",
        "scan list comparing endpoints for queries",
        "answer edge existence by linear scan",
        "count edges by list length",
        "list neighbors by filtering on source",
        "done: edge list stores graph with query answer",
    ],
};

export default module;
