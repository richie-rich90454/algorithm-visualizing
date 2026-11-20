/**
 * zone-maps.ts - Zone Maps for Data Skipping
 *
 * A zone map stores the minimum and maximum value of each column inside every
 * block of a table. Before reading a block, a query predicate can often rule it
 * out from those two numbers alone, so the block is skipped without any row
 * being examined. Scanned blocks still evaluate the predicate row by row.
 *
 * Time O(total rows) to evaluate surviving zones, space O(zones) for the map.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ZoneMapInput {
    zones?: number[][];
    operator?: string;
    value?: number;
}

export type Comparison = ">=" | ">" | "<=" | "<" | "=" | "!=";

/** Test a scalar value against a comparison predicate. */
export function matches(value: number, op: Comparison, target: number): boolean {
    switch (op) {
        case ">=": return value >= target;
        case ">": return value > target;
        case "<=": return value <= target;
        case "<": return value < target;
        case "=": return value === target;
        case "!=": return value !== target;
    }
}

/** Decide whether a zone's min/max range could contain a matching row. */
export function zoneCanMatch(min: number, max: number, op: Comparison, target: number): boolean {
    switch (op) {
        case ">=": return max >= target;
        case ">": return max > target;
        case "<=": return min <= target;
        case "<": return min < target;
        case "=": return min <= target && target <= max;
        case "!=": return !(min === target && max === target);
    }
}

const COLUMNS = ["zone", "min", "max", "decision", "matched"];

function makeCells(
    zones: number[][], scanned: boolean[], matched: number[], revealed: number, active: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    zones.forEach((values, row) => {
        const min = values.length ? Math.min(...values) : 0;
        const max = values.length ? Math.max(...values) : 0;
        const display = [row, min, max, scanned[row] ? "scan" : "skip", matched[row] ?? 0];
        COLUMNS.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === active
                ? "comparing"
                : shown ? (scanned[row] ? "sorted" : "idle") : "idle";
            const value = display[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${column} ${typeof value === "string" ? value : value.toString()}` : "?",
                value: shown ? value : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        });
    });
    return entities;
}

function parseOperator(value: unknown): Comparison {
    return value === ">=" || value === ">" || value === "<=" || value === "<" || value === "=" || value === "!="
        ? value
        : ">=";
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ZoneMapInput | null) ?? {};
    const zones: number[][] = Array.isArray(task.zones) && task.zones.length > 0
        ? task.zones
        : [[1, 3, 5], [7, 9, 11], [2, 4, 6], [12, 15, 18]];
    const op = parseOperator(task.operator);
    const target = Number(task.value ?? 8);
    const minima = zones.map((z) => (z.length ? Math.min(...z) : 0));
    const maxima = zones.map((z) => (z.length ? Math.max(...z) : 0));
    const scanned = zones.map((_z, i) => zoneCanMatch(minima[i] ?? 0, maxima[i] ?? 0, op, target));
    const matched = zones.map((z, i) => scanned[i] ? z.filter((v) => matches(v, op, target)).length : 0);
    const totalMatched = matched.reduce((a, b) => a + b, 0);
    const scannedCount = scanned.filter(Boolean).length;
    const base = { rows: zones.length, cols: COLUMNS.length, operator: op, value: target, scannedCount, totalMatched };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(zones, scanned, matched, -1, -1),
        edges: [],
        description: `Zone maps prune ${zones.length} block(s) for the predicate column ${op} ${target}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, zoneMins: minima, zoneMaxes: maxima, scannedFlags: scanned.map((s) => (s ? 1 : 0)), matched },
    };
    step += 1;

    for (let i = 0; i < zones.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(zones, scanned, matched, i, i),
            edges: [],
            description: `Zone ${i}: range [${(minima[i] ?? 0).toFixed(1)}, ${(maxima[i] ?? 0).toFixed(1)}] -> ${scanned[i] ? `scan, ${matched[i]} row(s) match` : "skip"}.`,
            codeLineNumber: scanned[i] ? 4 : 2,
            layout: "grid",
            meta: { ...base, active: i, zoneMins: minima, zoneMaxes: maxima, scannedFlags: scanned.map((s) => (s ? 1 : 0)), matched },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(zones, scanned, matched, zones.length - 1, -1),
        edges: [],
        description: `Done: scanned ${scannedCount} of ${zones.length} zone(s) and matched ${totalMatched} row(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, done: true, zoneMins: minima, zoneMaxes: maxima, scannedFlags: scanned.map((s) => (s ? 1 : 0)), matched },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Column stores and partitioned tables keep each block's smallest and largest value beside the data. If a query asks for values above 100 and a block's maximum is 50, no row in that block can qualify, so the entire block is skipped. Only blocks whose range overlaps the predicate need to be read, and those are then checked row by row. The ranges act as a cheap first filter before any real work.",
        invariants: [
            "Each zone's minimum is at most its maximum.",
            "A zone is skipped only when its range cannot contain any value satisfying the predicate.",
            "For a scanned zone the reported match count equals the number of rows satisfying the predicate.",
        ],
        correctness:
            "For each comparison the skip test is the exact negation of possibility: a zone can hold a value greater than or equal to t only if its maximum is at least t, can hold a value less than t only if its minimum is below t, and can hold a value equal to t only if t lies within the range. Therefore a skipped zone cannot hide a match, and the total over scanned zones equals a full table scan. The tests compare against a brute-force scan of every row for many predicates and verify that the skipped zones contain no matching values.",
        complexityRationale:
            "Computing each zone's range costs one pass over its rows, and only surviving zones are scanned again for matches, so total time is linear in the number of rows; storing one min and max per zone uses O(zones) space.",
        uses: [
            "Predicate pushdown in columnar databases and data lakes",
            "Partition pruning for Parquet and ORC files",
            "Indexes that avoid full table scans",
        ],
        references: [
            "Abadi et al., Integration of Compression and Query Processing in Column Stores, CIDR, 2009",
            "Stonebraker et al., C-Store: A Column-oriented DBMS, VLDB, 2005",
        ],
        workedExample:
            "Zones with ranges 1 to 5, 7 to 11, and 12 to 18 are queried for values at least 8. The first zone's maximum 5 is below 8 so it is skipped; the other two maxima exceed 8 so they are scanned. Only rows 8 and above inside those two blocks are counted.",
    },
    id: "zone-maps",
    name: "Zone Maps for Data Skipping",
    category: "production-systems",
    complexity: { time: "O(total rows)", space: "O(zones)" },
    defaultInput: { zones: [[1, 3, 5], [7, 9, 11], [2, 4, 6], [12, 15, 18]], operator: ">=", value: 8 },
    visualType: "grid",
    run,
    pseudocode: [
        "for each zone compute the minimum and maximum of its column",
        "choose the comparison operator and query value",
        "decide whether the zone range can contain a matching value",
        "if the range cannot match, skip the whole zone",
        "otherwise scan the zone rows and count those satisfying the predicate",
        "add the zone count to the total matches",
        "done: report the scanned zones and the matched rows",
    ],
};

export default module;
