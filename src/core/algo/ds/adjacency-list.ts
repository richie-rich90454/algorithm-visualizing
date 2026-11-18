/**
 * adjacency-list.ts – Adjacency List
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An adjacency list stores a graph as V lists: for each vertex, a list of its
 * neighbors (and weights). It uses only O(V + E) memory – ideal for sparse
 * graphs – and lists a vertex's neighbors in O(degree) time. The cost is an
 * O(degree) check for whether a specific edge exists.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   List neighbors: O(degree)
 *   Edge check:      O(degree)
 *   Space:           O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each vertex row shows its neighbor list.
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
            const neighbors = adjacency[vertex] ?? [];
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
            // Neighbor cells.
            neighbors.forEach((neighbor, col) => {
                cells.push({
                    id: `n-${vertex}-${col}`,
                    type: "cell" as const,
                    label: neighbor,
                    value: neighbor,
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
        description: `Neighbors of ${query}: [${(adjacency[query] ?? []).join(", ")}] – listed in O(degree) time.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { vertices: vertices.length, degree: (adjacency[query] ?? []).length },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Memory usage is O(V + E) – the sparse-graph favorite.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { vertices: vertices.length },
    };
}

/** The Adjacency List module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "An adjacency list keeps one list per vertex containing exactly that vertex's neighbors. Inserting an edge appends to the source list, and listing a vertex's neighbors just reads its own list. This stores only edges that exist, so it is compact for sparse graphs, at the price of scanning a list to test whether a specific edge is present.",
        "invariants": [
            "Each vertex maps to the list of its outgoing neighbors.",
            "For an undirected graph every edge appears in both endpoints' lists.",
            "Total entries across all lists equals twice the edge count in an undirected graph."
        ],
        "correctness": "Appending an edge to the source list records exactly that incidence, so enumerating a vertex's list returns precisely its neighbors. For undirected graphs adding the reverse entry keeps both endpoints consistent. An edge-existence test scans the source list and is correct because every neighbor is present and no non-neighbor is stored.",
        "complexityRationale": "Storage is proportional to vertices plus edges, giving O(V + E) space. Listing neighbors or testing an edge scans a list of length equal to the degree, so both cost O(degree).",
        "uses": [
            "Sparse graph storage in social and road networks",
            "Breadth-first and depth-first search",
            "Compiler interference and dependency graphs"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 22",
            "Robert Sedgewick and Kevin Wayne, Algorithms, Section 4.1"
        ],
        "workedExample": "For vertices A, B, C with edges A-B, A-C, B-C, the lists are A: [B, C], B: [A, C], C: [A, B]. Querying neighbors of A reads A's list and returns B and C after two entries. Testing A to C succeeds; testing A to a missing vertex scans the whole list and fails."
    },
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
    pseudocode: [
        "initialize empty adjacency list with one list per vertex",
        "insert each edge by appending neighbor to source list",
        "compare vertex degrees while scanning neighbor lists",
        "look up neighbors of query vertex by reading its list",
        "count total edges across all adjacency lists",
        "verify symmetric entries for undirected edges",
        "done: adjacency lists store graph and neighbor query answer",
    ],
};

export default module;
