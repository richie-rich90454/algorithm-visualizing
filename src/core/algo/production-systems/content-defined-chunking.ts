/**
 * content-defined-chunking.ts - Content-Defined Chunking with a Gear Hash
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Content-defined chunking cuts a byte stream at boundaries determined by the
 * data rather than by fixed offsets. A rolling gear hash is updated for each
 * byte, and a boundary is declared when low hash bits are all zero. Because a
 * boundary depends only on the bytes since the last cut, inserting data in one
 * chunk shifts later boundaries but leaves the rest of the chunking stable.
 * This is the basis of data deduplication systems.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) with one table lookup and shift per byte
 *   Space: O(n) for the displayed characters and O(1) for the hash state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each character is an entity; characters in the open chunk are yellow.
 *   - Completed chunks turn green and their boundary is recorded.
 *   - The final frame lists every chunk and its byte range.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic 256-entry gear table, so a replay produces identical cuts. */
function gearTable(): number[] {
    const table: number[] = [];
    let state = 0x9e3779b9;
    for (let i = 0; i < 256; i += 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        table.push(state);
    }
    return table;
}

/** The content-defined chunking module. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { data?: string; avgBits?: number } | null) ?? {};
    const data = typeof task.data === "string" ? task.data : "dedupeContentDefinedChunkingExample";
    const avgBits = Math.max(2, Math.min(8, Math.floor(task.avgBits ?? 3)));
    const target = Math.pow(2, avgBits);
    const maxChunk = target * 8;
    const mask = target - 1;
    const table = gearTable();
    const bytes = [...data].map((ch) => ch.charCodeAt(0) & 0xff);

    const boundaries: number[] = [];
    const chunkRanges: Array<[number, number]> = [];
    let chunkStart = 0;
    let hash = 0;
    let step = 0;

    const entities = (currentEnd: number, final: boolean): VisualEntity[] =>
        bytes.map((byte, index) => {
            let state: EntityState = "idle";
            if (final) {
                state = "sorted";
            } else if (index >= chunkStart && index < currentEnd) {
                state = "active";
            } else if (boundaries.some((end) => end <= index)) {
                state = "visited";
            }
            return {
                id: `char-${index}`,
                type: "character" as const,
                label: data[index] ?? "",
                value: byte,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index, byte, chunk: boundaries.filter((end) => end <= index).length },
            };
        });

    yield {
        stepNumber: step,
        entities: entities(0, false),
        edges: [],
        description: `Scanning ${bytes.length} byte(s) with a gear hash; target chunk size ${target} byte(s).`,
        codeLineNumber: 0,
        layout: "text",
        meta: { avgBits, target, maxChunk, mask, boundaries: [], chunks: [], index: -1, hash: 0 },
    };
    step += 1;

    for (let i = 0; i < bytes.length; i += 1) {
        const byte = bytes[i] as number;
        hash = (((hash << 1) >>> 0) ^ (table[byte] as number)) >>> 0;
        const length = i - chunkStart + 1;
        const cut = length >= maxChunk || ((hash & mask) === 0 && length >= Math.min(2, target));
        if (cut) {
            boundaries.push(i + 1);
            chunkRanges.push([chunkStart, i + 1]);
            chunkStart = i + 1;
            hash = 0;
        }
        yield {
            stepNumber: step,
            entities: entities(i + 1, false),
            edges: [],
            description: cut
                ? `Byte ${i} produced a boundary: chunk ${boundaries.length} spans bytes ${chunkRanges[chunkRanges.length - 1]?.[0]}-${i}.`
                : `Byte ${i} folded into the rolling hash; no boundary yet in this ${length}-byte chunk.`,
            codeLineNumber: cut ? 5 : 3,
            layout: "text",
            meta: {
                avgBits,
                target,
                maxChunk,
                mask,
                boundaries: boundaries.slice(),
                chunks: chunkRanges.map(([s, e]) => data.slice(s, e)),
                index: i,
                hash,
            },
        };
        step += 1;
    }

    if (chunkStart < bytes.length) chunkRanges.push([chunkStart, bytes.length]);
    const chunks = chunkRanges.map(([s, e]) => data.slice(s, e));
    yield {
        stepNumber: step,
        entities: entities(bytes.length, true),
        edges: [],
        description: `Chunking complete: ${chunks.length} content-defined chunk(s) averaging ${chunks.length ? (bytes.length / chunks.length).toFixed(1) : "0"} byte(s).`,
        codeLineNumber: 7,
        layout: "text",
        meta: {
            avgBits,
            target,
            maxChunk,
            mask,
            boundaries: chunkRanges.map(([, e]) => e),
            chunks,
            index: bytes.length,
            hash,
        },
    };
}

/** The content-defined chunking module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Fixed-size chunks break deduplication as soon as a byte is inserted, because every later boundary shifts. Content-defined chunking instead hashes a rolling window and cuts when a low-bit pattern appears in the hash. Since the pattern depends only on the bytes seen since the last cut, an edit changes one or two chunks and leaves the rest aligned.",
        invariants: [
            "A boundary depends only on the bytes of the chunk that ends there.",
            "Chunks are contiguous and concatenate back to the original stream.",
            "A minimum and maximum chunk length bound the number and size of chunks.",
        ],
        correctness:
            "The gear hash is a deterministic function of the byte sequence since the last reset, so identical chunks always yield identical boundary decisions and repeated runs agree. Because boundaries are emitted at the current scan index and the next chunk starts there, the ranges are contiguous and non-overlapping and their concatenation is exactly the input. The length guards guarantee no chunk is shorter than the intended floor or longer than the configured ceiling.",
        complexityRationale:
            "Each byte costs one shift, one XOR, one table lookup, and a bit test, so the scan is O(n). The displayed characters use O(n) space; the live state is the hash, the chunk start, and the boundary list.",
        uses: [
            "Deduplication in backup and storage systems",
            "Delta synchronization that transmits only changed chunks",
            "Content-addressed storage and distributed file systems",
        ],
        references: [
            "Muthitacharoen, Chen, and Mazières, A Low-Bandwidth Network File System, 2001",
            "Rege and Agrawal, A General Framework for Content-Defined Chunking, 2016",
        ],
        workedExample:
            "With an average of eight bytes, a stream is hashed byte by byte until the low three bits of the rolling hash are zero. If that first happens at byte 9, the first chunk is bytes 0 through 8; the hash is reset and the same rule picks the next chunk, so inserting a byte in the first chunk does not move the later boundaries.",
    },
    id: "content-defined-chunking",
    name: "Content-Defined Chunking",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { data: "dedupeContentDefinedChunkingExample", avgBits: 3 },
    visualType: "text",
    run,
    pseudocode: [
        "build the deterministic gear hash table",
        "set the rolling hash and chunk start to zero",
        "for each byte of the stream",
        "update the rolling hash with the gear entry for that byte",
        "if the low bits are zero and the chunk is long enough, cut",
        "record the chunk boundary and reset the rolling hash",
        "emit any trailing bytes as the final chunk",
        "done: report the content-defined chunks",
    ],
};

export default module;
