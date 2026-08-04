/**
 * divide-conquer-dp.ts – Divide-and-Conquer DP optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Divide-and-conquer DP optimizes DP recurrences of the form
 *
 *   dp[i][j] = min over k < j of (dp[i-1][k] + cost(k, j))
 *
 * when the optimal split index opt[i][j] is monotonic: opt[i][j-1] ≤ opt[i][j].
 * Instead of scanning every k, each row is solved with a divide-and-conquer
 * that only searches the feasible split range, cutting O(n²) per row to
 * O(n log n) per row.
 *
 * The example problem is the classic "divide the array into m contiguous
 * parts minimising total cost" (here cost = sum of squared distances to the
 * part mean, using a simple proxy).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m·n log n) vs O(m·n²) naive
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The subproblem cell being solved is YELLOW (comparing).
 *   - The feasible split range is PINK (highlight).
 *   - The chosen split is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The monotonicity (quadrangle inequality) assumption is essential.
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

/** A simple cost proxy: cost(a, b) = Σ |a[i] - b| minimized at b = mean. */
function costSum(arr: number[], l: number, r: number): number {
    const slice = arr.slice(l, r + 1);
    if (slice.length === 0) {
        return 0;
    }
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    return slice.reduce((sum, v) => sum + (v - mean) * (v - mean), 0);
}

/**
 * The Divide-and-Conquer DP generator.
 *
 * @param input `{ array, groups }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[]; groups?: number } | null) ?? {};
    const arr = task.array ?? [1, 2, 6, 8, 10, 20];
    const groups = typeof task.groups === "number" ? task.groups : 3;

    const n = arr.length;
    const m = groups;
    let step = 0;

    // dp[g][i] = min cost to split arr[0..i] into g groups.
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n).fill(Infinity));

    // Base: one group is just the cost of the whole prefix.
    for (let i = 0; i < n; i += 1) {
        dp[1][i] = costSum(arr, 0, i);
    }

    // Frame 0: the initialized table.
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Split [${arr.join(", ")}] into ${groups} groups, minimising cost.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: m + 1, cols: n },
    };
    step += 1;

    // Divide-and-conquer DP over groups.
    for (let g = 2; g <= m; g += 1) {
        const solve = function* (
            l: number,
            r: number,
            optL: number,
            optR: number,
        ): Generator<VisualFrame, void, unknown> {
            if (l > r) {
                return;
            }
            const mid = Math.floor((l + r) / 2);

            // Search k in [optL, min(optR, mid)].
            let best = Infinity;
            let bestK = optL;
            for (let k = optL; k <= Math.min(optR, mid); k += 1) {
                const prev = dp[g - 1]?.[k] ?? Infinity;
                const cost = costSum(arr, k + 1, mid);
                const total = prev + cost;
                if (total < best) {
                    best = total;
                    bestK = k;
                }

                const states = new Map<string, EntityState>([
                    [`${g},${mid}`, "comparing"],
                    [`${g - 1},${k}`, "highlight"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeCells(dp, states),
                    edges: [],
                    description: `Group ${g}, element ${mid}: trying split k=${k} → ${total}.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: { rows: m + 1, cols: n },
                };
                step += 1;
            }
            dp[g][mid] = best;

            yield {
                stepNumber: step,
                entities: makeCells(dp, new Map([[`${g},${mid}`, "sorted"]])),
                edges: [],
                description: `dp[${g}][${mid}] = ${best} (best k=${bestK}).`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { rows: m + 1, cols: n },
            };
            step += 1;

            // Recurse on both halves with the restricted split ranges.
            yield* solve(l, mid - 1, optL, bestK);
            yield* solve(mid + 1, r, bestK, optR);
        };

        yield* solve(0, n - 1, 0, n - 1);
    }

    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Minimum total cost with ${groups} groups = ${dp[m]?.[n - 1]}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: m + 1, cols: n, minCost: dp[m]?.[n - 1] },
    };
}

/** The Divide-and-Conquer DP module, registered with the engine. */
const module: AlgorithmModule = {
    id: "divide-conquer-dp",
    name: "Divide & Conquer DP",
    category: "dynamic-programming",
    complexity: { time: "O(m·n log n)", space: "O(n)" },
    // A small array where the monotonic-split assumption holds.
    defaultInput: { array: [1, 2, 6, 8, 10, 20], groups: 3 },
    visualType: "grid",
    run,
};

export default module;
