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
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows, cols, lcs },
    };
}

/** The LCS module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "The longest common subsequence finds the longest sequence of characters appearing in both strings in the same order, though not necessarily contiguously. The DP compares prefixes: matching characters extend the diagonal by one, and mismatches carry the better of skipping a character from either string. A backtrace recovers one optimal subsequence.",
        "invariants": [
            "dp[i][j] is the LCS length of a[:i] and b[:j].",
            "dp[0][j] and dp[i][0] are zero for empty prefixes.",
            "Each cell depends only on top, left, and diagonal neighbors."
        ],
        "correctness": "If the final characters match, an optimal subsequence can use them, giving dp[i-1][j-1] plus one; otherwise it must skip one of them, giving the max of the two adjacent cells. These cases cover every subsequence, so the recurrence is correct by induction. Backtracking through the chosen predecessor reconstructs a sequence of that length.",
        "complexityRationale": "Filling an n by m table with constant work per cell is O(n*m) time. The table uses O(n*m) space, reducible to O(m) if only the length is needed.",
        "uses": [
            "Diff tools and version control merge detection",
            "Bioinformatics sequence alignment",
            "Measuring similarity between documents or strings"
        ],
        "references": [
            "Cormen et al., Introduction to Algorithms, Section 15.4",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 6.5"
        ],
        "workedExample": "For a = abcde and b = ace, matches at a, c, and e extend the diagonal, so dp[5][3] = 3. Backtracing yields the subsequence ace."
    },
    id: "lcs",
    name: "Longest Common Subsequence",
    category: "dynamic-programming",
    complexity: { time: "O(n·m)", space: "O(n·m)" },
    // LCS("abcde", "ace") = "ace" (length 3).
    defaultInput: { a: "abcde", b: "ace" },
    visualType: "grid",
    run,
    pseudocode: [
        "set up dp table (n+1) x (m+1) filled with 0",
        "dp[i][j] holds LCS length of prefixes a[:i] and b[:j]",
        "dp[i][j] <- dp[i-1][j-1] + 1 on match else max(up, left)",
        "fill rows over a and columns over b in order",
        "matches extend the diagonal by one character",
        "mismatches carry the better of top or left neighbor",
        "answer <- dp[n][m] with one LCS backtraced via arrows",
    ],
};

export default module;
