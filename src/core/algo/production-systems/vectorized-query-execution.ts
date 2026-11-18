/**
 * vectorized-query-execution.ts - Vectorized Query Execution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A vectorized query engine scans a columnar table in batches instead of one
 * row at a time. For each batch it evaluates a predicate on the whole column
 * slice to build a selection mask, gathers the matching rows, and folds the
 * measure column into a running aggregate. Keeping data columnar and applying
 * the same operation to many values at once improves cache locality and lets
 * the CPU exploit wide registers.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) row predicate tests plus O(n) aggregate updates
 *   Space: O(n) for the selection mask and the rendered grid
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid with one row per record and one column per stored field.
 *   - The last column shows the predicate result: green pass, red fail.
 *   - Rows in the batch currently being scanned are highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Predicate {
    column: string;
    op: "eq" | "gt" | "lt";
    value: number | string;
}

type Columns = Record<string, Array<number | string>>;

/** Compare one value against the predicate target. */
function passes(value: number | string, predicate: Predicate): boolean {
    if (predicate.op === "eq") return value === predicate.value;
    const a = Number(value);
    const b = Number(predicate.value);
    return predicate.op === "gt" ? a > b : a < b;
}

/** Render the columnar table with a selection-mask column. */
function makeCells(
    columns: Columns,
    names: string[],
    matches: boolean[],
    batchStart: number,
    batchEnd: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matches.length; row += 1) {
        const inBatch = row >= batchStart && row < batchEnd;
        for (let col = 0; col <= names.length; col += 1) {
            let label: string;
            let value: number | string;
            let state: EntityState = "idle";
            if (col === names.length) {
                label = matches[row] ? "pass" : "-";
                value = matches[row] ? 1 : 0;
                state = matches[row] ? "sorted" : "error";
                if (row >= batchEnd) state = matches[row] ? "visited" : "idle";
            } else {
                const name = names[col] as string;
                value = columns[name]?.[row] ?? "";
                label = String(value);
                if (inBatch) state = "comparing";
            }
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, name: col === names.length ? "match" : (names[col] as string) },
            });
        }
    }
    return entities;
}

/** The vectorized query execution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            columns?: Columns;
            predicate?: Predicate;
            measure?: string;
            aggregate?: "sum" | "count";
            batchSize?: number;
        } | null
    ) ?? {};
    const columns: Columns = task.columns ?? {
        region: ["A", "B", "A", "C", "B", "A", "C", "A"],
        sales: [12, 7, 25, 4, 18, 30, 9, 11],
    };
    const names = Object.keys(columns);
    const rowCount = names.length > 0 ? (columns[names[0] as string]?.length ?? 0) : 0;
    const predicate: Predicate = task.predicate ?? { column: "region", op: "eq", value: "A" };
    const measure = task.measure ?? (names.includes("sales") ? "sales" : (names[0] as string));
    const aggregate = task.aggregate === "count" ? "count" : "sum";
    const batchSize = typeof task.batchSize === "number" ? Math.max(1, Math.floor(task.batchSize)) : 4;
    const matches = new Array<boolean>(rowCount).fill(false);
    const cols = names.length + 1;

    const meta = (processed: number, selected: number, partial: number) => ({
        rows: rowCount,
        cols,
        rowCount,
        processed,
        selected,
        partial,
        total: partial,
        batchSize,
        predicate: `${predicate.column} ${predicate.op} ${String(predicate.value)}`,
        aggregate,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(columns, names, matches, -1, -1),
        edges: [],
        description: `Scan ${rowCount} records in batches of ${batchSize}; predicate ${predicate.column} ${predicate.op} ${String(predicate.value)}, ${aggregate} of ${measure}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, 0, 0),
    };
    let step = 1;
    let selected = 0;
    let partial = 0;

    for (let start = 0; start < rowCount; start += batchSize) {
        const end = Math.min(start + batchSize, rowCount);
        for (let row = start; row < end; row += 1) {
            const value = columns[predicate.column]?.[row] ?? "";
            const pass = passes(value, predicate);
            matches[row] = pass;
            if (pass) {
                selected += 1;
                if (aggregate === "sum") partial += Number(columns[measure]?.[row] ?? 0);
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(columns, names, matches, start, end),
            edges: [],
            description: `Batch rows ${start} to ${end - 1}: mask built, ${selected} row(s) selected so far, running ${aggregate} ${partial.toFixed(2)}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: meta(end, selected, partial),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(columns, names, matches, -1, -1),
        edges: [],
        description: `Query complete: ${selected} of ${rowCount} record(s) matched; ${aggregate} of ${measure} = ${(aggregate === "sum" ? partial : selected).toFixed(2)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...meta(rowCount, selected, partial), total: aggregate === "sum" ? partial : selected },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Row-by-row query engines pay interpretation overhead for every record. A vectorized engine keeps each field in its own column array and applies one operation to a whole batch, producing a compact selection mask of matching rows. The aggregate is then folded over just the selected positions, so the expensive interpretation cost is paid once per batch instead of once per row.",
        invariants: [
            "Each record is evaluated exactly once, in batch order.",
            "The selection mask is true exactly where the predicate holds.",
            "The running aggregate after the last batch equals the scalar query result.",
        ],
        correctness:
            "The predicate is a pure function of one row's field values, so evaluating batches in order and OR-ing nothing together gives the same mask as a row-at-a-time scan. Summing the measure column over the true mask positions is definitionally the SQL aggregate, and because batches partition the rows without overlap the partial sums add to the total.",
        complexityRationale:
            "Every row undergoes one predicate test and, if selected, one aggregate update, so time is O(n) independent of batch size. The selection mask and the rendered grid store O(n) values.",
        uses: [
            "Analytical query engines such as DuckDB, ClickHouse, and Apache Arrow",
            "Columnar scans in data warehouses and lakehouses",
            "SIMD-friendly filtering in in-memory databases",
        ],
        references: [
            "Boncz, Zukowski, and Nes, MonetDB/X100: Hyper-Pipelining Query Execution, CIDR 2005",
            "Abadi et al., The Design and Implementation of Modern Column-Oriented Database Systems, 2013",
        ],
        workedExample:
            "With sales values 12, 7, 25, 4 and predicate sales greater than 10 in batches of two, the first mask is true-false and the second true-false. Selection positions 0 and 2 give a sum of 37, the same as a scalar scan.",
    },
    id: "vectorized-query-execution",
    name: "Vectorized Query Execution",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        columns: {
            region: ["A", "B", "A", "C", "B", "A", "C", "A"],
            sales: [12, 7, 25, 4, 18, 30, 9, 11],
        },
        predicate: { column: "region", op: "eq", value: "A" },
        measure: "sales",
        aggregate: "sum",
        batchSize: 4,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the table column by column",
        "for each batch of rows",
        "evaluate the predicate on the whole slice to form a mask",
        "gather the positions where the mask is true",
        "fold the measure column into the running aggregate",
        "advance to the next batch",
        "done: report the selected count and final aggregate",
    ],
};

export default module;
