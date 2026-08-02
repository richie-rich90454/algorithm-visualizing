/**
 * shortest-common-supersequence.ts – Shortest Common Supersequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The shortest common supersequence (SCS) of two strings a and b is the
 * shortest string that contains both as subsequences. Its length is
 * |a| + |b| − |LCS(a, b)|, and it can be reconstructed with a DP table very
 * similar to LCS, preferring to keep shared characters once.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n·m)
 *   Space: O(n·m)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The cell being computed is YELLOW (comparing).
 *   - The reconstruction path is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The LCS-based length formula is the key insight.
 *   - Used in genome assembly and string merging problems.
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
 * The SCS generator.
 *
 * @param input `{ a, b }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: string; b?: string } | null) ?? {};
    const a = task.a ?? "abac";
    const b = task.b ?? "cab";

    const rows = a.length + 1;
    const cols = b.length + 1;
    let step = 0;

    // dp[i][j] = length of the SCS of a[0..i) and b[0..j).
    const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

    // Base cases: an empty string needs the full other string.
    for (let i = 0; i <= a.length; i += 1) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= b.length; j += 1) {
        dp[0][j] = j;
    }

    // Frame 0: the initialised table.
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Shortest common supersequence of "${a}" and "${b}".`,
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
                dp[i][j] = diag + 1;
            } else {
                const up = dp[i - 1]?.[j] ?? 0;
                const left = dp[i]?.[j - 1] ?? 0;
                dp[i][j] = Math.min(up, left) + 1;
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

    // Reconstruct the supersequence.
    const backStates = new Map<string, EntityState>();
    const chars: string[] = [];
    let i = a.length;
    let j = b.length;

    while (i > 0 && j > 0) {
        if (a[i - 1] === b[j - 1]) {
            backStates.set(`${i},${j}`, "sorted");
            chars.unshift(a[i - 1] as string);
            i -= 1;
            j -= 1;
        } else if ((dp[i - 1]?.[j] ?? 0) <= (dp[i]?.[j - 1] ?? 0)) {
            chars.unshift(a[i - 1] as string);
            i -= 1;
        } else {
            chars.unshift(b[j - 1] as string);
            j -= 1;
        }
    }
    while (i > 0) {
        chars.unshift(a[i - 1] as string);
        i -= 1;
    }
    while (j > 0) {
        chars.unshift(b[j - 1] as string);
        j -= 1;
    }

    const scs = chars.join("");

    yield {
        stepNumber: step,
        entities: makeCells(dp, backStates),
        edges: [],
        description: `SCS = "${scs}" (length ${scs.length}).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows, cols, scs },
    };
}

/** The SCS module, registered with the engine. */
const module: AlgorithmModule = {
    id: "shortest-common-supersequence",
    name: "Shortest Common Supersequence",
    category: "dynamic-programming",
    complexity: { time: "O(n·m)", space: "O(n·m)" },
    // SCS("abac", "cab") = "cabac" or "abcab"; length 5.
    defaultInput: { a: "abac", b: "cab" },
    visualType: "grid",
    run,
};

export default module;
