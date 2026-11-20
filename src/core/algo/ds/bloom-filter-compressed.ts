/**
 * bloom-filter-compressed.ts - Bloom filter with a run-length compressed bitmap.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A compressed bloom filter keeps the usual set of hash-derived bits but stores
 * the bit vector in a compact form. Here the bit vector is run-length encoded:
 * each maximal run of equal bits becomes a (value, length) pair. Lookups decode
 * the runs back to the bit vector and then test the k hash positions exactly as
 * an ordinary bloom filter does, so membership semantics are unchanged, while
 * the encoded form can occupy far fewer symbols when bits cluster.
 *
 * This is distinct from the blocked bloom filter module, which partitions bits
 * into cache lines for speed without changing the number of stored bits, and
 * from counting or spectral filters, which store multiplicities.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) to compress or decode m bits; O(k) per membership query
 *   Space: O(r) encoded symbols for r runs, at most O(m) in the worst case
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The bit vector is drawn as grid cells; touched positions flash COMPARING.
 *   - meta.encoding holds the run-length pairs and meta.bits the raw bits, so a
 *     round-trip check is possible from the frames alone.
 *   - Captions report the compression ratio and each query result.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const M = 16;

function positions(key: number): number[] {
    return [(((key * 31 + 7) % M) + M) % M, (((key * 131 + 17) % M) + M) % M];
}

/** Run-length encode a bit vector as [value, length, value, length, ...]. */
function compress(bits: number[]): number[] {
    const encoding: number[] = [];
    let i = 0;
    while (i < bits.length) {
        const value = bits[i] ?? 0;
        let length = 0;
        while (i < bits.length && bits[i] === value) {
            length += 1;
            i += 1;
        }
        encoding.push(value, length);
    }
    return encoding;
}

/** Rebuild m bits from a run-length encoding. */
function decompress(encoding: number[], m: number): number[] {
    const bits: number[] = [];
    for (let j = 0; j + 1 < encoding.length; j += 2) {
        const value = encoding[j] ?? 0;
        const length = encoding[j + 1] ?? 0;
        for (let t = 0; t < length; t += 1) bits.push(value);
    }
    return bits.slice(0, m);
}

function cells(bits: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return bits.map((bit, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(bit),
        value: bit,
        state: states.get(index) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

interface CompressedBloomInput {
    keys?: number[];
    queries?: number[];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CompressedBloomInput | null) ?? {};
    const keys = Array.isArray(task.keys) ? task.keys.slice(0, 12) : [5, 17, 9];
    const queries = Array.isArray(task.queries) ? task.queries.slice(0, 12) : [5, 17, 42];

    const bits = new Array<number>(M).fill(0);
    let step = 0;
    const frame = (description: string, line: number, states: Map<number, EntityState>, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step,
        entities: cells(bits, states),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { bits: [...bits], encoding: compress(bits), ...meta },
    });

    yield frame(
        "Compressed Bloom Filter: empty bitmap; runs are stored as value/length pairs.",
        0,
        new Map(),
        { operations: 0, runs: 1 },
    );
    step += 1;

    for (const key of keys) {
        const pos = positions(key);
        for (const j of pos) bits[j] = 1;
        const runs = compress(bits).length / 2;
        yield frame(
            `Add ${key}: set positions ${pos.join(", ")}; bitmap now has ${runs} run(s).`,
            1,
            new Map(pos.map((j) => [j, "comparing" as EntityState])),
            { operations: step, added: key, runs },
        );
        step += 1;
    }

    for (const key of queries) {
        const pos = positions(key);
        const decoded = decompress(compress(bits), M);
        const present = pos.every((j) => decoded[j] === 1);
        yield frame(
            `Query ${key}: decode runs, check ${pos.join(", ")} -> ${present ? "possibly present" : "definitely absent"}.`,
            2,
            new Map(pos.map((j) => [j, present ? "sorted" : "error" as EntityState])),
            { operations: step, queried: key, present },
        );
        step += 1;
    }

    const encoding = compress(bits);
    yield frame(
        `Done: ${M} bits stored in ${encoding.length / 2} run(s), ${encoding.length} encoded numbers.`,
        3,
        new Map(),
        { operations: step, runs: encoding.length / 2, encodedLength: encoding.length },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A bitmap of zeros and ones often contains long stretches of the same value. Run-length encoding writes each stretch once as a value plus a length, so sixteen bits with only a few transitions can be stored in a handful of numbers. A compressed bloom filter keeps the normal hash-to-bit mapping but saves the vector in this compact form and decodes it before answering a query.",
        invariants: [
            "The encoded runs always decode back to exactly the original bit vector.",
            "Every position a key hashes to is set after that key is inserted.",
            "A query returns true only when all k decoded positions are set, so there are no false negatives.",
            "The number of runs is between one and the number of bits.",
        ],
        correctness:
            "Run-length encoding scans the bits once and emits one pair per maximal run; decoding expands each pair in order, so the two operations are inverses and the round trip reproduces every bit. Insertion sets the same hash positions as an ordinary bloom filter, and a query decodes before testing those positions, so an inserted key always finds all its bits set and can never be reported absent. Non-inserted keys may collide on all positions and give false positives, exactly as in an uncompressed bloom filter.",
        complexityRationale:
            "Encoding and decoding each touch every bit once, so those steps are O(m) for m bits, and a query touches only the k hash positions after decoding. Encoded space is O(r) numbers for r runs, which is O(1) for clustered bits and at most O(m) when bits alternate.",
        uses: [
            "Compact membership indexes stored on disk or sent over a network",
            "Sparse permission or feature bitmaps where zeros dominate",
            "Read-mostly filters where decode cost is amortized over many queries",
        ],
        references:
            [
                "Mitzenmacher, Compressed Bloom Filters, IEEE/ACM Transactions on Networking 10 (2002)",
                "Bloom, Space/Time Trade-offs in Hash Coding with Allowable Errors, 1970",
            ],
        workedExample:
            "With 16 bits and hashes key*31+7 and key*131+17, inserting key 5 sets positions 2 and 10. The bitmap [0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0] run-length encodes as 0x2, 1x1, 0x7, 1x1, 0x5, six numbers instead of sixteen bits' worth of separate cells; decoding restores the same vector so querying 5 returns present.",
    },
    id: "bloom-filter-compressed",
    name: "Compressed Bloom Filter",
    category: "data-structures",
    complexity: { time: "O(m) compress, O(k) query", space: "O(r)" },
    defaultInput: { keys: [5, 17, 9], queries: [5, 17, 42] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize m bits to zero",
        "compress: emit (value, length) for each maximal run of equal bits",
        "decode: expand each pair back into a stretch of bits",
        "to add key: set each of its k hashed bits",
        "to query: decode the runs, then test all k hashed bits",
        "report absent when any tested bit is zero; else possibly present",
        "done: round-trip decoding restores the exact original bitmap",
    ],
};

export default module;
