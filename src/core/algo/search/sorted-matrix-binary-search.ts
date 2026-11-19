/**
 * sorted-matrix-binary-search.ts - Sorted Matrix Staircase Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a matrix whose rows and columns both increase left to right and top to
 * bottom, a target can be located by starting at the top-right corner. If the
 * current value is too large, the whole column below it is too large, so move
 * left. If it is too small, the whole row to its left is too small, so move
 * down. Each step discards an entire row or column, giving a linear-time
 * search without binary searching any single row.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rows + cols) - one step eliminates a row or a column
 *   Space: O(rows * cols) for the emitted cell entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current corner is YELLOW (comparing).
 *   - Cells whose row or column was discarded are RED (visited path).
 *   - A matching cell turns GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MatrixTask {
    matrix?: number[][];
    target?: number;
}

function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const values = matrix[row] ?? [];
        for (let col = 0; col < values.length; col += 1) {
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(values[col]),
                value: values[col] as number,
                state: states.get(`${row},${col}`) ?? "idle",
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MatrixTask | null) ?? {};
    const matrix: number[][] = Array.isArray(task.matrix)
        ? task.matrix.map((row) => (Array.isArray(row) ? [...row] : []))
        : [
              [1, 4, 7, 10],
              [2, 5, 8, 11],
              [3, 6, 9, 12],
          ];
    const target = typeof task.target === "number" ? task.target : 9;
    let step = 0;
    let comparisons = 0;
    const cols = matrix[0]?.length ?? 0;
    const rectangular = matrix.every((row) => row.length === cols);

    yield {
        stepNumber: step,
        entities: makeCells(matrix),
        edges: [],
        description: `Searching for ${target} in a ${matrix.length} by ${cols} row- and column-sorted matrix from the top-right corner.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { comparisons, found: false, rows: matrix.length, cols },
    };
    step += 1;

    if (matrix.length === 0 || cols === 0 || !rectangular) {
        yield {
            stepNumber: step,
            entities: makeCells(matrix),
            edges: [],
            description: "The matrix is empty or ragged, so a staircase search cannot start.",
            codeLineNumber: 5,
            layout: "grid",
            meta: { comparisons, found: false, rows: matrix.length, cols },
        };
        return;
    }

    const visited = new Map<string, EntityState>();
    let row = 0;
    let col = cols - 1;
    let foundRow = -1;
    let foundCol = -1;

    while (row < matrix.length && col >= 0) {
        const value = matrix[row]?.[col] as number;
        comparisons += 1;
        const states = new Map<string, EntityState>(visited);
        states.set(`${row},${col}`, value === target ? "sorted" : "comparing");
        yield {
            stepNumber: step,
            entities: makeCells(matrix, states),
            edges: [],
            description: `At (${row}, ${col}) value ${value}: ${value === target ? "target found" : value > target ? "too large, discard this column" : "too small, discard this row"}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { comparisons, found: value === target, row, col, value },
        };
        step += 1;

        if (value === target) {
            foundRow = row;
            foundCol = col;
            visited.set(`${row},${col}`, "sorted");
            break;
        }
        visited.set(`${row},${col}`, "swapped");
        if (value > target) {
            col -= 1;
        } else {
            row += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(matrix, visited),
        edges: [],
        description:
            foundRow >= 0
                ? `Found ${target} at row ${foundRow}, column ${foundCol} after ${comparisons} comparison(s).`
                : `${target} is not in the matrix after ${comparisons} comparison(s).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { comparisons, found: foundRow >= 0, foundRow, foundCol, target },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Start at the top-right cell of a matrix sorted by row and by column. If the current value is bigger than the target, every value below it in that column is bigger too, so step left. If it is smaller, every value to its left in that row is smaller, so step down. Each comparison throws away a whole row or column.",
        invariants: [
            "The target, if present, can only lie down and to the left of the current corner.",
            "Every step leaves the search rectangle through the current cell.",
            "A discarded row or column can never contain the target.",
        ],
        correctness:
            "Because a column increases downward, a value larger than the target rules out the entire column beneath it. Because a row increases rightward, a value smaller than the target rules out the entire row to its left. The search rectangle therefore always contains any occurrence, and it shrinks until a match is found or the rectangle becomes empty, which proves absence.",
        complexityRationale:
            "Each comparison decreases the row index or the column index, never both at once, so at most rows plus columns comparisons occur. Only the visited-state map is allocated beyond the emitted grid cells, so working space is constant apart from the visualization entities.",
        uses: [
            "Range queries over sorted two-dimensional tables",
            "Locating a value in a sorted multiplication or distance matrix",
            "A teaching example of monotonicity-driven search",
        ],
        references: [
            "Sedgewick and Wayne, Algorithms, Section 1.1 exercises on sorted matrices",
            "Knuth, The Art of Computer Programming, Vol. 3, searching chapter",
        ],
        workedExample:
            "In rows [1,4,7], [2,5,8], [3,6,9] searching for 6 starts at the top-right value 7. Since 7 is too large, move left to 4. Since 4 is too small, move down to 5, then down to 6, where the target is found in four comparisons.",
    },
    id: "sorted-matrix-binary-search",
    name: "Sorted Matrix Staircase Search",
    category: "searching",
    complexity: { time: "O(rows + cols)", space: "O(1)" },
    defaultInput: {
        matrix: [
            [1, 4, 7, 10],
            [2, 5, 8, 11],
            [3, 6, 9, 12],
        ],
        target: 9,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start at the top-right cell of the sorted matrix",
        "while the position is inside the matrix",
        "compare the current value with the target",
        "if equal, return the current row and column",
        "if the value is larger, move one column left",
        "otherwise move one row down",
        "done: report the position or that the target is absent",
    ],
};

export default module;
