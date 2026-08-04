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
        description: `Neighbours of ${inspect}: [${neighbors.join(", ")}] – the contiguous slice col[${from}..${to}).`,
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
        codeLineNumber: 3,
        layout: "grid",
        meta: { vertices: vertices.length, edges: edges.length },
    };
}

/** The CSR module, registered with the engine. */
const module: AlgorithmModule = {
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
};

export default module;
