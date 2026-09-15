/**
 * floyd-warshall.ts – Floyd-Warshall (All-Pairs Shortest Path)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Floyd-Warshall computes the shortest path between *every* pair of vertices
 * in one go. It maintains a matrix `dist[u][v]` and considers each vertex k as
 * a possible "intermediate": the path u → k → v is shorter than u → v, then
 * the distance is updated. After all k have been considered, the matrix holds
 * all-pairs shortest distances. The classic triple-nested loop is its defining
 * feature.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V³) – three nested loops over the vertex set
 *   Space: O(V²) for the distance matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The intermediate vertex k is highlighted each outer iteration.
 *   - The cell (u,v) being updated is YELLOW (comparing).
 *   - Updated cells are GREEN (sorted).
 *   - The matrix layout positions cells by (row, col) = (u, v).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Handles negative weights (but not negative cycles, which it can detect).
 *   - The grid visualization makes the matrix structure obvious.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build the matrix of cell entities for a frame.
 *
 * @param matrix The V×V distance matrix.
 * @param vertices The vertex labels (row/col headers use indices).
 * @param states Optional `row,col` → state overrides for this frame.
 * @returns An array of `VisualEntity` cells with row/col metadata.
 */
function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const matrixRow = matrix[row];
        if (!matrixRow) {
            continue;
        }
        for (let col = 0; col < matrixRow.length; col += 1) {
            const value = matrixRow[col];
            if (value === undefined) {
                continue;
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: value === Infinity ? "∞" : String(value),
                value,
                state: states.get(`${row},${col}`) ?? "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return cells;
}

/**
 * The Floyd-Warshall generator.
 *
 * @param input `{ graph, vertices? }` – a weighted adjacency list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            vertices?: string[];
        } | null) ?? {};
    const graph: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 3],
            ["C", 8],
        ],
        B: [
            ["C", 2],
            ["D", 7],
        ],
        C: [
            ["D", 1],
            ["A", -4],
        ],
        D: [["C", 5]],
    };
    const vertices = task.vertices ?? ["A", "B", "C", "D"];

    const n = vertices.length;

    // Initialize the distance matrix: 0 on the diagonal, weight along edges,
    // Infinity elsewhere.
    const dist: number[][] = Array.from({ length: n }, () => new Array(n).fill(Infinity));
    for (let i = 0; i < n; i += 1) {
        dist[i][i] = 0;
    }
    for (const [from, neighbors] of Object.entries(graph)) {
        const fromIndex = vertices.indexOf(from);
        for (const [to, weight] of neighbors) {
            const toIndex = vertices.indexOf(to);
            if (fromIndex >= 0 && toIndex >= 0) {
                dist[fromIndex][toIndex] = weight;
            }
        }
    }

    let step = 0;

    // Frame 0: the initial distance matrix.
    yield {
        stepNumber: step,
        entities: makeCells(dist),
        edges: [],
        description: "Initial distance matrix – 0 on the diagonal, edge weights elsewhere, infinity otherwise.",
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: n, cols: n, settled: 0, visits: 0 },
    };
    step += 1;

    // The triple-nested Floyd-Warshall loop.
    for (let k = 0; k < n; k += 1) {
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                const direct = dist[i]?.[j];
                const viaK = (dist[i]?.[k] ?? Infinity) + (dist[k]?.[j] ?? Infinity);
                if (direct === undefined) {
                    continue;
                }

                // If a better route through k exists, update the cell.
                if (viaK < direct) {
                    dist[i][j] = viaK;
                }

                const states = new Map<string, EntityState>([
                    [`${k},${k}`, "pivot"],
                    [`${i},${j}`, "comparing"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeCells(dist, states),
                    edges: [],
                    description: `Checking ${vertices[i]} → ${vertices[k]} → ${vertices[j]}: direct ${direct === Infinity ? "∞" : direct} versus via ${vertices[k]} ${viaK === Infinity ? "∞" : viaK}.`,
                    codeLineNumber: 2,
                    layout: "matrix",
                    meta: { rows: n, cols: n, k, settled: k, visits: i * n + j },
                };
                step += 1;
            }
        }

        yield {
            stepNumber: step,
            entities: makeCells(dist),
            edges: [],
            description: `Pass with intermediate ${vertices[k]} complete – all routes through it are now optimal.`,
            codeLineNumber: 4,
            layout: "matrix",
            meta: { rows: n, cols: n, k, settled: k + 1, visits: (k + 1) * n * n },
        };
        step += 1;
    }

    // Detect negative cycles: any negative diagonal entry is a red flag.
    let hasNegativeCycle = false;
    for (let i = 0; i < n; i += 1) {
        if ((dist[i]?.[i] ?? 0) < 0) {
            hasNegativeCycle = true;
            break;
        }
    }

    const finalStates = new Map<string, EntityState>();
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            finalStates.set(`${i},${j}`, "sorted");
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(dist, finalStates),
        edges: [],
        description: hasNegativeCycle
            ? "Negative cycle detected – distances are not well-defined."
            : `All-pairs shortest paths computed over ${n} vertices – matrix holds every optimal distance.`,
        codeLineNumber: 6,
        layout: "matrix",
        meta: { rows: n, cols: n, settled: n, visits: n * n * n, negativeCycle: hasNegativeCycle },
    };
}

/** The Floyd-Warshall module, registered with the engine. */
const module: AlgorithmModule = {
    id: "floyd-warshall",
    name: "Floyd-Warshall",
    category: "shortest-path",
    complexity: { time: "O(V³)", space: "O(V²)" },
    // Includes a negative edge (C→A = −4) to show off the all-pairs results.
    defaultInput: {
        graph: {
            A: [
                ["B", 3],
                ["C", 8],
            ],
            B: [
                ["C", 2],
                ["D", 7],
            ],
            C: [
                ["D", 1],
                ["A", -4],
            ],
            D: [["C", 5]],
        },
        vertices: ["A", "B", "C", "D"],
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "dist[u][v] ← weight(u,v), 0 on diagonal, ∞ otherwise",
        "for each intermediate k over all vertices",
        "for each pair (u,v): compare direct versus via k",
        "if dist[u][k]+dist[k][v] < dist[u][v] then update",
        "end of k pass: routes through k are optimal",
        "check diagonal: dist[v][v] < 0 means cycle",
        "done: matrix holds all-pairs shortest distances",
    ],
};

export default module;
