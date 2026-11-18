/**
 * smawk-algorithm.ts - SMAWK Row Minima on a Totally Monotone Matrix
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SMAWK finds the column holding the minimum of every row of a totally
 * monotone (Monge) matrix in linear time. Two ideas drive it:
 *
 *   1. Column reduction: scan columns into a stack, popping the last column
 *      whenever it loses to the new column at row rows[stack.length-1]. The
 *      popped column can never be a row minimum, so it is discarded. The
 *      stack ends with at most as many columns as there are rows.
 *   2. Recursive odd rows: solve the odd-indexed rows on the reduced columns,
 *      then bracket every remaining row between the answers of its neighbors,
 *      because monotone minima only move rightward as the row index grows.
 *
 * The default matrix is the Monge matrix M[i][j] = (i - j)^2, whose row minima
 * sit on the diagonal. A custom totally monotone matrix can be supplied.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(R + C) for an R-by-C totally monotone matrix
 *   Space: O(R + C) for the reduced column lists and answer map
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells of the active reduced column set are PINK (highlight).
 *   - The row currently being reduced is YELLOW (comparing).
 *   - A row with its answer fixed is GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const current = matrix[row];
        if (!current) {
            continue;
        }
        for (let col = 0; col < current.length; col += 1) {
            const value = current[col];
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { matrix?: number[][]; rows?: number; cols?: number } | null) ?? {};
    const rows = task.rows ?? 4;
    const cols = task.cols ?? 5;
    const matrix: number[][] =
        task.matrix ??
        Array.from({ length: rows }, (_, i) =>
            Array.from({ length: cols }, (_, j) => (i - j) * (i - j)),
        );
    const r = matrix.length;
    const c = r > 0 ? (matrix[0]?.length ?? 0) : 0;
    const answers = new Map<number, number>();
    let step = 0;

    const emit = (
        states: Map<string, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean | number[]> = {},
    ): void => {
        frames.push({
            stepNumber: step,
            entities: makeCells(matrix, states),
            edges: [],
            description,
            codeLineNumber,
            layout: "grid",
            meta: { rows: r, cols: c, ...extra },
        });
        step += 1;
    };

    const frames: VisualFrame[] = [];

    if (r === 0 || c === 0) {
        emit(new Map(), "Empty matrix: there are no row minima to compute.", 0);
        yield* frames;
        return;
    }

    emit(new Map(), `SMAWK over a ${r} by ${c} totally monotone matrix.`, 0);

    const value = (row: number, col: number): number => matrix[row]?.[col] ?? Infinity;

    /**
     * Stack-based column reduction. A column that loses to a later column at
     * row rows[stack.length-1] can never be a minimum in any remaining row.
     */
    const reduce = (rowList: number[], activeCols: number[]): number[] => {
        const stack: number[] = [];
        for (const col of activeCols) {
            while (stack.length > 0) {
                const compareRow = rowList[stack.length - 1] as number;
                const last = stack[stack.length - 1] as number;
                if (value(compareRow, last) > value(compareRow, col)) {
                    stack.pop();
                } else {
                    break;
                }
            }
            if (stack.length < rowList.length) {
                stack.push(col);
            }
        }
        return stack;
    };

    /** Scan a bracket of columns, returning the first column with the smallest value. */
    const scan = (row: number, activeCols: number[], lo: number, hi: number): number => {
        let bestCol = activeCols[0] as number;
        let bestVal = value(row, bestCol);
        for (const col of activeCols) {
            if (col < lo || col > hi) {
                continue;
            }
            const candidate = value(row, col);
            if (candidate < bestVal) {
                bestVal = candidate;
                bestCol = col;
            }
        }
        return bestCol;
    };

    function* solve(rowList: number[], activeCols: number[], depth: number): Generator<VisualFrame, void, unknown> {
        if (rowList.length === 0) {
            return;
        }

        const reduced = reduce(rowList, activeCols);
        const states = new Map<string, EntityState>();
        for (const row of rowList) {
            for (const col of activeCols) {
                states.set(`${row},${col}`, "comparing");
            }
            for (const col of reduced) {
                states.set(`${row},${col}`, "highlight");
            }
        }
        emit(
            states,
            `Depth ${depth}: reduced ${activeCols.length} columns to ${reduced.length} across ${rowList.length} row(s).`,
            1,
        );

        if (reduced.length === 1) {
            const only = reduced[0] as number;
            for (const row of rowList) {
                answers.set(row, only);
                emit(
                    new Map([[`${row},${only}`, "sorted"]]),
                    `Row ${row} minimum is column ${only} (only column remains).`,
                    3,
                    { minima: [...answers.values()] },
                );
            }
            return;
        }

        const oddRows: number[] = [];
        for (let i = 1; i < rowList.length; i += 2) {
            oddRows.push(rowList[i] as number);
        }

        if (oddRows.length > 0) {
            yield* solve(oddRows, reduced, depth + 1);
        }

        const firstRow = rowList[0] as number;
        const firstUpper = oddRows.length > 0 ? (answers.get(oddRows[0] as number) ?? reduced[reduced.length - 1] as number) : (reduced[reduced.length - 1] as number);
        const firstAnswer = scan(firstRow, reduced, reduced[0] as number, firstUpper);
        answers.set(firstRow, firstAnswer);
        emit(
            new Map([[`${firstRow},${firstAnswer}`, "sorted"]]),
            `Row ${firstRow} minimum is column ${firstAnswer} inside bracket [${reduced[0]}, ${firstUpper}].`,
            4,
            { minima: [...answers.values()] },
        );

        for (let i = 0; i < oddRows.length; i += 1) {
            const evenIndex = 2 * i + 2;
            if (evenIndex >= rowList.length) {
                break;
            }
            const evenRow = rowList[evenIndex] as number;
            const lo = answers.get(oddRows[i] as number) ?? (reduced[0] as number);
            const hi = answers.get(oddRows[i + 1] as number) ?? (reduced[reduced.length - 1] as number);
            const answer = scan(evenRow, reduced, lo, hi);
            answers.set(evenRow, answer);
            emit(
                new Map([[`${evenRow},${answer}`, "sorted"]]),
                `Row ${evenRow} minimum is column ${answer} between neighbor answers ${lo} and ${hi}.`,
                4,
                { minima: [...answers.values()] },
            );
        }
    }

    yield* solve(
        Array.from({ length: r }, (_, i) => i),
        Array.from({ length: c }, (_, i) => i),
        0,
    );

    const minima = Array.from({ length: r }, (_, i) => answers.get(i) ?? -1);
    emit(new Map(), `Row minima: [${minima.join(", ")}].`, 5, { minima });
    yield* frames;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "For a matrix whose row minima move monotonically to the right, half the columns can be thrown away before any real searching begins. Compare neighboring columns in one representative row and keep only the better one of each pair. Solve the odd rows on that smaller matrix, then use their answers as left and right brackets for the rows in between.",
        invariants: [
            "A discarded column can never be a row minimum in any row, by total monotonicity.",
            "The reduced columns stay in increasing order, so a row's search bracket is a contiguous range.",
            "Monotone minima imply the optimum of a row lies between the optima of the rows just above and below it.",
        ],
        correctness:
            "When the stack discards column a because a later column b beats it at row r, total monotonicity guarantees a never beats b in any row below r, so a cannot be a row minimum there. This makes reduction safe. The recursive call returns exact answers for the odd rows. For an even row between two odd rows with known minima p and q, monotonicity forces its minimum column into the range [p, q], so scanning that narrow bracket finds it. Induction on the number of rows completes the argument.",
        complexityRationale:
            "Each reduction pass halves the columns and the recursion visits every row once, giving O(R + C) total work for an R-by-C totally monotone matrix. Storage is linear in the number of rows and columns for the reduced lists and answer table.",
        uses: [
            "DP optimization where the argmin is monotone, such as divide-and-conquer DP",
            "Speeding up distance transforms and dynamic time warping tables",
            "Computing row minima of Monge matrices in linear time",
        ],
        references: [
            "Aggarwal et al., Finding the Minimum in a Row of a Matrix, SIAM Journal on Computing, 1987",
            "Kleinberg and Tardos, Algorithm Design, Chapter 6 (Monge arrays)",
        ],
        workedExample:
            "On the 4 by 5 matrix M[i][j] = (i-j)^2, the stack reduction compares column 4 against column 3 in row 3, finds 1 greater than 0, and drops column 4, leaving columns 0 through 3. Recursing on odd rows pins their minima at columns 1 and 3; the even rows are then scanned only between those brackets, recovering minima 0, 1, 2, 3.",
    },
    id: "smawk-algorithm",
    name: "SMAWK Algorithm",
    category: "dynamic-programming",
    complexity: { time: "O(R + C)", space: "O(R + C)" },
    defaultInput: { rows: 4, cols: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "reduce columns with a stack, popping a column that loses at rows[stack size-1]",
        "if only one column remains, it is the minimum for every row",
        "recursively solve the odd-indexed rows on the reduced columns",
        "bracket the first row between the first column and the next known answer",
        "bracket each even row between its neighboring odd-row answers",
        "scan only each bracket to fix that row's minimum column",
        "return the array of row minima",
    ],
};

export default module;
