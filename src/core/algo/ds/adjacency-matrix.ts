/**
 * adjacency-matrix.ts – Adjacency Matrix
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An adjacency matrix stores a graph as a V×V matrix where entry [u][v] is 1
 * (or the edge weight) if there is an edge from u to v. Checking whether an
 * edge exists is O(1), but the matrix always costs O(V²) memory, which is
 * wasteful for sparse graphs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Edge check / add / remove: O(1)
 *   List neighbours:           O(V)
 *   Space:                     O(V²)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The matrix is a grid of cells.
 *   - The queried edge cell is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "check any edge in O(1)" strength is the entire point.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * The Adjacency Matrix generator.
 *
 * @param input `{ matrix, query }` – the matrix and an edge query [u, v].
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; query?: [number, number] } | null) ?? {};
    const matrix: number[][] = task.matrix ?? [
        [0, 1, 1, 0],
        [1, 0, 0, 1],
        [1, 0, 0, 1],
        [0, 1, 1, 0],
    ];
    const [qu, qv] = task.query ?? [1, 3];

    let step = 0;

    const makeCells = (highlight: [number, number] | null = null): VisualEntity[] => {
        const cells: VisualEntity[] = [];
        matrix.forEach((row, r) => {
            row.forEach((value, c) => {
                cells.push({
                    id: `cell-${r}-${c}`,
                    type: "cell" as const,
                    label: String(value),
                    value,
                    state:
                        highlight && highlight[0] === r && highlight[1] === c
                            ? "comparing"
                            : ((value ? "sorted" : "unvisited") as EntityState),
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: r, col: c },
                });
            });
        });
        return cells;
    };

    // Frame 0: the matrix.
    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Adjacency matrix (${matrix.length}×${matrix.length}) – checking edge (${qu}, ${qv}).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { size: matrix.length },
    };
    step += 1;

    // Check the edge.
    const edge = matrix[qu]?.[qv] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells([qu, qv]),
        edges: [],
        description: `Edge (${qu}, ${qv}) ${edge ? "EXISTS" : "does not exist"} – answered in O(1).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { edge, exists: edge !== 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `The matrix uses ${matrix.length * matrix.length} cells regardless of how sparse the graph is.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { size: matrix.length },
    };
}

/** The Adjacency Matrix module, registered with the engine. */
const module: AlgorithmModule = {
    id: "adjacency-matrix",
    name: "Adjacency Matrix",
    category: "data-structures",
    complexity: { time: "O(1) edge check", space: "O(V²)" },
    defaultInput: {
        matrix: [
            [0, 1, 1, 0],
            [1, 0, 0, 1],
            [1, 0, 0, 1],
            [0, 1, 1, 0],
        ],
        query: [1, 3],
    },
    visualType: "grid",
    run,
};

export default module;
