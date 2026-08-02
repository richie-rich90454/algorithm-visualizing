/**
 * adjacency-list.ts – Adjacency List
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An adjacency list stores a graph as V lists: for each vertex, a list of its
 * neighbours (and weights). It uses only O(V + E) memory – ideal for sparse
 * graphs – and lists a vertex's neighbours in O(degree) time. The cost is an
 * O(degree) check for whether a specific edge exists.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   List neighbours: O(degree)
 *   Edge check:      O(degree)
 *   Space:           O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - Each vertex row shows its neighbour list.
 *   - The queried vertex is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The sparse-graph default representation.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * The Adjacency List generator.
 *
 * @param input `{ adjacency, query }` – the list and a vertex to inspect.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Record<string, string[]>; query?: string } | null) ?? {};
    const adjacency: Record<string, string[]> = task.adjacency ?? {
        A: ["B", "C"],
        B: ["A", "D"],
        C: ["A", "D"],
        D: ["B", "C"],
    };
    const query = task.query ?? "B";

    const vertices = Object.keys(adjacency);
    let step = 0;

    const makeCells = (active = -1): VisualEntity[] => {
        const cells: VisualEntity[] = [];
        let row = 0;
        for (const vertex of vertices) {
            const neighbours = adjacency[vertex] ?? [];
            // Vertex cell.
            cells.push({
                id: `v-${vertex}`,
                type: "cell" as const,
                label: vertex,
                value: vertex,
                state: (row === active ? "comparing" : "sorted") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col: 0 },
            });
            // Neighbour cells.
            neighbours.forEach((neighbour, col) => {
                cells.push({
                    id: `n-${vertex}-${col}`,
                    type: "cell" as const,
                    label: neighbour,
                    value: neighbour,
                    state: (row === active ? "highlight" : "unvisited") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col: col + 1 },
                });
            });
            row += 1;
        }
        return cells;
    };

    // Frame 0: the whole structure.
    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Adjacency list with ${vertices.length} vertices – inspecting ${query}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { vertices: vertices.length },
    };
    step += 1;

    // Inspect the queried vertex.
    const queryIndex = vertices.indexOf(query);
    yield {
        stepNumber: step,
        entities: makeCells(queryIndex),
        edges: [],
        description: `Neighbours of ${query}: [${(adjacency[query] ?? []).join(", ")}] – listed in O(degree) time.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { vertices: vertices.length, degree: (adjacency[query] ?? []).length },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Memory usage is O(V + E) – the sparse-graph favourite.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { vertices: vertices.length },
    };
}

/** The Adjacency List module, registered with the engine. */
const module: AlgorithmModule = {
    id: "adjacency-list",
    name: "Adjacency List",
    category: "data-structures",
    complexity: { time: "O(degree) edge check", space: "O(V + E)" },
    defaultInput: {
        adjacency: { A: ["B", "C"], B: ["A", "D"], C: ["A", "D"], D: ["B", "C"] },
        query: "B",
    },
    visualType: "grid",
    run,
};

export default module;
