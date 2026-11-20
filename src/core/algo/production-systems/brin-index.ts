/**
 * brin-index.ts - Block Range Index (BRIN) Build and Probe
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A BRIN index divides a table into consecutive block ranges and stores only
 * the minimum and maximum indexed value for each range. A range query skips
 * every range whose [min, max] interval cannot overlap the predicate, then
 * scans the few surviving ranges exactly. The index is tiny and cheap to
 * maintain because appending a row only widens one range summary.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) to build, O(r + c) to query for r ranges and c candidate rows
 *   Space: O(r) for the range summaries
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per row shows the indexed column value.
 *   - Range build highlights consecutive bars being summarized.
 *   - Query prunes a range to gray, scans candidates in yellow, and marks
 *     true matches green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Query = { column?: number; low?: number; high?: number };

/** Build the row bars, coloring them by the current query phase. */
function makeBars(
    rows: number[][],
    column: number,
    pagesPerRange: number,
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return rows.map((row, index) => {
        const value = row[column] ?? 0;
        return {
            id: `row-${index}`,
            type: "bar" as const,
            label: String(value),
            value,
            state: states.get(index) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: index, column, range: Math.floor(index / pagesPerRange) },
        };
    });
}

/** The BRIN index module. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { rows?: number[][]; query?: Query; pagesPerRange?: number } | null) ?? {};
    const rows: number[][] = Array.isArray(task.rows)
        ? task.rows.map((row) => row.map(Number))
        : Array.from({ length: 24 }, (_, i) => [i, (i * 7) % 100]);
    const query = task.query ?? {};
    const column = typeof query.column === "number" ? Math.max(0, Math.floor(query.column)) : 1;
    const low = typeof query.low === "number" ? query.low : 30;
    const high = typeof query.high === "number" ? query.high : 60;
    const pagesPerRange =
        typeof task.pagesPerRange === "number" ? Math.max(1, Math.floor(task.pagesPerRange)) : 4;

    const rangeCount = Math.ceil(rows.length / pagesPerRange);
    const ranges: Array<{ min: number; max: number; start: number; end: number }> = [];
    const results: number[] = [];
    const states = new Map<number, EntityState>();

    yield {
        stepNumber: 0,
        entities: makeBars(rows, column, pagesPerRange),
        edges: [],
        description: `Building a BRIN index over ${rows.length} rows in ${rangeCount} block range(s), each covering ${pagesPerRange} row(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { column, low, high, pagesPerRange, rangeCount, rangeSummaries: [], resultIds: [] },
    };
    let step = 1;

    for (let r = 0; r < rangeCount; r += 1) {
        const start = r * pagesPerRange;
        const end = Math.min(start + pagesPerRange, rows.length) - 1;
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        const active = new Map<number, EntityState>();
        for (let i = start; i <= end; i += 1) {
            const value = rows[i]?.[column] ?? 0;
            min = Math.min(min, value);
            max = Math.max(max, value);
            active.set(i, "comparing");
        }
        ranges.push({ min, max, start, end });
        yield {
            stepNumber: step,
            entities: makeBars(rows, column, pagesPerRange, active),
            edges: [],
            description: `Range ${r} covers rows ${start}-${end}: summary [${min}, ${max}] stored in the index.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                column,
                low,
                high,
                pagesPerRange,
                rangeCount,
                rangeSummaries: ranges.map((range) => [range.min, range.max]),
                resultIds: [],
            },
        };
        step += 1;
    }

    for (let r = 0; r < rangeCount; r += 1) {
        const range = ranges[r] as { min: number; max: number; start: number; end: number };
        const overlaps = range.max >= low && range.min <= high;
        const phase = new Map<number, EntityState>();
        for (let i = range.start; i <= range.end; i += 1) {
            const value = rows[i]?.[column] ?? 0;
            if (!overlaps) {
                phase.set(i, "idle");
            } else if (value >= low && value <= high) {
                phase.set(i, "sorted");
                results.push(i);
            } else {
                phase.set(i, "visited");
            }
        }
        for (const [i, state] of phase) states.set(i, state);
        yield {
            stepNumber: step,
            entities: makeBars(rows, column, pagesPerRange, phase),
            edges: [],
            description: overlaps
                ? `Range ${r} overlaps [${low}, ${high}]: scanning rows ${range.start}-${range.end} exactly.`
                : `Range ${r} summary [${range.min}, ${range.max}] misses [${low}, ${high}]: pruning all ${range.end - range.start + 1} row(s).`,
            codeLineNumber: overlaps ? 5 : 4,
            layout: "array",
            meta: {
                column,
                low,
                high,
                pagesPerRange,
                rangeCount,
                rangeSummaries: ranges.map((item) => [item.min, item.max]),
                resultIds: results.slice(),
                pruned: !overlaps,
            },
        };
        step += 1;
    }

    for (let i = 0; i < rows.length; i += 1) {
        if (!states.has(i)) states.set(i, "idle");
    }
    yield {
        stepNumber: step,
        entities: makeBars(rows, column, pagesPerRange, states),
        edges: [],
        description: `Query complete: ${results.length} row(s) matched in ${rangeCount} range(s) using only ${ranges.length} summary interval(s).`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            column,
            low,
            high,
            pagesPerRange,
            rangeCount,
            rangeSummaries: ranges.map((range) => [range.min, range.max]),
            resultIds: results.slice(),
        },
    };
}

/** The BRIN index module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of storing every key, BRIN stores one rough summary per consecutive block of rows: the smallest and largest indexed value. A query first checks those summaries. If a range cannot possibly contain a matching value, the whole block is skipped; otherwise the block is scanned row by row. The index is tiny, which makes it attractive for very large, naturally ordered tables.",
        invariants: [
            "Each range summary equals the true minimum and maximum of its rows.",
            "A pruned range contains no row that satisfies the predicate.",
            "Every matching row lies in a range whose summary overlaps the query interval.",
        ],
        correctness:
            "A row with value v in [low, high] forces its range minimum to be at most v and its range maximum to be at least v, so that range's [min, max] interval overlaps [low, high]. Therefore pruning a non-overlapping range can never discard a true match. Scanning every row of the surviving ranges exactly recovers all matches and no false positives.",
        complexityRationale:
            "Building touches each row once to update its range summary, costing O(n) time and O(r) space for r ranges. A query checks all r summaries and scans only the rows in overlapping ranges, so it costs O(r + c) where c is the number of candidate rows.",
        uses: [
            "Very large append-only tables in PostgreSQL",
            "Range queries over naturally ordered time-series columns",
            "Low-maintenance indexes where storage overhead must stay small",
        ],
        references: [
            "PostgreSQL Documentation, BRIN Indexes",
            "Stonebraker and Hellerstein, Readings in Database Systems, Chapter on indexes",
        ],
        workedExample:
            "With pagesPerRange 4, rows with values 10, 20, 35, 40 form a range summarized as [10, 40]. A query for [30, 60] overlaps that summary, so the block is scanned and 35 and 40 are returned. A later range summarized [1, 8] is pruned without reading any row.",
    },
    id: "brin-index",
    name: "Block Range Index (BRIN)",
    category: "production-systems",
    complexity: { time: "O(n) build; O(r + c) query", space: "O(r)" },
    defaultInput: {
        rows: Array.from({ length: 24 }, (_, i) => [i, (i * 7) % 100]),
        query: { column: 1, low: 30, high: 60 },
        pagesPerRange: 4,
    },
    visualType: "array",
    run,
    pseudocode: [
        "split the table into consecutive ranges of pages",
        "for each range compute the minimum and maximum indexed value",
        "store the [min, max] summary in the index",
        "for a range query compare each summary with [low, high]",
        "if the intervals do not overlap, prune the whole range",
        "otherwise scan each row in the range exactly",
        "emit rows whose value lies inside the query interval",
        "done: report the matching rows and ranges scanned",
    ],
};

export default module;
