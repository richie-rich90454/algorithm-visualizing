/**
 * csr.ts – Compressed Sparse Row (CSR)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CSR is the industry-standard format for sparse graphs and matrices. It
 * stores the graph in three compact arrays: `rowPtr` (start index of each
 * vertex's neighbor list), `col` (the neighbor vertex ids), and `val`
 * (weights). Iterating a vertex's neighbors is a single contiguous range
 * scan, giving excellent cache behavior.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   List neighbors: O(degree) – one contiguous slice
 *   Space:           O(V + E) – three arrays, no wasted cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The three arrays are shown as rows.
 *   - The neighbor slice of the inspected vertex is highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The compact three-array layout is the entire idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * The CSR generator.
 *
 * @param input `{ vertices, edges, inspect }` – vertex labels, directed
 *        edges, and a vertex to inspect.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            vertices?: string[];
            edges?: Array<[string, string]>;
            inspect?: string;
        } | null) ?? {};
    const vertices = task.vertices ?? ["A", "B", "C", "D"];
    const edges = task.edges ?? [
        ["A", "B"],
        ["A", "C"],
        ["B", "D"],
        ["C", "D"],
    ];
    const inspect = task.inspect ?? "A";

    let step = 0;

    // Build the CSR arrays.
    const col: number[] = [];
    const rowPtr = [0];
    const vertexIndex = new Map<string, number>();
    vertices.forEach((v, i) => vertexIndex.set(v, i));

    for (const vertex of vertices) {
        for (const [u, v] of edges) {
            if (u === vertex) {
                col.push(vertexIndex.get(v) ?? 0);
            }
        }
        rowPtr.push(col.length);
    }

    const makeRow = (
        values: Array<string | number>,
        activeFrom = -1,
        activeTo = -1,
    ): VisualEntity[] =>
        values.map((value, index) => ({
            id: `cell-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state:
                index >= activeFrom && index < activeTo
                    ? "comparing"
                    : ("unvisited" as EntityState),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        }));

    // Frame 0: the three arrays.
    yield {
        stepNumber: step,
        entities: [
            ...makeRow(rowPtr),
            ...makeRow(col).map((c) => ({
                ...c,
                id: `col-${c.id}`,
                metadata: { row: 1, col: Number(c.metadata["col"]) },
            })),
        ],
        edges: [],
        description: `CSR arrays: rowPtr [${rowPtr.join(", ")}], col [${col.join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { vertices: vertices.length, edges: edges.length },
    };
    step += 1;

    // Inspect a vertex's neighbor slice.
    const index = vertexIndex.get(inspect) ?? 0;
    const from = rowPtr[index] ?? 0;
    const to = rowPtr[index + 1] ?? 0;
    const neighbors = col.slice(from, to).map((c) => vertices[c]);

    yield {
        stepNumber: step,
        entities: [
            ...makeRow(rowPtr),
            ...makeRow(col, from, to).map((c) => ({
                ...c,
                id: `col-${c.id}`,
                metadata: { row: 1, col: Number(c.metadata["col"]) },
            })),
        ],
        edges: [],
        description: `Neighbors of ${inspect}: [${neighbors.join(", ")}] – the contiguous slice col[${from}..${to}).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { vertices: vertices.length, edges: edges.length, neighbors: neighbors.length },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: [
            ...makeRow(rowPtr),
            ...makeRow(col).map((c) => ({
                ...c,
                id: `col-${c.id}`,
                metadata: { row: 1, col: Number(c.metadata["col"]) },
            })),
        ],
        edges: [],
        description: `CSR uses exactly ${rowPtr.length + col.length} cells – no zeros wasted.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { vertices: vertices.length, edges: edges.length },
    };
}

/** The CSR module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Compressed Sparse Row stores a sparse graph or matrix in three arrays: rowPtr gives where each row starts, col lists column indices, and val holds weights. Neighbors of a vertex occupy one contiguous slice of col, which is cache-friendly. It is the standard format for sparse linear algebra and graph analytics.",
        "invariants": [
            "rowPtr[v] to rowPtr[v+1] delimits vertex v's neighbor slice.",
            "col holds only nonzero column indices, sorted by row.",
            "The last rowPtr entry equals the number of stored nonzeros."
        ],
        "correctness": "Packing edges by source row makes the slice between consecutive rowPtr entries exactly the neighbor list of that vertex. Reading that slice returns all and only the nonzeros in row v. The invariant that rowPtr entries are cumulative counts guarantees no edge is skipped or duplicated.",
        "complexityRationale": "Listing neighbors scans one contiguous slice, O(degree) with excellent locality. The three arrays store O(V + E) entries, avoiding the wasted cells of a dense matrix.",
        "uses": [
            "Sparse matrix-vector multiplication",
            "Graph analytics in frameworks like GraphBLAS",
            "Scientific computing and recommender systems"
        ],
        "references": [
            "Yousef Saad, Iterative Methods for Sparse Linear Systems, Chapter 1",
            "Timothy A. Davis, Direct Methods for Sparse Linear Systems, Section 2.7"
        ],
        "workedExample": "For edges 0-1, 0-2, 1-2, CSR has rowPtr [0, 2, 3, 3], col [1, 2, 2], val [1, 1, 1]. Vertex 0's neighbors are col[0..1] = 1, 2; vertex 1's is col[2] = 2. The final rowPtr entry 3 equals the three stored edges."
    },
    id: "csr",
    name: "CSR (Compressed Sparse Row)",
    category: "data-structures",
    complexity: { time: "O(degree) neighbors", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D"],
        edges: [
            ["A", "B"],
            ["A", "C"],
            ["B", "D"],
            ["C", "D"],
        ],
        inspect: "A",
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize CSR with row pointer array and empty columns",
        "sort edges by row then fill column indices in order",
        "compare row boundaries to slice neighbor range",
        "query neighbors of vertex by scanning column slice",
        "count nonzeros for total edge storage",
        "verify row pointers sum to edge count",
        "done: CSR stores graph with neighbor query answer",
    ],
};

export default module;
