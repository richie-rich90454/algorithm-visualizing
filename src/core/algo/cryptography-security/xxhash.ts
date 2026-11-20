/**
 * xxhash.ts - XXH32 Non-Cryptographic Hash (Full 32-bit Algorithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * XXH32 is a fast, non-cryptographic checksum. It mixes a message through four
 * accumulators while at least sixteen bytes remain, folds them into one
 * accumulator, consumes the remaining words and bytes, and finishes with an
 * avalanche step. The arithmetic is exact 32-bit unsigned arithmetic, so the
 * implementation reproduces the published test vector for the empty string
 * (0x02cc5d05). It is a checksum, not a message-authentication code.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n) over the message length
 *   Space: O(1) working words
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Four bars show the active accumulators after each mixing step.
 *   - meta carries the running digest in hexadecimal for verification.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P1 = 2654435761;
const P2 = 2246822519;
const P3 = 3266489917;
const P4 = 668265263;
const P5 = 374761393;

const rotl = (x: number, n: number): number => ((x << n) | (x >>> (32 - n))) >>> 0;

/** One XXH32 accumulation round. */
function round(acc: number, input: number): number {
    return (Math.imul(rotl((acc + Math.imul(input, P2)) >>> 0, 13), P1)) >>> 0;
}

/** Read a little-endian 32-bit word. */
function read32(bytes: number[], i: number): number {
    return ((bytes[i] ?? 0) | ((bytes[i + 1] ?? 0) << 8) | ((bytes[i + 2] ?? 0) << 16) | ((bytes[i + 3] ?? 0) << 24)) >>> 0;
}

const utf8 = (text: string): number[] => Array.from(new TextEncoder().encode(text));
const hex8 = (x: number): string => (x >>> 0).toString(16).padStart(8, "0");

/** Four bars representing the current accumulator words. */
function makeBars(words: number[], active: number): VisualEntity[] {
    return words.map((value, index) => ({
        id: `word-${index}`,
        type: "bar" as const,
        label: hex8(value),
        value: value >>> 0,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, hex: hex8(value) },
    }));
}

/** The full XXH32 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: string; seed?: number } | null) ?? {};
    const message = String(task.message ?? "abc");
    const bytes = utf8(message);
    const seed = typeof task.seed === "number" ? task.seed >>> 0 : 0;
    const n = bytes.length;
    let step = 0;
    let digest = 0;

    yield {
        stepNumber: step,
        entities: makeBars([seed, P1, P2, P3], 0),
        edges: [],
        description: `XXH32 on ${n} byte(s) with seed ${seed}: constants P1..P5 and the message are ready.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { message, seed, length: n, digest: "" },
    };
    step += 1;

    let h: number;
    let i = 0;
    if (n >= 16) {
        let v1 = (seed + P1 + P2) >>> 0;
        let v2 = (seed + P2) >>> 0;
        let v3 = seed >>> 0;
        let v4 = (seed - P1) >>> 0;
        yield {
            stepNumber: step,
            entities: makeBars([v1, v2, v3, v4], 0),
            edges: [],
            description: "Seed four accumulators for the sixteen-byte main loop.",
            codeLineNumber: 1,
            layout: "array",
            meta: { message, seed, length: n, digest: "" },
        };
        step += 1;
        while (i + 16 <= n) {
            v1 = round(v1, read32(bytes, i));
            v2 = round(v2, read32(bytes, i + 4));
            v3 = round(v3, read32(bytes, i + 8));
            v4 = round(v4, read32(bytes, i + 12));
            i += 16;
            yield {
                stepNumber: step,
                entities: makeBars([v1, v2, v3, v4], 3),
                edges: [],
                description: `Main loop at byte ${i - 16}: each accumulator absorbs one little-endian word.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { message, seed, length: n, offset: i - 16, digest: "" },
            };
            step += 1;
        }
        h = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) >>> 0;
        yield {
            stepNumber: step,
            entities: makeBars([v1, v2, v3, v4], 0),
            edges: [],
            description: "Fold the four accumulators into one with fixed rotations.",
            codeLineNumber: 3,
            layout: "array",
            meta: { message, seed, length: n, digest: hex8(h) },
        };
        step += 1;
    } else {
        h = (seed + P5) >>> 0;
        yield {
            stepNumber: step,
            entities: makeBars([h, P5, 0, 0], 0),
            edges: [],
            description: "Short message: start from seed plus the prime P5.",
            codeLineNumber: 4,
            layout: "array",
            meta: { message, seed, length: n, digest: hex8(h) },
        };
        step += 1;
    }

    h = (h + n) >>> 0;
    while (i + 4 <= n) {
        h = Math.imul(rotl((h + Math.imul(read32(bytes, i), P3)) >>> 0, 17), P4) >>> 0;
        i += 4;
        yield {
            stepNumber: step,
            entities: makeBars([h, P3, P4, 0], 0),
            edges: [],
            description: `Consume a remaining four-byte word at byte ${i - 4}.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { message, seed, length: n, offset: i - 4, digest: hex8(h) },
        };
        step += 1;
    }
    while (i < n) {
        h = Math.imul(rotl((h + Math.imul(bytes[i] ?? 0, P5)) >>> 0, 11), P1) >>> 0;
        i += 1;
        yield {
            stepNumber: step,
            entities: makeBars([h, P5, P1, 0], 0),
            edges: [],
            description: `Consume a remaining single byte at index ${i - 1}.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { message, seed, length: n, offset: i - 1, digest: hex8(h) },
        };
        step += 1;
    }

    h ^= h >>> 15;
    h = Math.imul(h, P2) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, P3) >>> 0;
    h ^= h >>> 16;
    digest = h >>> 0;
    yield {
        stepNumber: step,
        entities: makeBars([digest, h ^ (h >>> 15), P2, P3], 0),
        edges: [],
        description: `XXH32 avalanche complete: digest ${hex8(digest)} (a checksum, not a MAC).`,
        codeLineNumber: 7,
        layout: "array",
        meta: { message, seed, length: n, digest: hex8(digest) },
    };
}

/** The XXH32 module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "XXH32 trades cryptographic strength for speed. It keeps four independent accumulators so a modern processor can mix several words in parallel, then folds them together and consumes the leftover bytes. A final avalanche multiplication spreads each input bit across the whole output, which makes accidental collisions rare even though a determined attacker could still craft one.",
        invariants: [
            "All arithmetic is 32-bit unsigned; multiplication uses Math.imul to stay exact.",
            "Each main-loop round rotates (accumulator plus input times P2) by 13, then multiplies by P1.",
            "The tail consumes at most three four-byte words and at most three single bytes.",
        ],
        correctness:
            "The accumulator rounds, word reads, and avalanche constants match the published XXH32 definition. The empty-string digest with seed zero is 0x02cc5d05, and an independent reference that follows the same four phases reproduces every digest in the tests. This verifies the checksum algorithm only; XXH32 is not collision resistant and must not be used for authentication.",
        complexityRationale:
            "The main loop processes four words per sixteen bytes and the tail processes the rest once, so hashing is linear in the message length. Only a fixed number of registers and the five constants are stored, giving constant space.",
        uses: [
            "Fast checksums in file systems and databases",
            "Hash-table keys and content deduplication",
            "Non-adversarial integrity checks where speed matters more than security",
        ],
        references: [
            "Collet, XXHASH - Fast Non-Cryptographic Hash Algorithm, 2012",
            "Collet, xxHash specification (XXH32 reference implementation), 2024",
        ],
        workedExample:
            "For the empty string the main loop is skipped, so the accumulator starts at seed plus P5, adds length zero, consumes no tail words, and avalanches to 0x02cc5d05. For abc the three bytes are consumed one at a time with P5 and P1 before the same avalanche step.",
    },
    id: "xxhash",
    name: "XXH32 Hash",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { message: "abc", seed: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "set up the five 32-bit primes and the message bytes",
        "seed four accumulators when at least sixteen bytes remain",
        "for each sixteen-byte block rotate and mix all four accumulators",
        "fold the four accumulators into a single hash with rotations",
        "otherwise start from seed plus P5 for a short message",
        "add the message length to the hash",
        "consume each remaining four-byte word then each remaining byte",
        "avalanche with three xor-shift and multiply passes",
        "done: report the XXH32 checksum in hexadecimal",
    ],
};

export default module;
