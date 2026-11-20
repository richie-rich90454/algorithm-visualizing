/**
 * osa-distance.ts - Optimal String Alignment Distance
 *
 * OSA distance is the restricted form of Damerau-Levenshtein: it allows
 * insertion, deletion, substitution, and the transposition of two adjacent
 * characters, but each substring may be transposed at most once. A dynamic
 * program fills an (n+1) by (m+1) table and returns its bottom-right cell.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    rows: number,
    cols: number,
    table: number[][],
    activeRow: number,
    activeCol: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            const isActive = i === activeRow && j === activeCol;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: String(table[i]?.[j] ?? 0),
                value: table[i]?.[j] ?? 0,
                state: isActive ? "active" : i === rows - 1 && j === cols - 1 ? "sorted" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: string; b?: string } | null) ?? {};
    const a = typeof task.a === "string" ? task.a : "CA";
    const b = typeof task.b === "string" ? task.b : "ABC";
    const rows = a.length + 1;
    const cols = b.length + 1;
    const table: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
    for (let i = 0; i < rows; i += 1) table[i]![0] = i;
    for (let j = 0; j < cols; j += 1) table[0]![j] = j;

    const frames: VisualFrame[] = [];
    const push = (activeRow: number, activeCol: number, desc: string, line: number): void => {
        frames.push({
            stepNumber: frames.length,
            entities: makeCells(rows, cols, table, activeRow, activeCol),
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: { distance: table[rows - 1]![cols - 1], rows, cols, a, b, dp: table.map((r) => [...r]) },
        });
    };

    push(0, 0, `Computing OSA distance between "${a}" and "${b}".`, 0);
    for (let i = 1; i < rows; i += 1) {
        for (let j = 1; j < cols; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let best = Math.min(table[i - 1]![j]! + 1, table[i]![j - 1]! + 1, table[i - 1]![j - 1]! + cost);
            if (
                i > 1 &&
                j > 1 &&
                a[i - 1] === b[j - 2] &&
                a[i - 2] === b[j - 1]
            ) {
                best = Math.min(best, table[i - 2]![j - 2]! + 1);
            }
            table[i]![j] = best;
            if (frames.length < 24) {
                push(i, j, `Cell (${i},${j}) = ${best} for '${a[i - 1]}' vs '${b[j - 1]}'.`, 3);
            }
        }
    }
    push(rows - 1, cols - 1, `OSA distance is ${table[rows - 1]![cols - 1]}.`, 4);

    for (const frame of frames) yield frame;
    const distance = table[rows - 1]![cols - 1]!;
    yield {
        stepNumber: frames.length,
        entities: makeCells(rows, cols, table, -1, -1).map((e) => ({ ...e, state: "sorted" as EntityState })),
        edges: [],
        description: `Done: optimal string alignment distance = ${distance}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { distance, rows, cols, a, b, dp: table.map((r) => [...r]) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Build a table where cell (i, j) is the cheapest way to turn the first i characters of one string into the first j of the other. Besides insert, delete, and substitute, one extra diagonal jump handles swapping two neighboring characters. The answer sits in the bottom-right cell.",
        invariants: [
            "The first row and column count insertions and deletions from the empty string.",
            "Each cell is the minimum over the four allowed edit operations.",
            "The table is filled row by row, so every dependency is already known.",
        ],
        correctness:
            "Any optimal alignment ending at (i, j) must finish with one of four operations. Deletion, insertion, and substitution lead to the three neighboring cells; an adjacent transposition leads to (i-2, j-2) and is allowed only when the two crossed characters match in reverse order. Taking the minimum over a complete set of last steps yields the true optimum by induction.",
        complexityRationale:
            "Every one of the (n+1)(m+1) cells is computed with a constant number of lookups, giving O(n*m) time and O(n*m) space for the table.",
        uses: [
            "Spelling correction and typo-tolerant search",
            "Detecting adjacent-character swaps in keyboard input",
            "Comparing short biological or DNA strings",
        ],
        references: [
            "Damerau, A Technique for Computer Detection and Correction of Spelling Errors, 1964",
            "Wikipedia, Optimal String Alignment Distance",
        ],
        workedExample:
            "For CA versus ABC the table ends at 2: substitute C to A and insert B before C, or transpose and substitute in two steps. A single transposition is not enough because the strings have different lengths.",
    },
    id: "osa-distance",
    name: "Optimal String Alignment Distance",
    category: "string",
    complexity: { time: "O(n*m)", space: "O(n*m)" },
    defaultInput: { a: "CA", b: "ABC" },
    visualType: "grid",
    run,
    pseudocode: [
        "read strings a of length n and b of length m",
        "initialize row 0 with 0 through m and column 0 with 0 through n",
        "for each i from 1 to n and j from 1 to m",
        "set cell to the minimum of delete, insert, and substitute costs",
        "if the last two characters are crossed, also consider the transposition cost",
        "done: the bottom-right cell is the optimal string alignment distance",
    ],
};

export default module;
