/**
 * longest-common-prefix-dp.ts – Longest Common Prefix (DP on suffixes)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This DP computes, for two strings a and b, the longest common prefix of
 * every suffix pair a[i..] and b[j..]. The recurrence is wonderfully simple:
 *
 *   lcp[i][j] = lcp[i+1][j+1] + 1   if a[i] == b[j]
 *             = 0                   otherwise
 *
 * computed bottom-up from the ends. Every cell is the length of the common
 * prefix of the two suffixes starting there.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n·m)
 *   Space: O(n·m) for the DP table
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The cell being computed is YELLOW (comparing).
 *   - Positive LCP cells are highlighted.
 *   - The maximum LCP (overall longest common prefix) is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The reverse-order dependency (from the ends) is the teaching point.
 *   - Also the basis of the "longest repeated substring" via suffix arrays.
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
 * The Longest Common Prefix DP generator.
 *
 * @param input `{ a, b }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: string; b?: string } | null) ?? {};
    const a = task.a ?? "ababca";
    const b = task.b ?? "abacab";

    const n = a.length;
    const m = b.length;
    const rows = n + 1;
    const cols = m + 1;
    let step = 0;

    // The DP table: rows/cols are shifted so lcp[n][*] = lcp[*][m] = 0.
    const lcp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

    let bestLen = 0;
    let bestRow = 0;
    let bestCol = 0;

    // Frame 0: the empty table.
    yield {
        stepNumber: step,
        entities: makeCells(lcp),
        edges: [],
        description: `Longest common prefix of suffixes of "${a}" and "${b}".`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols },
    };
    step += 1;

    // Fill the table bottom-up (from the ends of the strings).
    for (let i = n - 1; i >= 0; i -= 1) {
        for (let j = m - 1; j >= 0; j -= 1) {
            if (a[i] === b[j]) {
                const diag = lcp[i + 1]?.[j + 1] ?? 0;
                lcp[i][j] = diag + 1;
                if ((lcp[i]?.[j] ?? 0) > bestLen) {
                    bestLen = lcp[i]?.[j] ?? 0;
                    bestRow = i;
                    bestCol = j;
                }
            }

            const states = new Map<string, EntityState>([[`${i},${j}`, "comparing"]]);
            yield {
                stepNumber: step,
                entities: makeCells(lcp, states),
                edges: [],
                description: `lcp[${i}][${j}] for "${a[i]}" vs "${b[j]}" = ${lcp[i]?.[j]}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows, cols, bestLen },
            };
            step += 1;
        }
    }

    // Highlight the best cell and its diagonal.
    const winningStates = new Map<string, EntityState>();
    let i = bestRow;
    let j = bestCol;
    while (i < n && j < m && (lcp[i]?.[j] ?? 0) > 0) {
        winningStates.set(`${i},${j}`, "sorted");
        i += 1;
        j += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(lcp, winningStates),
        edges: [],
        description: `Longest common prefix between suffix pairs has length ${bestLen}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows, cols, bestLen },
    };
}

/** The Longest Common Prefix DP module, registered with the engine. */
const module: AlgorithmModule = {
    id: "longest-common-prefix-dp",
    name: "Longest Common Prefix (DP)",
    category: "string",
    complexity: { time: "O(n·m)", space: "O(n·m)" },
    // "aba" is the longest common prefix of some suffix pair here.
    defaultInput: { a: "ababca", b: "abacab" },
    visualType: "grid",
    run,
};

export default module;
