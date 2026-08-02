/**
 * incidence-matrix.ts – Incidence Matrix
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An incidence matrix has one row per vertex and one column per edge; entry
 * [v][e] is 1 if edge e touches vertex v. For directed graphs it uses −1 for
 * the tail and +1 for the head. This representation makes "which edges touch
 * this vertex?" a single column scan, but it uses O(V·E) space.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Edge check: O(V) (scan the edge's column)
 *   Space:      O(V·E)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The matrix is a grid; rows are vertices, columns are edges.
 *   - The inspected column is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The vertex×edge grid is the entire idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * The Incidence Matrix generator.
 *
 * @param input `{ vertices, edges, inspect }` – vertex labels, edge triples,
 *        and the edge to inspect.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            vertices?: string[];
            edges?: Array<[string, string]>;
            inspect?: number;
        } | null) ?? {};
    const vertices = task.vertices ?? ["A", "B", "C", "D"];
    const edges = task.edges ?? [
        ["A", "B"],
        ["A", "C"],
        ["B", "D"],
        ["C", "D"],
    ];
    const inspect = typeof task.inspect === "number" ? task.inspect : 2;

    let step = 0;

    // Build the incidence matrix.
    const matrix: number[][] = vertices.map((vertex) =>
        edges.map(([u, v]) => {
            if (u === vertex) {
                return -1; // tail of a directed edge
            }
            if (v === vertex) {
                return 1; // head of a directed edge
            }
            return 0;
        }),
    );

    const makeCells = (activeCol = -1): VisualEntity[] => {
        const cells: VisualEntity[] = [];
        matrix.forEach((row, r) => {
            row.forEach((value, c) => {
                cells.push({
                    id: `cell-${r}-${c}`,
                    type: "cell" as const,
                    label: String(value),
                    value,
                    state: (c === activeCol
                        ? "comparing"
                        : value === 0
                          ? "unvisited"
                          : "sorted") as EntityState,
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
        description: `Incidence matrix (${vertices.length} vertices × ${edges.length} edges) – inspecting edge ${inspect}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { vertices: vertices.length, edges: edges.length },
    };
    step += 1;

    // Inspect the edge column.
    yield {
        stepNumber: step,
        entities: makeCells(inspect),
        edges: [],
        description: `Edge ${inspect} (${edges[inspect]?.join("–")}) touches the ±1 rows – readable in one column scan.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { vertices: vertices.length, edges: edges.length },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `The matrix costs O(V·E) cells – dense, but each edge column is self-contained.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { vertices: vertices.length, edges: edges.length },
    };
}

/** The Incidence Matrix module, registered with the engine. */
const module: AlgorithmModule = {
    id: "incidence-matrix",
    name: "Incidence Matrix",
    category: "data-structures",
    complexity: { time: "O(V) edge check", space: "O(V·E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D"],
        edges: [
            ["A", "B"],
            ["A", "C"],
            ["B", "D"],
            ["C", "D"],
        ],
        inspect: 2,
    },
    visualType: "grid",
    run,
};

export default module;
