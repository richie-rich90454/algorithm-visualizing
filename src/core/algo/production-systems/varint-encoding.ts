/**
 * varint-encoding.ts - Base-128 Variable-Length Integer Encoding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Variable-length integers store a non-negative integer in as many bytes as
 * needed. Each byte contributes seven data bits and uses its high bit as a
 * continuation flag: one means "another byte follows". Small values occupy one
 * byte, while larger values grow seven bits at a time. This is the LEB128 style
 * encoding used by protocol buffers and many binary formats.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(total bytes) - seven bits are consumed per byte
 *   Space: O(total bytes) for the encoded output
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row is one input value; each cell is one encoded byte in hex.
 *   - A byte with the continuation bit set is yellow; a final byte is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Encode one non-negative integer into base-128 varint bytes. */
export function encodeVarint(value: number): number[] {
    let remaining = Math.max(0, Math.floor(value));
    const bytes: number[] = [];
    do {
        let byte = remaining % 128;
        remaining = Math.floor(remaining / 128);
        if (remaining > 0) {
            byte += 128;
        }
        bytes.push(byte);
    } while (remaining > 0);
    return bytes;
}

/** Decode a base-128 varint back into its integer value. */
export function decodeVarint(bytes: number[]): number {
    let result = 0;
    let shift = 0;
    for (const byte of bytes) {
        result += (byte % 128) * 2 ** shift;
        shift += 7;
    }
    return result;
}

function makeCells(values: number[], encoded: number[][], cols: number, activeRow: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < values.length; row += 1) {
        const bytes = encoded[row] ?? [];
        for (let col = 0; col < cols; col += 1) {
            const byte = bytes[col];
            const continuation = byte !== undefined && byte >= 128;
            let state: EntityState = "idle";
            if (byte !== undefined) {
                state = continuation ? "comparing" : "sorted";
            }
            if (row === activeRow && byte !== undefined) {
                state = "active";
            }
            entities.push({
                id: `byte-${row}-${col}`,
                type: "cell" as const,
                label: byte === undefined ? "-" : byte.toString(16).toUpperCase().padStart(2, "0"),
                value: byte ?? -1,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, byte: byte ?? -1, continuation },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map((v) => Math.max(0, Math.floor(v)))
        : [0, 1, 127, 128, 300, 16384];
    const encoded = values.map(encodeVarint);
    const cols = Math.max(...encoded.map((bytes) => bytes.length));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(values, [], cols, -1),
        edges: [],
        description: `Encoding ${values.length} integer(s) as base-128 variable-length bytes.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: values.length, cols, values: [...values], encoded: [] as string[] },
    };
    step += 1;

    for (let row = 0; row < values.length; row += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(values, encoded.slice(0, row + 1), cols, row),
            edges: [],
            description: `Value ${values[row]} encodes to bytes ${encoded[row]!.map((b) => b.toString(16)).join(" ")} (${encoded[row]!.length} byte(s)).`,
            codeLineNumber: encoded[row]!.length > 1 ? 3 : 4,
            layout: "grid",
            meta: {
                rows: values.length,
                cols,
                values: [...values],
                encoded: encoded.slice(0, row + 1).map((bytes) => bytes.join(",")),
                activeRow: row,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(values, encoded, cols, -1),
        edges: [],
        description: `Encoded all ${values.length} value(s) into ${encoded.reduce((sum, bytes) => sum + bytes.length, 0)} byte(s); every byte stream decodes back exactly.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: values.length,
            cols,
            values: [...values],
            encoded: encoded.map((bytes) => bytes.join(",")),
            decoded: encoded.map(decodeVarint),
            totalBytes: encoded.reduce((sum, bytes) => sum + bytes.length, 0),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Use only seven bits of each byte for data and reserve the top bit as a flag. If more data is needed, set the flag and write another byte. A value under 128 fits in a single byte, while bigger numbers spill into extra bytes in groups of seven bits, so typical small numbers stay compact.",
        invariants: [
            "Every emitted byte carries exactly seven data bits in its low bits.",
            "The high bit is set if and only if another byte follows.",
            "Decoding the byte stream reconstructs the original non-negative integer.",
        ],
        correctness:
            "The encoder repeatedly removes the lowest seven bits and emits them with a continuation flag that is set precisely when a nonzero remainder is left. The decoder accumulates each group of seven bits at the correct offset. Because the last byte has its flag clear, decoding terminates after exactly the emitted bytes, and the sum of shifted groups equals the original value by the base-128 place-value identity.",
        complexityRationale:
            "A value v is reduced by a factor of 128 on each iteration, so it takes log base 128 of v bytes. Encoding and decoding each touch every byte once, giving time and space linear in the total byte count.",
        uses: [
            "Protocol buffers and other compact binary serialization formats",
            "Compressing integer indices in columnar file formats",
            "Encoding offsets and lengths in compressed data streams",
        ],
        references: [
            "Google, Protocol Buffers Encoding Guide, 2024",
            "Leb128, Wikipedia, accessed 2026",
        ],
        workedExample:
            "The value 300 is 100101100 in binary. Its low seven bits are 0101100 (44 decimal); a remainder of two is left, so the first byte is 44 plus 128, or 172 (0xAC). The final byte is 2 (0x02). Decoding computes 44 + 2 times 128, which is 300.",
    },
    id: "varint-encoding",
    name: "Variable-Length Integer (Varint) Encoding",
    category: "production-systems",
    complexity: { time: "O(total bytes)", space: "O(total bytes)" },
    defaultInput: { values: [0, 1, 127, 128, 300, 16384] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty byte output",
        "for each non-negative integer value",
        "take the low seven bits of the value",
        "set the high bit when a nonzero remainder remains",
        "append the byte and divide the value by 128",
        "repeat until the value is zero",
        "done: report each byte stream and its decoded value",
    ],
};

export default module;
