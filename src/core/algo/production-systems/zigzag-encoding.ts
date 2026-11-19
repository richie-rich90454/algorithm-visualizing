/**
 * zigzag-encoding.ts - ZigZag Signed-to-Unsigned Mapping
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ZigZag maps signed integers onto unsigned integers so that small magnitudes,
 * whether positive or negative, become small unsigned values. Zero maps to zero,
 * -1 to 1, +1 to 2, -2 to 3, and so on. Combined with a variable-length integer
 * code it prevents negative numbers from wasting all of their bytes on sign
 * extension.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n input values
 *   Space: O(n) for the mapped output
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row shows one signed value, its zigzag value, and its varint length.
 *   - Negative inputs are red; nonnegative inputs are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Number of base-128 varint bytes needed to hold a nonnegative value. */
function varintLength(value: number): number {
    let remaining = value;
    let length = 1;
    while (remaining >= 128) {
        remaining = Math.floor(remaining / 128);
        length += 1;
    }
    return length;
}

/** Map a signed integer to a nonnegative zigzag value. */
export function zigzagEncode(value: number): number {
    return value >= 0 ? 2 * value : -2 * value - 1;
}

/** Recover the signed integer from a zigzag value. */
export function zigzagDecode(value: number): number {
    return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
}

function makeCells(values: number[], mapped: number[], activeRow: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    values.forEach((value, row) => {
        const zigzag = mapped[row] ?? 0;
        const bytes = varintLength(zigzag);
        const columns: Array<[string, number | string]> = [
            ["signed", value],
            ["zigzag", zigzag],
            ["varint bytes", bytes],
        ];
        columns.forEach(([role, display], col) => {
            let state: EntityState = value < 0 ? "error" : "sorted";
            if (role === "zigzag") state = "active";
            if (row === activeRow && role === "signed") state = "comparing";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(display),
                value: typeof display === "number" ? display : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, role, signed: value, zigzag },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map((v) => Math.trunc(v))
        : [0, -1, 1, -2, 2, -64, 64, -1000];
    const mapped = values.map(zigzagEncode);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(values, [], -1),
        edges: [],
        description: `ZigZag mapping ${values.length} signed integer(s) onto nonnegative values.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: values.length, cols: 3, values: [...values], mapped: [] as number[] },
    };
    step += 1;

    for (let row = 0; row < values.length; row += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(values, mapped.slice(0, row + 1), row),
            edges: [],
            description: `Value ${values[row]} maps to zigzag ${mapped[row]}, which needs ${varintLength(mapped[row]!)} varint byte(s).`,
            codeLineNumber: values[row]! < 0 ? 2 : 1,
            layout: "grid",
            meta: {
                rows: values.length,
                cols: 3,
                values: [...values],
                mapped: mapped.slice(0, row + 1),
                activeRow: row,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(values, mapped, -1),
        edges: [],
        description: `Mapped all ${values.length} value(s); zigzag decoding restores the original signed integers.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: values.length,
            cols: 3,
            values: [...values],
            mapped,
            decoded: mapped.map(zigzagDecode),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain two's-complement numbers make small negatives look like huge unsigned values because their sign bit is set. ZigZag interleaves the signs: nonnegative numbers become even values and negative numbers become odd values. Both +1 and -1 then land near zero, so a following variable-length code stores them in a single byte.",
        invariants: [
            "Nonnegative inputs map to even zigzag values.",
            "Negative inputs map to odd zigzag values.",
            "ZigZag decoding is the exact inverse of encoding for every integer.",
        ],
        correctness:
            "For value v at least zero the encoder returns 2v, and decoding an even u returns u/2, recovering v. For negative v the encoder returns -2v-1, an odd number, and decoding an odd u returns -(u+1)/2, which substitutes u=-2v-1 to give v. The two cases partition the integers, so the mapping is a bijection and the round trip always succeeds.",
        complexityRationale:
            "Each value is transformed with a constant number of arithmetic operations, so encoding and decoding are linear in the number of values. Only the output array needs extra space, which is also linear.",
        uses: [
            "Encoding signed coordinates and deltas in protocol buffers",
            "Compressing signed differences in time-series storage",
            "Preparing signed integers for base-128 varint encoding",
        ],
        references: [
            "Google, Protocol Buffers Encoding Guide (ZigZag), 2024",
            "Bloomberg, BSON and compact signed integer encodings, 2022",
        ],
        workedExample:
            "Zero maps to 0, -1 maps to 1, +1 maps to 2, -2 maps to 3, and +2 maps to 4. The large negative -1000 becomes 1999, which is still small enough to fit in two varint bytes, whereas its two's-complement form would require five.",
    },
    id: "zigzag-encoding",
    name: "ZigZag Signed Integer Encoding",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [0, -1, 1, -2, 2, -64, 64, -1000] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty mapped output",
        "for each signed integer value",
        "if the value is nonnegative, map it to twice the value",
        "otherwise map it to negative twice the value minus one",
        "append the mapped nonnegative value",
        "done: report the mapping and verify each value round-trips",
    ],
};

export default module;
