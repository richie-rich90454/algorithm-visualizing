/**
 * damerau-levenshtein.ts - Damerau-Levenshtein Distance (optimal string alignment)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Damerau-Levenshtein extends ordinary Levenshtein edit distance with one more
 * operation: swapping two adjacent characters (a transposition) in a single
 * step. This variant is the widely used optimal-string-alignment form, in
 * which no substring is edited more than once. It is the standard choice for
 * spelling correction and fuzzy dictionary lookup.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * m) for strings of length n and m
 *   Space: O(n * m) for the DP table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The DP table is drawn as a grid of cells.
 *   - The cell being filled is highlighted; finished cells are green.
 *   - A cell that uses an adjacent transposition is shown in a distinct state.
 *   - The final frame reports the distance in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build one grid cell for the DP table. */
function cell(row: number, col: number, label: string, state: EntityState): VisualEntity {
    return {
        id: `cell-${row}-${col}`,
        type: "cell",
        label,
        value: label === "" ? 0 : Number(label),
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row, col },
    } as VisualEntity;
}

/** Render the DP table; a null entry means the cell has not been computed yet. */
function grid(
    values: Array<Array<number | null>>,
    currentRow: number,
    currentCol: number,
    transposed: boolean,
): VisualEntity[] {
    const out: VisualEntity[] = [];
    for (let r = 0; r < values.length; r += 1) {
        const row = values[r] ?? [];
        for (let c = 0; c < row.length; c += 1) {
            const value = row[c] ?? null;
            let state: EntityState = value === null ? "idle" : "sorted";
            if (r === currentRow && c === currentCol) {
                state = transposed ? "highlight" : "comparing";
            }
            out.push(cell(r, c, value === null ? "" : String(value), state));
        }
    }
    return out;
}

/** Compute the full optimal-string-alignment DP table. */
function computeTable(a: string, b: string): { dp: number[][]; trans: boolean[][] } {
    const n = a.length;
    const m = b.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    const trans: boolean[][] = Array.from({ length: n + 1 }, () =>
        new Array<boolean>(m + 1).fill(false),
    );
    for (let i = 0; i <= n; i += 1) (dp[i] as number[])[0] = i;
    for (let j = 0; j <= m; j += 1) (dp[0] as number[])[j] = j;
    for (let i = 1; i <= n; i += 1) {
        for (let j = 1; j <= m; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let best = Math.min(
                ((dp[i - 1] as number[])[j - 1] as number) + cost,
                ((dp[i - 1] as number[])[j] as number) + 1,
                ((dp[i] as number[])[j - 1] as number) + 1,
            );
            let usedTransposition = false;
            if (
                i > 1 &&
                j > 1 &&
                a[i - 1] === b[j - 2] &&
                a[i - 2] === b[j - 1] &&
                ((dp[i - 2] as number[])[j - 2] as number) + 1 < best
            ) {
                best = ((dp[i - 2] as number[])[j - 2] as number) + 1;
                usedTransposition = true;
            }
            (dp[i] as number[])[j] = best;
            (trans[i] as boolean[])[j] = usedTransposition;
        }
    }
    return { dp, trans };
}

/** The Damerau-Levenshtein generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: string; b?: string } | null) ?? {};
    const a = task.a ?? "abcd";
    const b = task.b ?? "abdc";
    const { dp, trans } = computeTable(a, b);
    const n = a.length;
    const m = b.length;
    const distance = (dp[n] as number[])[m] as number;
    let transpositions = 0;
    for (const row of trans) for (const flag of row) if (flag) transpositions += 1;

    let step = 0;
    const F = (
        entities: VisualEntity[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({ stepNumber: step, entities, edges: [], description, codeLineNumber, layout: "grid", meta });

    const shown: Array<Array<number | null>> = Array.from({ length: n + 1 }, () =>
        new Array<number | null>(m + 1).fill(null),
    );
    for (let i = 0; i <= n; i += 1) (shown[i] as Array<number | null>)[0] = (dp[i] as number[])[0] as number;
    for (let j = 0; j <= m; j += 1) (shown[0] as Array<number | null>)[j] = (dp[0] as number[])[j] as number;

    yield F(
        grid(shown, -1, -1, false),
        `Damerau-Levenshtein between "${a}" (length ${n}) and "${b}" (length ${m}).`,
        0,
        { a, b, n, m, distance },
    );
    step += 1;

    const maxFrames = 80;
    for (let i = 1; i <= n; i += 1) {
        for (let j = 1; j <= m; j += 1) {
            const used = (trans[i] as boolean[])[j] as boolean;
            (shown[i] as Array<number | null>)[j] = (dp[i] as number[])[j] as number;
            if (step < maxFrames) {
                yield F(
                    grid(shown, i, j, used),
                    used
                        ? `dp[${i}][${j}]=${(dp[i] as number[])[j]}: adjacent transposition of "${a[i - 1]}${a[i - 2]}" is cheaper.`
                        : `dp[${i}][${j}]=${(dp[i] as number[])[j]} using match, insertion, or deletion.`,
                    used ? 5 : 4,
                    { a, b, distance },
                );
                step += 1;
            }
        }
    }

    const full: number[][] = dp.map((row) => [...row]);
    yield F(
        grid(full, -1, -1, false),
        `Done. Damerau-Levenshtein distance between "${a}" and "${b}" is ${distance}.`,
        7,
        { a, b, distance, transpositions },
    );
}

/** The Damerau-Levenshtein module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Edit distance counts the smallest number of single-character changes needed to turn one string into another. Damerau-Levenshtein adds the swap of two neighboring letters as one operation, which is why 'abcd' to 'abdc' costs only one edit instead of two. A dynamic-programming table fills in the cheapest cost for every pair of prefixes, and one extra diagonal check captures adjacent transpositions.",
        invariants: [
            "dp[i][j] is the optimal string alignment distance between a[:i] and b[:j].",
            "The first row and first column equal the prefix lengths because inserting or deleting every character is always possible.",
            "Every cell is the minimum over all edit operations that can produce its two prefixes.",
            "A transposition is considered only when the last two characters of both prefixes are reversed copies of each other.",
        ],
        correctness:
            "Consider the last edit in an optimal conversion of a[:i] into b[:j]. If the final characters match, no edit is needed and the diagonal gives the cost; otherwise the last edit is a substitution, deletion, or insertion, represented by the three neighboring cells. When the last two characters are swapped, a transposition leaves the shorter prefixes a[:i-2] and b[:j-2], giving one more candidate. Taking the minimum over all cases yields the optimal substructure, and filling cells in increasing prefix order makes every dependency final, so dp[n][m] is the distance.",
        complexityRationale:
            "The table has (n+1)(m+1) cells and each is computed with a constant number of comparisons, giving O(n*m) time. Storing the table for the visualization uses O(n*m) space, which could be reduced to O(m) if only the distance were needed.",
        uses: [
            "Spelling correction and typo detection in search engines",
            "Fuzzy dictionary and record linkage where letters are transposed",
            "Biological sequence and text similarity scoring with swap operations",
        ],
        references: [
            "Levenshtein, Binary Codes Capable of Correcting Deletions, Insertions, and Reversals, 1966",
            "Damerau, A Technique for Computer Detection and Correction of Spelling Errors, 1964",
            "Wikipedia, Damerau-Levenshtein distance (optimal string alignment)",
        ],
        workedExample:
            "For a = abcd and b = abdc, the last two characters cd and dc are reversed copies, so the transposition candidate dp[2][2]+1 = 1 beats the substitution cost of 2. The final cell is 1, reflecting the single swap of c and d.",
    },
    id: "damerau-levenshtein",
    name: "Damerau-Levenshtein",
    category: "string",
    complexity: { time: "O(n * m)", space: "O(n * m)" },
    defaultInput: { a: "abcd", b: "abdc" },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize dp[i][0] to i and dp[0][j] to j",
        "for each i from 1 to n",
        "for each j from 1 to m",
        "cost is 0 when a[i-1] equals b[j-1], otherwise 1",
        "set dp[i][j] to the minimum of diagonal, above, and left plus cost",
        "if the last two characters are swapped, consider dp[i-2][j-2] plus 1",
        "mark a transposition when that diagonal wins",
        "done: dp[n][m] is the Damerau-Levenshtein distance",
    ],
};

export default module;
