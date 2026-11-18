/**
 * columnar-storage.ts - Columnar Layout, Zone Maps, Dictionary Encoding, Pushdown
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A column store keeps each field of a table in one contiguous array instead
 * of storing rows together. This module transposes a row table into columns,
 * builds per-column dictionaries and per-row-group zone maps that record the
 * minimum and maximum value, and answers a range predicate by skipping any row
 * group whose zone map rules it out before scanning the rows that remain. The
 * result is identical to scanning every row, but with far fewer value reads.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(R * C) to transpose and encode, O(R) worst case to evaluate the
 *          predicate after zone-map pruning
 *   Space: O(R * C) for the columns, dictionaries, and zone maps
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid has one row per column and one column per table row.
 *   - A row group being scanned is yellow; a pruned group is gray.
 *   - Matching cells turn green in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Cell = number | string;
type Predicate = { column: string; op: ">" | "<" | "=" | ">=" | "<="; value: number };

function compare(value: number, op: Predicate["op"], bound: number): boolean {
    switch (op) {
        case ">": return value > bound;
        case "<": return value < bound;
        case "=": return value === bound;
        case ">=": return value >= bound;
        case "<=": return value <= bound;
    }
}

/** True when no value in the interval [min, max] can satisfy the predicate. */
function zonePrunes(min: number, max: number, op: Predicate["op"], bound: number): boolean {
    switch (op) {
        case ">": return max <= bound;
        case ">=": return max < bound;
        case "<": return min >= bound;
        case "<=": return min > bound;
        case "=": return min > bound || max < bound;
    }
}

function makeCells(
    columns: string[],
    columnNames: string[],
    rowCount: number,
    matchRows: Set<number>,
    scanGroups: Set<number>,
    prunedGroups: Set<number>,
    rowGroupSize: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let c = 0; c < columnNames.length; c += 1) {
        const values = (columns[c] ?? "").split(",");
        for (let r = 0; r < rowCount; r += 1) {
            const group = Math.floor(r / rowGroupSize);
            let state: EntityState = "idle";
            if (done && matchRows.has(r)) {
                state = "sorted";
            } else if (prunedGroups.has(group)) {
                state = "unvisited";
            } else if (scanGroups.has(group)) {
                state = "comparing";
            }
            entities.push({
                id: `cell-${c}-${r}`,
                type: "cell" as const,
                label: values[r] ?? "",
                value: values[r] ?? "",
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: c, col: r, group, column: columnNames[c] ?? "" },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        rows?: Array<Record<string, Cell>>;
        rowGroupSize?: number;
        predicate?: Predicate;
    } | null) ?? {};
    const fallback: Array<Record<string, Cell>> = [
        { id: 1, region: 3, sales: 120 }, { id: 2, region: 1, sales: 95 },
        { id: 3, region: 2, sales: 80 }, { id: 4, region: 3, sales: 110 },
        { id: 5, region: 1, sales: 175 }, { id: 6, region: 2, sales: 260 },
        { id: 7, region: 3, sales: 140 }, { id: 8, region: 1, sales: 290 },
        { id: 9, region: 2, sales: 110 }, { id: 10, region: 3, sales: 240 },
        { id: 11, region: 1, sales: 80 }, { id: 12, region: 2, sales: 310 },
    ];
    const rows = Array.isArray(task.rows) && task.rows.length > 0 ? task.rows : fallback;
    const columnNames = Object.keys(rows[0] ?? {});
    const rowCount = rows.length;
    const rowGroupSize = Math.max(1, Math.floor(Number(task.rowGroupSize ?? 4)) || 4);
    const predicate: Predicate = task.predicate ?? { column: "sales", op: ">", value: 150 };
    const groupCount = Math.ceil(rowCount / rowGroupSize);

    // Transpose rows into one contiguous array per column.
    const columns = columnNames.map((name) => rows.map((row) => row[name] ?? ""));
    const columnStrings = columns.map((values) => values.join(","));

    // Dictionary encoding: one distinct-id mapping per column.
    const dictionaries = columns.map((values, index) => {
        const distinct = [...new Set(values.map((value) => String(value)))];
        const encoded = values.map((value) => distinct.indexOf(String(value)));
        return `${columnNames[index]}|[${distinct.join(";")}]|${encoded.join(",")}`;
    });

    // Zone maps per column and row group.
    const zoneMaps: string[] = [];
    for (let c = 0; c < columns.length; c += 1) {
        for (let g = 0; g < groupCount; g += 1) {
            const slice = columns[c]!.slice(g * rowGroupSize, (g + 1) * rowGroupSize)
                .map((value) => Number(value)).filter((value) => Number.isFinite(value));
            const min = slice.length > 0 ? Math.min(...slice) : 0;
            const max = slice.length > 0 ? Math.max(...slice) : 0;
            zoneMaps.push(`${columnNames[c]}|${g}|${min}|${max}`);
        }
    }

    // Predicate pushdown: prune groups using the zone map, then scan survivors.
    const predicateColumnIndex = Math.max(0, columnNames.indexOf(predicate.column));
    const matchRows = new Set<number>();
    const prunedGroups = new Set<number>();
    const scannedGroups = new Set<number>();
    const groupVerdicts: string[] = [];
    for (let g = 0; g < groupCount; g += 1) {
        const map = zoneMaps.find((entry) => {
            const parts = entry.split("|");
            return parts[0] === predicate.column && Number(parts[1]) === g;
        });
        const parts = map?.split("|") ?? [];
        const min = Number(parts[2] ?? 0);
        const max = Number(parts[3] ?? 0);
        if (zonePrunes(min, max, predicate.op, Number(predicate.value))) {
            prunedGroups.add(g);
            groupVerdicts.push(`group ${g} pruned by zone [${min}, ${max}]`);
            continue;
        }
        scannedGroups.add(g);
        let scannedMatches = 0;
        for (let r = g * rowGroupSize; r < Math.min(rowCount, (g + 1) * rowGroupSize); r += 1) {
            const value = Number(columns[predicateColumnIndex]?.[r] ?? 0);
            if (compare(value, predicate.op, Number(predicate.value))) {
                matchRows.add(r);
                scannedMatches += 1;
            }
        }
        groupVerdicts.push(`group ${g} scanned, ${scannedMatches} match(es)`);
    }

    const meta = (phase: string, activeGroup: number) => ({
        phase,
        activeGroup,
        columnNames,
        columns: columnStrings,
        rowCount,
        rowGroupSize,
        groupCount,
        dictionaries,
        zoneMaps,
        predicate: `${predicate.column} ${predicate.op} ${predicate.value}`,
        groupVerdicts,
        matchedRows: [...matchRows].sort((a, b) => a - b),
        prunedGroups: [...prunedGroups],
        scannedGroups: [...scannedGroups],
    });

    yield {
        stepNumber: 0,
        entities: makeCells(columnStrings, columnNames, rowCount, matchRows, scannedGroups, prunedGroups, rowGroupSize, false),
        edges: [],
        description: `Transposed ${rowCount} rows into ${columnNames.length} contiguous columns.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta("transpose", -1),
    };
    let step = 1;

    for (let c = 0; c < columnNames.length; c += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(columnStrings, columnNames, rowCount, matchRows, scannedGroups, prunedGroups, rowGroupSize, false),
            edges: [],
            description: `Column ${columnNames[c]}: dictionary encoded into ${(dictionaries[c] ?? "").split("|")[1] ?? ""}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { ...meta("dictionary", -1), activeColumn: c },
        };
        step += 1;
    }

    for (let g = 0; g < groupCount; g += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(columnStrings, columnNames, rowCount, matchRows, new Set([g]), prunedGroups, rowGroupSize, false),
            edges: [],
            description: `Row group ${g}: ${groupVerdicts[g] ?? ""}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: meta("pushdown", g),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(columnStrings, columnNames, rowCount, matchRows, scannedGroups, prunedGroups, rowGroupSize, true),
        edges: [],
        description: `Predicate returned ${matchRows.size} row(s); ${prunedGroups.size} of ${groupCount} row group(s) were pruned.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...meta("done", -1), phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Row stores keep one record together; column stores keep one field together across many records. That layout lets a query read only the columns it needs and lets each block carry a tiny summary of its minimum and maximum values. If a range predicate cannot be satisfied inside a block, the whole block is skipped without reading its rows, which is called predicate pushdown.",
        invariants: [
            "Transposing the columns back to rows reproduces the original table.",
            "Every value in a row group lies between that group's zone-map minimum and maximum.",
            "Pushdown returns exactly the rows a full scan would return.",
        ],
        correctness:
            "The transpose is a bijection between row-major and column-major indexing. A dictionary records each distinct value once and an integer id for each occurrence, so the original values are recovered by indexing the dictionary. A zone map prunes a group only when the predicate is impossible for every value in the recorded interval, which follows from the interval bounds; groups that survive are scanned completely. Hence no matching row is discarded and no nonmatching row is added, so pushdown and full scan agree.",
        complexityRationale:
            "Building the columns, dictionaries, and zone maps touches each of the R times C cells once, and predicate evaluation scans at most all R rows; all structures together use O(R times C) space.",
        uses: [
            "Analytic queries in column-oriented databases",
            "Predicate pushdown in Parquet and ORC files",
            "Dictionary and run-length encoding in log storage engines",
        ],
        references: [
            "Stonebraker et al., C-Store: A Column-oriented DBMS, 2005",
            "Abadi, Columnar Storage Layouts and Their Optimization, 2007",
        ],
        workedExample:
            "For sales values grouped in fours, one group might span 120 to 330 while another spans 80 to 110. The predicate sales greater than 150 prunes the second group from its zone map alone and scans the first, returning the same rows as a full scan while reading half the blocks.",
    },
    id: "columnar-storage",
    name: "Columnar Storage",
    category: "production-systems",
    complexity: { time: "O(R * C)", space: "O(R * C)" },
    defaultInput: {
        rows: [
            { id: 1, region: 3, sales: 120 }, { id: 2, region: 1, sales: 95 },
            { id: 3, region: 2, sales: 80 }, { id: 4, region: 3, sales: 110 },
            { id: 5, region: 1, sales: 175 }, { id: 6, region: 2, sales: 260 },
            { id: 7, region: 3, sales: 140 }, { id: 8, region: 1, sales: 290 },
            { id: 9, region: 2, sales: 110 }, { id: 10, region: 3, sales: 240 },
            { id: 11, region: 1, sales: 80 }, { id: 12, region: 2, sales: 310 },
        ],
        rowGroupSize: 4,
        predicate: { column: "sales", op: ">", value: 150 },
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the row table and the row group size",
        "transpose the rows into one array per column",
        "dictionary encode each column into distinct values and ids",
        "compute a min and max zone map per column and row group",
        "for each group prune it when the zone map rules out the predicate",
        "scan the surviving groups and collect matching row indices",
        "done: report the matches and the number of pruned groups",
    ],
};

export default module;
