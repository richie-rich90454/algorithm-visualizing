/**
 * subset-sum.ts – Subset Sum
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Subset sum asks: given a set of numbers, is there a subset summing exactly
 * to a target T? The boolean DP:
 *
 *   dp[i][s] = dp[i-1][s] OR dp[i-1][s - a[i]]
 *
 * over items i and sums s. dp[i][s] is true iff a subset of the first i items
 * sums to s.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n·T)
 *   Space: O(n·T) (or O(T) with a boolean array)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The cell being computed is YELLOW (comparing).
 *   - Reachable cells are GREEN (sorted).
 *   - The target cell is highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "reachability" DP template.
 *   - Related to the knapsack and to partitioning problems.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a matrix of cell entities for a frame.
 *
 * @param matrix The boolean DP table (as 0/1 numbers).
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
                label: String(value),
                value,
                state: states.get(`${row},${col}`) ?? (value ? "sorted" : "unvisited"),
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
 * The Subset Sum generator.
 *
 * @param input `{ numbers, target }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { numbers?: number[]; target?: number } | null) ?? {};
    const numbers = task.numbers ?? [2, 3, 7, 8, 10];
    const target = typeof task.target === "number" ? task.target : 11;

    const rows = numbers.length + 1;
    const cols = Math.max(0, target + 1);
    let step = 0;

    // dp[i][s] as 0/1 numbers for display.
    const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
    dp[0][0] = 1;

    // Frame 0: the initialized table (dp[0][0] = 1).
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Subset sum: can a subset of [${numbers.join(", ")}] sum to ${target}?`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols },
    };
    step += 1;

    // Fill the table.
    for (let i = 1; i <= numbers.length; i += 1) {
        const num = numbers[i - 1] ?? 0;
        for (let s = 0; s <= target; s += 1) {
            const skip = dp[i - 1]?.[s] ?? 0;
            let reachable = skip;
            if (s >= num && (dp[i - 1]?.[s - num] ?? 0) === 1) {
                reachable = 1;
            }
            dp[i][s] = reachable;

            const states = new Map<string, EntityState>([[`${i},${s}`, "comparing"]]);
            yield {
                stepNumber: step,
                entities: makeCells(dp, states),
                edges: [],
                description: `After item ${i} (value ${num}): sum ${s} reachable = ${reachable === 1}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows, cols },
            };
            step += 1;
        }
    }

    const solvable = dp[numbers.length]?.[target] === 1;
    const finalStates = new Map<string, EntityState>([
        [`${numbers.length},${target}`, "comparing"],
    ]);

    yield {
        stepNumber: step,
        entities: makeCells(dp, finalStates),
        edges: [],
        description: solvable
            ? `Yes – a subset sums to ${target}.`
            : `No subset sums to ${target}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows, cols, solvable },
    };
}

/** The Subset Sum module, registered with the engine. */
const module: AlgorithmModule = {
    id: "subset-sum",
    name: "Subset Sum",
    category: "dynamic-programming",
    complexity: { time: "O(n·T)", space: "O(n·T)" },
    // 3 + 8 = 11, so the target is reachable.
    defaultInput: { numbers: [2, 3, 7, 8, 10], target: 11 },
    visualType: "grid",
    run,
};

export default module;
