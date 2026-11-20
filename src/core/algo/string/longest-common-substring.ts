/**
 * longest-common-substring.ts – Longest Common Substring (DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The longest common substring of two strings is the longest contiguous block
 * shared by both. A classic O(n·m) dynamic program builds a table where
 * `dp[i][j]` is the length of the longest common suffix ending at a[i] and
 * b[j]; whenever a[i] == b[j], dp[i][j] = dp[i-1][j-1] + 1, otherwise 0. The
 * largest cell in the table is the answer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n·m)
 *   Space: O(n·m) for the DP table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The cell being computed is YELLOW (comparing).
 *   - Non-zero DP cells are highlighted progressively.
 *   - The cells on the winning diagonal are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Contrasts with the longest common *subsequence*, which allows gaps.
 *   - The diagonal-dependency structure is easy to see in the grid.
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
 * The Longest Common Substring generator.
 *
 * @param input `{ a, b }` – the two strings.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: string; b?: string } | null) ?? {};
    const a = task.a ?? "abacaba";
    const b = task.b ?? "cabac";

    const rows = a.length + 1;
    const cols = b.length + 1;
    let step = 0;

    // DP table with an extra row/col of zeros as the base case.
    const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

    let bestLen = 0;
    let bestRow = 0;
    let bestCol = 0;

    // Frame 0: the empty DP table.
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Longest common substring of "${a}" and "${b}".`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { comparisons: 0, shifts: 0, rows, cols, matches: [] },
    };
    step += 1;

    // Fill the DP table.
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            // Matching characters extend the previous diagonal.
            if (a[i - 1] === b[j - 1]) {
                const prev = dp[i - 1]?.[j - 1] ?? 0;
                const row = dp[i];
                if (row) {
                    row[j] = prev + 1;
                }
                if ((dp[i]?.[j] ?? 0) > bestLen) {
                    bestLen = dp[i]?.[j] ?? 0;
                    bestRow = i;
                    bestCol = j;
                }
            }

            // Highlight the cell being computed.
            const states = new Map<string, EntityState>([[`${i},${j}`, "comparing"]]);
            yield {
                stepNumber: step,
                entities: makeCells(dp, states),
                edges: [],
                description: `Computing dp[${i}][${j}] for "${a[i - 1]}" vs "${b[j - 1]}" = ${dp[i]?.[j]}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { comparisons: bestLen, shifts: 0, rows, cols, bestLen, matches: [] },
            };
            step += 1;
        }
    }

    // Trace the winning diagonal.
    const winningStates = new Map<string, EntityState>();
    let i = bestRow;
    let j = bestCol;
    while (i > 0 && j > 0 && (dp[i]?.[j] ?? 0) > 0) {
        winningStates.set(`${i},${j}`, "sorted");
        i -= 1;
        j -= 1;
    }

    // Extract the substring.
    const longest = a.slice(bestRow - bestLen, bestRow);

    yield {
        stepNumber: step,
        entities: makeCells(dp, winningStates),
        edges: [],
        description: `Longest common substring: "${longest}" (length ${bestLen}).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            comparisons: bestLen,
            shifts: 0,
            rows,
            cols,
            bestLen,
            matches: [longest],
            longestLen: longest.length,
        },
    };
}

/** The Longest Common Substring module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "The longest common substring is the longest contiguous block appearing in both strings. The DP defines dp[i][j] as the length of the common suffix ending at a[i] and b[j]: matching characters extend the diagonal by one, mismatches reset to zero, and the largest cell is the answer.",
        "invariants": [
            "dp[i][j] is the length of the longest common suffix of a[..i] and b[..j].",
            "A positive value means the last dp[i][j] characters of the two prefixes are identical."
        ],
        "correctness": "If a[i-1] equals b[j-1], any common suffix ending there is one longer than the common suffix ending at (i-1,j-1); otherwise no common suffix can include both positions, so the value is zero. Filling row by row computes every cell correctly and a traceback along the winning diagonal recovers the substring.",
        "complexityRationale": "There are (n+1)(m+1) cells filled in O(1) each, so time is O(nm); storing the table for traceback uses O(nm) space, reducible to O(min(n,m)) if only the length is needed.",
        "uses": [
            "Detecting shared code or plagiarism",
            "Biological sequence motif finding",
            "Comparing text for repeated passages"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, dynamic programming chapter",
            "Gusfield, Algorithms on Strings, Trees, and Sequences"
        ],
        "workedExample": "For a=\"abacaba\", b=\"cabac\", the largest DP value is 4 at the cells for \"abac\", so the longest common substring is \"abac\"."
    },
    id: "longest-common-substring",
    name: "Longest Common Substring",
    category: "string",
    complexity: { time: "O(n·m)", space: "O(n·m)" },
    // The longest common substring of these two is "abac".
    defaultInput: { a: "abacaba", b: "cabac" },
    visualType: "grid",
    run,
    pseudocode: [
        "create table for substring ending lengths",
        "initialize first row and column to zero",
        "extend diagonal by one when characters match",
        "reset cell to zero on character mismatch",
        "track maximum value and its end position",
        "trace back diagonally to recover substring",
        "report longest substring and length",
    ],
};

export default module;
