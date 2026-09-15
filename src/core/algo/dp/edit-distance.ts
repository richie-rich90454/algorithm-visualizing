/**
 * edit-distance.ts – Edit Distance (Levenshtein)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The edit (Levenshtein) distance between two strings is the minimum number of
 * single-character insertions, deletions, or substitutions needed to turn one
 * into the other. The classic DP:
 *
 *   dp[i][j] = dp[i-1][j-1]                    if a[i] == b[j]
 *            = 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])   otherwise
 *
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n·m)
 *   Space: O(n·m)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The cell being computed is YELLOW (comparing).
 *   - A substitution/insertion/delete cell is RED (swapped).
 *   - The optimal backtrace path is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Powers spell-checkers and DNA sequence alignment.
 *   - The three-operations recurrence is the core template.
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
                label: String(value),
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
 * The Edit Distance generator.
 *
 * @param input `{ a, b }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: string; b?: string } | null) ?? {};
    const a = task.a ?? "kitten";
    const b = task.b ?? "sitting";

    const rows = a.length + 1;
    const cols = b.length + 1;
    let step = 0;

    // dp[i][j] = edit distance between a[0..i) and b[0..j).
    const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
    for (let i = 0; i <= a.length; i += 1) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= b.length; j += 1) {
        dp[0][j] = j;
    }

    // Frame 0: the initialized table.
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Edit distance between "${a}" and "${b}".`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols },
    };
    step += 1;

    // Fill the table.
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            if (a[i - 1] === b[j - 1]) {
                const diag = dp[i - 1]?.[j - 1] ?? 0;
                dp[i][j] = diag;
            } else {
                const del = dp[i - 1]?.[j] ?? 0;
                const ins = dp[i]?.[j - 1] ?? 0;
                const sub = dp[i - 1]?.[j - 1] ?? 0;
                dp[i][j] = 1 + Math.min(del, ins, sub);
            }

            const states = new Map<string, EntityState>([[`${i},${j}`, "comparing"]]);
            yield {
                stepNumber: step,
                entities: makeCells(dp, states),
                edges: [],
                description: `dp[${i}][${j}] = ${dp[i]?.[j]}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows, cols },
            };
            step += 1;
        }
    }

    // The answer.
    const distance = dp[a.length]?.[b.length] ?? 0;

    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Edit distance = ${distance}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows, cols, distance },
    };
}

/** The Edit Distance module, registered with the engine. */
const module: AlgorithmModule = {
    id: "edit-distance",
    name: "Edit Distance",
    category: "dynamic-programming",
    complexity: { time: "O(n·m)", space: "O(n·m)" },
    // The classic kitten→sitting example (distance 3).
    defaultInput: { a: "kitten", b: "sitting" },
    visualType: "grid",
    run,
    pseudocode: [
        "set up dp with dp[i][0] <- i and dp[0][j] <- j",
        "dp[i][j] holds distance between prefixes a[:i] and b[:j]",
        "dp[i][j] <- dp[i-1][j-1] on match else 1 + min(del, ins, sub)",
        "fill rows over a and columns over b in order",
        "each cell picks cheapest of delete, insert, or substitute",
        "matches copy the diagonal with zero extra cost",
        "answer <- dp[n][m] with edits reconstructed via backtrace",
    ],
};

export default module;
