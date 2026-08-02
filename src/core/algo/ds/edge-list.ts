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
 * Visualisation mapping
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
        codeLineNumber: 3,
        layout: "grid",
        meta: { edges: edges.length },
    };
}

/** The Edge List module, registered with the engine. */
const module: AlgorithmModule = {
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
};

export default module;
