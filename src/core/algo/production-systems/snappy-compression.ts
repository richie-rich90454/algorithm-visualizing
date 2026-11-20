/**
 * snappy-compression.ts - Snappy Raw Block Compression
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Snappy is a fast, byte oriented compressor. A raw block starts with a varint
 * of the uncompressed length, followed by tags: literal tags copy bytes
 * verbatim, and copy tags repeat an earlier substring at a small offset. This
 * module implements the standard tag encodings (one, two, and four byte copy
 * offsets) and a greedy longest-match finder, plus a matching decompressor so
 * the format can be verified by round trip.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * window * matchLength) for the greedy search on n bytes
 *   Space: O(n) for the compressed stream and token log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per input byte shows the original message.
 *   - Cells turn green as their bytes are absorbed into a literal or copy.
 *   - Metadata records the encoded stream, its tokens, and the size ratio.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SnappyInput {
    text?: string;
    bytes?: number[];
}

interface Token {
    type: "literal" | "copy";
    position: number;
    length: number;
    offset?: number;
}

const WINDOW = 32768;
const MAX_MATCH = 64;
const MAX_LITERAL = 60;

function toBytes(task: SnappyInput): number[] {
    if (Array.isArray(task.bytes)) {
        return task.bytes.map((b) => b & 0xff);
    }
    const text = typeof task.text === "string" ? task.text : "aaaaaaaaaaabbbbbbbbbbbcccccccccc";
    const result: number[] = [];
    for (let i = 0; i < text.length; i += 1) {
        result.push(text.charCodeAt(i) & 0xff);
    }
    return result;
}

function encodeVarint(value: number): number[] {
    const out: number[] = [];
    let n = value >>> 0;
    while (n >= 0x80) {
        out.push((n & 0x7f) | 0x80);
        n >>>= 7;
    }
    out.push(n);
    return out;
}

/** Find the longest earlier match of at least four bytes, or null. */
function findMatch(bytes: number[], at: number): { length: number; offset: number } | null {
    const maxLength = Math.min(MAX_MATCH, bytes.length - at);
    if (maxLength < 4) {
        return null;
    }
    const start = Math.max(0, at - WINDOW);
    let bestLength = 0;
    let bestOffset = 0;
    for (let j = at - 1; j >= start; j -= 1) {
        let length = 0;
        while (length < maxLength && bytes[j + length] === bytes[at + length]) {
            length += 1;
        }
        if (length > bestLength) {
            bestLength = length;
            bestOffset = at - j;
            if (bestLength === maxLength) {
                break;
            }
        }
    }
    return bestLength >= 4 ? { length: bestLength, offset: bestOffset } : null;
}

function emitLiteral(out: number[], literal: number[]): void {
    out.push(((literal.length - 1) << 2) & 0xff);
    for (const byte of literal) {
        out.push(byte);
    }
}

function emitCopy(out: number[], length: number, offset: number): void {
    if (length >= 4 && length <= 11 && offset < 2048) {
        out.push(0x01 | ((length - 4) << 2) | (((offset >> 8) & 0x07) << 5));
        out.push(offset & 0xff);
    } else if (offset < 65536) {
        out.push(0x02 | (((length - 1) & 0x3f) << 2));
        out.push(offset & 0xff);
        out.push((offset >> 8) & 0xff);
    } else {
        for (let k = 0; k < length; k += 1) {
            out.push(0x03);
            out.push(offset & 0xff, (offset >> 8) & 0xff, (offset >> 16) & 0xff, (offset >> 24) & 0xff);
        }
    }
}

/** Compress a byte array into a Snappy raw block, returning tokens for display. */
function compress(bytes: number[]): { output: number[]; tokens: Token[] } {
    const output = encodeVarint(bytes.length);
    const tokens: Token[] = [];
    let i = 0;
    while (i < bytes.length) {
        const match = findMatch(bytes, i);
        if (match) {
            emitCopy(output, match.length, match.offset);
            tokens.push({ type: "copy", position: i, length: match.length, offset: match.offset });
            i += match.length;
        } else {
            const start = i;
            while (i < bytes.length && i - start < MAX_LITERAL) {
                if (findMatch(bytes, i)) {
                    break;
                }
                i += 1;
            }
            if (i === start) {
                i += 1;
            }
            emitLiteral(output, bytes.slice(start, i));
            tokens.push({ type: "literal", position: start, length: i - start });
        }
    }
    return { output, tokens };
}

/** Decompress a Snappy raw block so round trips can be checked. */
function decompress(input: number[]): number[] {
    let position = 0;
    let expected = 0;
    let shift = 0;
    let header;
    do {
        header = input[position++] ?? 0;
        expected |= (header & 0x7f) << shift;
        shift += 7;
    } while ((header & 0x80) !== 0);
    const output: number[] = [];
    while (position < input.length) {
        const tag = input[position++] ?? 0;
        const type = tag & 0x03;
        if (type === 0) {
            const length = ((tag >> 2) & 0x3f) + 1;
            for (let k = 0; k < length; k += 1) {
                output.push(input[position++] ?? 0);
            }
        } else if (type === 1) {
            const length = ((tag >> 2) & 0x07) + 4;
            const offset = (((tag >> 5) & 0x07) << 8) | (input[position++] ?? 0);
            for (let k = 0; k < length; k += 1) {
                output.push(output[output.length - offset] ?? 0);
            }
        } else if (type === 2) {
            const length = ((tag >> 2) & 0x3f) + 1;
            const offset = (input[position++] ?? 0) | ((input[position++] ?? 0) << 8);
            for (let k = 0; k < length; k += 1) {
                output.push(output[output.length - offset] ?? 0);
            }
        } else {
            const offset =
                (input[position++] ?? 0) |
                ((input[position++] ?? 0) << 8) |
                ((input[position++] ?? 0) << 16) |
                ((input[position++] ?? 0) << 24);
            output.push(output[output.length - offset] ?? 0);
        }
    }
    return output.slice(0, expected);
}

/** Render tokens as strings for frame metadata (which holds only primitives). */
function tokenStrings(tokens: Token[]): string[] {
    return tokens.map((token) =>
        token.type === "literal"
            ? `literal:${token.position}:${token.length}`
            : `copy:${token.position}:${token.length}:${token.offset ?? 0}`,
    );
}

/** Build one cell per input byte, marking all bytes absorbed so far. */
function makeCells(bytes: number[], absorbed: number, done: boolean): VisualEntity[] {
    return bytes.map((value, index) => {
        let state: EntityState = "idle";
        if (done || index < absorbed) {
            state = "sorted";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${value} (${String.fromCharCode(value) === "" ? "-" : "'" + String.fromCharCode(value) + "'"})`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, byte: value },
        };
    });
}

/** The Snappy compression generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SnappyInput | null) ?? {};
    const bytes = toBytes(task);
    const { output, tokens } = compress(bytes);
    const originalLength = bytes.length;
    const compressedLength = output.length;

    yield {
        stepNumber: 0,
        entities: makeCells(bytes, 0, false),
        edges: [],
        description: `Compressing ${originalLength} byte(s) into a Snappy raw block.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: bytes.length, originalLength, compressedLength: 0, compressed: [] as number[], tokens: [] as string[], ratio: 0 },
    };
    let step = 1;
    let absorbed = 0;
    const emitted: number[] = [];

    for (let t = 0; t < tokens.length; t += 1) {
        const token = tokens[t]!;
        absorbed += token.length;
        const startByte = token.position;
        if (token.type === "literal") {
            emitted.push(((token.length - 1) << 2) & 0xff);
            for (let k = 0; k < token.length; k += 1) {
                emitted.push(bytes[startByte + k] ?? 0);
            }
        } else {
            emitCopy(emitted, token.length, token.offset ?? 0);
        }
        const visible = t === tokens.length - 1 ? output : emitted;
        yield {
            stepNumber: step,
            entities: makeCells(bytes, absorbed, false),
            edges: [],
            description: `Token ${t}: ${token.type} of ${token.length} byte(s)${token.offset !== undefined ? ` at offset ${token.offset}` : ""}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: 1, cols: bytes.length, originalLength, compressedLength: visible.length, compressed: [...visible], tokens: tokenStrings(tokens.slice(0, t + 1)), ratio: originalLength === 0 ? 0 : visible.length / originalLength },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(bytes, absorbed, true),
        edges: [],
        description: `Compressed ${originalLength} byte(s) to ${compressedLength} byte(s), ratio ${(compressedLength / Math.max(1, originalLength)).toFixed(3)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 1, cols: bytes.length, originalLength, compressedLength, compressed: output, tokens: tokenStrings(tokens), decompressed: decompress(output), ratio: originalLength === 0 ? 0 : compressedLength / originalLength, done: true },
    };
}

/** The Snappy compression module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Snappy trades a little compression ratio for speed. It scans the input for repeated substrings and replaces each repeat with a short copy instruction that says how far back to look and how many bytes to take; everything else is emitted as literal bytes. A tiny varint at the front records the original length.",
        invariants: [
            "The first bytes are a varint encoding the uncompressed length.",
            "Every literal tag copies its bytes unchanged, and every copy tag references earlier output.",
            "Decompressing the stream always reproduces the original message.",
        ],
        correctness:
            "The compressor only emits a copy when the bytes at the chosen offset equal the bytes at the current position for the whole match, so replaying that copy from decoded output produces identical bytes. Literal tags reproduce their stored bytes verbatim, and the decompressor parses the same tag encodings the compressor wrote. Therefore the round trip is the identity, and the leading varint restores the exact original length.",
        complexityRationale:
            "The greedy finder checks each candidate offset and up to 64 matching bytes, so a naive implementation is O(n times window times match length) in the worst case, though realistic data stop early. The compressed stream and token log use O(n) space.",
        uses: [
            "Fast block compression in storage engines such as RocksDB",
            "Compressing RPC and big data messages in Spark and Hadoop",
            "Low latency network payload compression where speed matters most",
        ],
        references: [
            "Google, Snappy Compressed Format Specification",
            "Ziv and Lempel, A Universal Algorithm for Sequential Data Compression, 1977",
        ],
        workedExample:
            "Compressing the repeated text aaaaaaabbbbbbbb begins with a varint for the length, then a literal for the first few a bytes, followed by a copy tag that repeats them and a copy tag for the b run. Decompressing reads the varint, replays the literal, then expands each copy, recovering the original bytes exactly.",
    },
    id: "snappy-compression",
    name: "Snappy Compression",
    category: "production-systems",
    complexity: { time: "O(n * window * matchLength)", space: "O(n)" },
    defaultInput: { text: "aaaaaaaaaabbbbbbbbbbccccccccccaaaaaaaaaabbbbbbbbbb" },
    visualType: "grid",
    run,
    pseudocode: [
        "write the uncompressed length as a varint",
        "scan from the current position for the longest earlier match of at least four bytes",
        "if a match exists emit a copy tag with its length and offset",
        "otherwise gather up to sixty literal bytes and emit a literal tag",
        "advance past the emitted bytes and repeat until the input is consumed",
        "record the full stream and the token sequence",
        "done: report the compressed bytes, ratio, and round-trip result",
    ],
};

export default module;
