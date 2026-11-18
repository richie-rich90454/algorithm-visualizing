/**
 * conditional-probability.ts - Conditional Probability From a Joint Table
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a joint frequency table whose rows and columns are two events, the
 * conditional probability of a row given a column is the count in their
 * intersection divided by the total count in the conditioning column. The
 * module highlights the conditioning column as the denominator and each
 * intersection cell as the numerator.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rows * cols) to read the table and its column total
 *   Space: O(rows * cols) for the displayed cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each joint count is a cell in a grid.
 *   - The conditioning column is highlighted when its total is computed.
 *   - A numerator cell turns green when its row conditional is formed.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TableInput {
    table?: number[][];
    givenColumn?: number;
}

/** Build grid cells, marking the conditioning column and current row. */
function makeCells(
    table: number[][],
    givenColumn: number,
    mode: "none" | "column" | "row",
    currentRow: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < table.length; r += 1) {
        const row = table[r] ?? [];
        for (let c = 0; c < row.length; c += 1) {
            let state: EntityState = "idle";
            if (mode === "column" && c === givenColumn) {
                state = "comparing";
            } else if (mode === "row" && c === givenColumn && r === currentRow) {
                state = "sorted";
            } else if (mode === "row" && c === givenColumn) {
                state = "visited";
            }
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: `${row[c] ?? 0}`,
                value: row[c] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, count: row[c] ?? 0 },
            });
        }
    }
    return entities;
}

/** The conditional probability generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TableInput | null) ?? {};
    const table: number[][] = Array.isArray(task.table)
        ? task.table.map((row) => [...row])
        : [
              [80, 10],
              [5, 20],
          ];
    const rows = table.length;
    const cols = rows > 0 ? (table[0]?.length ?? 0) : 0;
    const givenColumn = Math.max(0, Math.min(cols - 1, Math.floor(task.givenColumn ?? cols - 1)));
    let columnTotal = 0;
    for (let r = 0; r < rows; r += 1) {
        columnTotal += table[r]?.[givenColumn] ?? 0;
    }

    yield {
        stepNumber: 0,
        entities: makeCells(table, givenColumn, "none", -1),
        edges: [],
        description: `Joint table with ${rows} row(s) and ${cols} column(s); conditioning on column ${givenColumn}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, givenColumn, columnTotal, conditionals: [] as number[] },
    };
    let step = 1;

    yield {
        stepNumber: step,
        entities: makeCells(table, givenColumn, "column", -1),
        edges: [],
        description: `Column ${givenColumn} totals ${columnTotal}, which is the denominator.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows, cols, givenColumn, columnTotal, conditionals: [] as number[] },
    };
    step += 1;

    const conditionals: number[] = [];
    for (let r = 0; r < rows; r += 1) {
        const numerator = table[r]?.[givenColumn] ?? 0;
        const value = columnTotal === 0 ? 0 : numerator / columnTotal;
        conditionals.push(value);
        yield {
            stepNumber: step,
            entities: makeCells(table, givenColumn, "row", r),
            edges: [],
            description: `P(row ${r} | column ${givenColumn}) = ${numerator} / ${columnTotal} = ${value.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows, cols, givenColumn, columnTotal, conditionals: [...conditionals] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(table, givenColumn, "row", -1),
        edges: [],
        description: `Conditional distribution given column ${givenColumn}: [${conditionals.map((v) => v.toFixed(3)).join(", ")}].`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows, cols, givenColumn, columnTotal, conditionals, total: conditionals.reduce((a, b) => a + b, 0) },
    };
}

/** The conditional probability module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Conditioning narrows the world to cases where the given event happened. Inside that smaller world, the chance of the other event is just the fraction of the restricted group that also satisfies it, so you divide the shared count by the conditioning total.",
        invariants: [
            "The conditioning column total is the sum of the column's joint counts.",
            "Each numerator is one cell inside that same column.",
            "The conditionals over all rows add to one whenever the column total is positive.",
        ],
        correctness:
            "By definition P(A given B) = P(A and B) divided by P(B). Treating joint counts as unnormalized probabilities, P(B) is proportional to the conditioning column total and P(A and B) is proportional to the intersection cell count, so their ratio equals the conditional probability. The common normalizing constant cancels.",
        complexityRationale:
            "Summing one column costs O(rows) and forming one ratio per row costs another O(rows); reading the grid is O(rows times columns) for display, which is also the space used by the cells.",
        uses: [
            "Interpreting medical test results and base rates",
            "Computing posterior probabilities in Bayesian inference",
            "Recommender systems that condition on a user's segment",
        ],
        references: [
            "Ross, Introduction to Probability Models, Chapter 1",
            "Grinstead and Snell, Introduction to Probability, Chapter 4",
        ],
        workedExample:
            "In a screening table, 80 healthy and 10 sick people test negative while 5 healthy and 20 sick people test positive. Given a positive result the column totals 30, so the chance of being sick is 20 over 30, about 0.667, and the chance of being healthy is 10 over 30, about 0.333.",
    },
    id: "conditional-probability",
    name: "Conditional Probability",
    category: "statistics-probability",
    complexity: { time: "O(rows * cols)", space: "O(rows * cols)" },
    defaultInput: {
        table: [
            [80, 10],
            [5, 20],
        ],
        givenColumn: 1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the joint count table and the conditioning column",
        "sum that column to obtain the denominator",
        "for each row take the cell in the conditioning column as the numerator",
        "divide the numerator by the denominator to get the conditional",
        "collect the conditionals into a distribution over rows",
        "done: report the conditional distribution and its total",
    ],
};

export default module;
