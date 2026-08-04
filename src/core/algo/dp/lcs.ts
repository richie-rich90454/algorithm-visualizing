/**
 * lcs.ts – Longest Common Subsequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The longest common subsequence (LCS) of two strings is the longest sequence
 * of characters that appears in both, preserving order but not necessarily
 * contiguously. The classic DP builds a table where:
 *
 *   dp[i][j] = dp[i-1][j-1] + 1              if a[i] == b[j]
 *            = max(dp[i-1][j], dp[i][j-1])   otherwise
 *
 * A backtrace from dp[n][m] recovers one optimal subsequence.
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
 *   - The backtrace path is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Diff tools (git, merge) are built on LCS ideas.
 *   - Contrasts with the contiguous longest common *substring*.
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
 * The LCS generator.
 *
 * @param input `{ a, b }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: string; b?: string } | null) ?? {};
    const a = task.a ?? "abcde";
    const b = task.b ?? "ace";

    const rows = a.length + 1;
    const cols = b.length + 1;
    let step = 0;

    const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

    // Frame 0: the empty table.
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Longest common subsequence of "${a}" and "${b}".`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols },
    };
    step += 1;

    // Fill the DP table.
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            if (a[i - 1] === b[j - 1]) {
                const diag = dp[i - 1]?.[j - 1] ?? 0;
                dp[i][j] = diag + 1;
            } else {
                const up = dp[i - 1]?.[j] ?? 0;
                const left = dp[i]?.[j - 1] ?? 0;
                dp[i][j] = Math.max(up, left);
            }

            const states = new Map<string, EntityState>([[`${i},${j}`, "comparing"]]);
            yield {
                stepNumber: step,
                entities: makeCells(dp, states),
                edges: [],
                description: `dp[${i}][${j}] for "${a[i - 1]}" vs "${b[j - 1]}" = ${dp[i]?.[j]}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows, cols },
            };
            step += 1;
        }
    }

    // Backtrace from the bottom-right.
    const backStates = new Map<string, EntityState>();
    let i = a.length;
    let j = b.length;
    const lcsChars: string[] = [];

    while (i > 0 && j > 0) {
        if (a[i - 1] === b[j - 1]) {
            backStates.set(`${i},${j}`, "sorted");
            lcsChars.unshift(a[i - 1] as string);
            i -= 1;
            j -= 1;
        } else if ((dp[i - 1]?.[j] ?? 0) > (dp[i]?.[j - 1] ?? 0)) {
            i -= 1;
        } else {
            j -= 1;
        }
    }

    const lcs = lcsChars.join("");

    yield {
        stepNumber: step,
        entities: makeCells(dp, backStates),
        edges: [],
        description: `LCS = "${lcs}" (length ${lcs.length}).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows, cols, lcs },
    };
}

/** The LCS module, registered with the engine. */
const module: AlgorithmModule = {
    id: "lcs",
    name: "Longest Common Subsequence",
    category: "dynamic-programming",
    complexity: { time: "O(n·m)", space: "O(n·m)" },
    // LCS("abcde", "ace") = "ace" (length 3).
    defaultInput: { a: "abcde", b: "ace" },
    visualType: "grid",
    run,
};

export default module;
