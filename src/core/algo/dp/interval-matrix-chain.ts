/**
 * interval-matrix-chain.ts – Matrix Chain Multiplication (interval DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given matrices A1..An with dimensions, matrix chain multiplication asks for
 * the parenthesisation that minimizes the number of scalar multiplications.
 * The interval DP:
 *
 *   dp[i][j] = min over k of (dp[i][k] + dp[k+1][j] + p[i-1]·p[k]·p[j])
 *
 * where p[] holds the dimensions. Longer intervals are built from shorter
 * ones, hence "interval DP".
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n³)
 *   Space: O(n²)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The interval being computed is YELLOW (comparing).
 *   - The split point k is PINK (highlight).
 *   - The optimal split is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The canonical interval-DP template.
 *   - The reconstruction of the parenthesisation is a second pass.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a matrix of cell entities for a frame.
 *
 * @param matrix The DP table (Infinity shown as ∞).
 * @param states Optional `row,col` → state overrides.
 * @returns Cell entities with row/col metadata (grid layout).
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
 * The Matrix Chain generator.
 *
 * @param input `{ dims }` – the matrix dimensions p[0..n].
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { dims?: number[] } | null) ?? {};
    const dims = task.dims ?? [30, 35, 15, 5, 10];

    const n = dims.length - 1; // number of matrices
    let step = 0;

    const dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(Infinity));
    for (let i = 0; i < n; i += 1) {
        dp[i][i] = 0;
    }

    // Frame 0: the diagonal is zeroed.
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Matrix chain with ${n} matrices, dimensions [${dims.join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n },
    };
    step += 1;

    // Interval DP: build longer intervals from shorter ones.
    for (let len = 2; len <= n; len += 1) {
        for (let i = 0; i + len - 1 < n; i += 1) {
            const j = i + len - 1;
            let best = Infinity;
            let bestK = -1;

            for (let k = i; k < j; k += 1) {
                const cost =
                    (dp[i]?.[k] ?? 0) +
                    (dp[k + 1]?.[j] ?? 0) +
                    (dims[i] ?? 0) * (dims[k + 1] ?? 0) * (dims[j + 1] ?? 0);
                if (cost < best) {
                    best = cost;
                    bestK = k;
                }

                const states = new Map<string, EntityState>([
                    [`${i},${j}`, "comparing"],
                    [`${i},${k}`, "highlight"],
                    [`${k + 1},${j}`, "highlight"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeCells(dp, states),
                    edges: [],
                    description: `Interval [${i}, ${j}] split at k=${k} → cost ${cost}.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: { rows: n, cols: n },
                };
                step += 1;
            }

            dp[i][j] = best;

            const doneStates = new Map<string, EntityState>([[`${i},${j}`, "sorted"]]);
            yield {
                stepNumber: step,
                entities: makeCells(dp, doneStates),
                edges: [],
                description: `dp[${i}][${j}] = ${best} (best split k=${bestK}).`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { rows: n, cols: n },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Minimum scalar multiplications = ${dp[0]?.[n - 1]}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: n, cols: n, minCost: dp[0]?.[n - 1] },
    };
}

/** The Matrix Chain module, registered with the engine. */
const module: AlgorithmModule = {
    id: "interval-matrix-chain",
    name: "Matrix Chain Multiplication",
    category: "dynamic-programming",
    complexity: { time: "O(n³)", space: "O(n²)" },
    // The classic CLRS example: 4 matrices with dims [30,35,15,5,10].
    defaultInput: { dims: [30, 35, 15, 5, 10] },
    visualType: "grid",
    run,
};

export default module;
