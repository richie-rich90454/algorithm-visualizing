/**
 * bitmap-index.ts - Bitmap Index for Columnar Queries
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A bitmap index stores one bit vector per distinct column value, with bit i
 * set when row i has that value. A query combines these vectors with bit-level
 * AND and OR, which is far faster than scanning rows and maps directly to CPU
 * word operations. This module builds the bitmaps from row lists and evaluates
 * a conjunctive-plus-disjunctive query, emitting one frame per row of the
 * result.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(R * C + R) for R rows and C indexed values
 *   Space: O(R * C) bits for the index
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per row, value 1 when the row survives the query.
 *   - Matching rows are GREEN (sorted); non-matching rows stay idle.
 *   - The final frame lists the selected row ids in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    numRows?: number;
    columns?: Record<string, number[]>;
    and?: string[];
    or?: string[];
}

const DEFAULT_INPUT: Required<Input> = {
    numRows: 8,
    columns: {
        region: [0, 1, 4, 5],
        active: [0, 2, 3, 6, 7],
        premium: [1, 3, 5, 7],
    },
    and: ["active"],
    or: ["premium"],
};

function makeBars(result: boolean[], states: Map<number, EntityState>): VisualEntity[] {
    return result.map((matched, index) => ({
        id: `bar-row-${index}`,
        type: "bar" as const,
        label: `r${index}`,
        value: matched ? 1 : 0,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: index, matched },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const raw = (input as Input | null) ?? {};
    const numRows = typeof raw.numRows === "number" ? Math.max(0, raw.numRows) : DEFAULT_INPUT.numRows;
    const columns: Record<string, number[]> = raw.columns ?? DEFAULT_INPUT.columns;
    const andTerms: string[] = raw.and ?? DEFAULT_INPUT.and;
    const orTerms: string[] = raw.or ?? DEFAULT_INPUT.or;

    const bitmaps = new Map<string, boolean[]>();
    for (const [term, rows] of Object.entries(columns)) {
        const bits = new Array<boolean>(numRows).fill(false);
        for (const row of rows) {
            if (row >= 0 && row < numRows) {
                bits[row] = true;
            }
        }
        bitmaps.set(term, bits);
    }

    const matches = (term: string, row: number): boolean => bitmaps.get(term)?.[row] ?? false;
    const result = new Array<boolean>(numRows).fill(true);
    for (let row = 0; row < numRows; row += 1) {
        for (const term of andTerms) {
            if (!matches(term, row)) {
                result[row] = false;
                break;
            }
        }
        if (orTerms.length > 0 && !orTerms.some((term) => matches(term, row))) {
            result[row] = false;
        }
    }
    const selectedRows = result.flatMap((matched, row) => (matched ? [row] : []));
    const bitmapStrings: Record<string, string> = {};
    for (const [term, bits] of bitmaps) {
        bitmapStrings[term] = bits.map((bit) => (bit ? "1" : "0")).join("");
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(result, new Map()),
        edges: [],
        description: `Built ${bitmaps.size} bitmap(s) over ${numRows} row(s); evaluating AND {${andTerms.join(", ")}} and OR {${orTerms.join(", ")}}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { numRows, terms: bitmaps.size, bitmapTerms: Object.keys(bitmapStrings), bitmapBits: Object.values(bitmapStrings), selectedRows, selected: selectedRows.length },
    };
    step += 1;

    const states = new Map<number, EntityState>();
    for (let row = 0; row < numRows; row += 1) {
        states.set(row, result[row] ? "sorted" : "idle");
        yield {
            stepNumber: step,
            entities: makeBars(result, states),
            edges: [],
            description: `Row ${row}: AND terms and OR terms give ${result[row] ? "a match" : "no match"}; selected ${selectedRows.length} so far.`,
            codeLineNumber: row < numRows - 1 ? 2 : 3,
            layout: "array",
            meta: { row, matched: result[row], selectedRows, selected: selectedRows.length },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(result, states),
        edges: [],
        description: `Bitmap index query returned ${selectedRows.length} row(s): [${selectedRows.join(", ")}].`,
        codeLineNumber: 4,
        layout: "array",
        meta: { selectedRows, selected: selectedRows.length, numRows, bitmapTerms: Object.keys(bitmapStrings), bitmapBits: Object.values(bitmapStrings) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of listing which rows match a value, store a string of bits with one position per row. Combining conditions then becomes a bitwise operation over whole machine words at once. Database engines use this to answer low-cardinality filters without touching the underlying rows.",
        invariants: [
            "Each bitmap has exactly one bit per row.",
            "A row survives only if it matches every AND term and at least one OR term when OR terms exist.",
            "The reported selected rows are exactly the positions whose result bit is set.",
        ],
        correctness:
            "Setting bit i of a value's bitmap exactly when row i has that value makes membership testing equivalent to reading the bit. Conjunction of terms is logical AND of their bits and disjunction is logical OR, so evaluating these bit by bit yields the same set as scanning rows and applying the predicates directly. The enumerated selected rows are therefore the query answer.",
        complexityRationale:
            "Building all bitmaps visits each row of each indexed value once, and evaluating the query scans each row once, giving time linear in rows times values. Storage is one bit per row per value.",
        uses: [
            "Low-cardinality filters in columnar analytical databases",
            "Fast membership tests in search engines",
            "Accelerating star-schema joins in data warehouses",
        ],
        references: [
            "O'Neil and O'Neil, Database Principles, Programming, and Performance, 2001",
            "Apache Kudu and Parquet bitmap encoding documentation",
        ],
        workedExample:
            "Over eight rows, suppose the active bitmap is 11010110 and the premium bitmap is 01010101. Querying active AND premium keeps rows 1, 3, 5 and 7, because those are the positions where both bits are one.",
    },
    id: "bitmap-index",
    name: "Bitmap Index",
    category: "production-systems",
    complexity: { time: "O(R * C + R)", space: "O(R * C)" },
    defaultInput: DEFAULT_INPUT,
    visualType: "array",
    run,
    pseudocode: [
        "for each indexed value build a bit vector over all rows",
        "set bit i when row i has that value",
        "for each row test every AND term and every OR term",
        "keep the row when all AND terms and at least one OR term match",
        "report the surviving row positions as the query result",
    ],
};

export default module;
