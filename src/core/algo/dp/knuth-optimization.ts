/**
 * knuth-optimization.ts – Knuth's Optimization (optimal BST-style DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Knuth's optimization speeds up interval DPs of the form
 *
 *   dp[i][j] = min over k of (dp[i][k] + dp[k+1][j] + w(i, j))
 *
 * when w satisfies the quadrangle inequality. The key fact: the optimal split
 * point is monotonic, opt[i][j-1] ≤ opt[i][j] ≤ opt[i+1][j], which shrinks
 * the k-search range and turns O(n³) into O(n²).
 *
 * The example problem is the classic "optimal binary search tree" cost.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n²) with the monotonic-split trick (vs O(n³) naive)
 *   Space: O(n²)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The interval cell being solved is YELLOW (comparing).
 *   - The restricted split range is PINK (highlight).
 *   - The optimal split is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The monotonicity assumption is the entire trick.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a matrix of cell entities for a frame.
 *
 * @param matrix The DP table.
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

/** Sum of frequencies from i to j (inclusive). */
function freqSum(freq: number[], i: number, j: number): number {
    let sum = 0;
    for (let k = i; k <= j; k += 1) {
        sum += freq[k] ?? 0;
    }
    return sum;
}

/**
 * The Knuth Optimization generator.
 *
 * @param input `{ freq }` – the key access frequencies.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { freq?: number[] } | null) ?? {};
    const freq = task.freq ?? [4, 2, 6, 3];

    const n = freq.length;
    let step = 0;

    // dp[i][j] = min cost BST for keys i..j. opt[i][j] = optimal split.
    const dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const opt: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));

    for (let i = 0; i < n; i += 1) {
        dp[i][i] = freq[i] ?? 0;
        opt[i][i] = i;
    }

    // Frame 0: the diagonal is the leaf cost.
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Optimal BST with frequencies [${freq.join(", ")}] using Knuth's optimization.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n },
    };
    step += 1;

    // Interval DP with monotonic split restriction.
    for (let len = 2; len <= n; len += 1) {
        for (let i = 0; i + len - 1 < n; i += 1) {
            const j = i + len - 1;
            const sum = freqSum(freq, i, j);

            // Search only in [opt[i][j-1], opt[i+1][j]] (Knuth's trick).
            const lo = i < j ? (opt[i]?.[j - 1] ?? i) : i;
            const hi = i + 1 < n ? (opt[i + 1]?.[j] ?? j) : j;

            let best = Infinity;
            let bestK = lo;
            for (let k = lo; k <= hi; k += 1) {
                const left = k > i ? (dp[i]?.[k - 1] ?? 0) : 0;
                const right = k < j ? (dp[k + 1]?.[j] ?? 0) : 0;
                const total = left + right + sum;
                if (total < best) {
                    best = total;
                    bestK = k;
                }

                const states = new Map<string, EntityState>([
                    [`${i},${j}`, "comparing"],
                    [`${i},${k - 1}`, "highlight"],
                    [`${k + 1},${j}`, "highlight"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeCells(dp, states),
                    edges: [],
                    description: `Interval [${i}, ${j}] split at k=${k} → ${total}.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: { rows: n, cols: n },
                };
                step += 1;
            }

            dp[i][j] = best;
            opt[i][j] = bestK;

            yield {
                stepNumber: step,
                entities: makeCells(dp, new Map([[`${i},${j}`, "sorted"]])),
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
        description: `Optimal BST cost = ${dp[0]?.[n - 1]}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: n, cols: n, minCost: dp[0]?.[n - 1] },
    };
}

/** The Knuth Optimization module, registered with the engine. */
const module: AlgorithmModule = {
    id: "knuth-optimization",
    name: "Knuth's Optimization",
    category: "dynamic-programming",
    complexity: { time: "O(n²)", space: "O(n²)" },
    // Optimal BST frequencies.
    defaultInput: { freq: [4, 2, 6, 3] },
    visualType: "grid",
    run,
};

export default module;
