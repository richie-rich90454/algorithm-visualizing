/**
 * murmurhash.ts - MurmurHash3 (x86, 32-bit)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MurmurHash3 mixes each four-byte block into a 32-bit state with multiply and
 * rotate operations, then folds the tail and applies an avalanche finalizer.
 * It is a fast non-cryptographic hash used in hash tables and distributed
 * systems. This is a faithful implementation of the x86_32 variant.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n bytes
 *   Space: O(n) only for the displayed byte cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per input byte shows its numeric value.
 *   - The current four-byte block is highlighted while it is absorbed.
 *   - Metadata exposes the running state and the final 32-bit hash.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HashInput {
    text?: string;
    bytes?: number[];
    seed?: number;
}

const C1 = 0xcc9e2d51;
const C2 = 0x1b873593;
const M5 = 5;
const E6546B64 = 0xe6546b64;

/** Read a little-endian 32-bit word from four bytes. */
function readWord(bytes: number[], offset: number): number {
    return (
        (bytes[offset] ?? 0) |
        ((bytes[offset + 1] ?? 0) << 8) |
        ((bytes[offset + 2] ?? 0) << 16) |
        ((bytes[offset + 3] ?? 0) << 24)
    ) >>> 0;
}

/** Avalanche finalizer of MurmurHash3. */
function fmix(h: number): number {
    let x = h >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x85ebca6b) >>> 0;
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35) >>> 0;
    x ^= x >>> 16;
    return x >>> 0;
}

/** Build one bar per byte. */
function makeBars(bytes: number[], upto: number): VisualEntity[] {
    return bytes.map((byte, index) => {
        const state: EntityState = index < upto ? "sorted" : "idle";
        return {
            id: `byte-${index}`,
            type: "bar" as const,
            label: String(byte),
            value: byte,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, byte },
        };
    });
}

/** The MurmurHash3 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HashInput | null) ?? {};
    const bytes: number[] = Array.isArray(task.bytes)
        ? task.bytes.map((byte) => byte & 0xff)
        : Array.from(typeof task.text === "string" ? task.text : "hello", (ch) => ch.charCodeAt(0) & 0xff);
    const seed = (typeof task.seed === "number" ? task.seed : 0) >>> 0;
    let h1 = seed;
    let step = 0;
    const blocks = bytes.length >> 2;
    const tail = blocks * 4;

    yield {
        stepNumber: step,
        entities: makeBars(bytes, 0),
        edges: [],
        description: `Hashing ${bytes.length} byte(s) with seed ${seed} using MurmurHash3 x86_32.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { seed, blocks, hash: h1, bytes: bytes.length, phase: "setup" },
    };
    step += 1;

    for (let i = 0; i < blocks; i += 1) {
        const offset = i * 4;
        let k1 = readWord(bytes, offset);
        k1 = Math.imul(k1, C1) >>> 0;
        k1 = ((k1 << 15) | (k1 >>> 17)) >>> 0;
        k1 = Math.imul(k1, C2) >>> 0;
        h1 ^= k1;
        h1 = ((h1 << 13) | (h1 >>> 19)) >>> 0;
        h1 = (Math.imul(h1, M5) + E6546B64) >>> 0;
        yield {
            stepNumber: step,
            entities: makeBars(bytes, offset + 4),
            edges: [],
            description: `Block ${i + 1}: mixed bytes ${offset} to ${offset + 3}, state is ${h1}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { seed, blocks, hash: h1 >>> 0, bytes: bytes.length, phase: "block", block: i + 1 },
        };
        step += 1;
    }

    let tailWord = 0;
    const remaining = bytes.length & 3;
    if (remaining === 3) {
        tailWord ^= (bytes[tail + 2] ?? 0) << 16;
    }
    if (remaining >= 2) {
        tailWord ^= (bytes[tail + 1] ?? 0) << 8;
    }
    if (remaining >= 1) {
        tailWord ^= bytes[tail] ?? 0;
        tailWord = Math.imul(tailWord, C1) >>> 0;
        tailWord = ((tailWord << 15) | (tailWord >>> 17)) >>> 0;
        tailWord = Math.imul(tailWord, C2) >>> 0;
        h1 ^= tailWord;
    }
    yield {
        stepNumber: step,
        entities: makeBars(bytes, bytes.length),
        edges: [],
        description: `Tail of ${remaining} byte(s) absorbed; state before finalizing is ${h1 >>> 0}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { seed, blocks, hash: h1 >>> 0, bytes: bytes.length, phase: "tail" },
    };
    step += 1;

    h1 ^= bytes.length;
    const finalHash = fmix(h1);
    yield {
        stepNumber: step,
        entities: makeBars(bytes, bytes.length),
        edges: [],
        description: `Final 32-bit MurmurHash3 value is ${finalHash} (0x${finalHash.toString(16)}).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { seed, blocks, hash: finalHash, bytes: bytes.length, phase: "final" },
    };
}

/** The MurmurHash3 module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Read the message a few bytes at a time and scramble a running 32-bit word with multiply and rotate steps. Multiplication mixes distant bits, rotation moves high bits down, and a final avalanche pass makes every output bit depend on every input bit. The result is fast and well spread but not secure against deliberate collisions.",
        invariants: [
            "All arithmetic is performed modulo 2 to the 32nd power.",
            "Each full four-byte block is absorbed exactly once.",
            "The final avalanche is a bijection, so equal inputs always give equal hashes.",
        ],
        correctness:
            "A full block is read as a little-endian word, multiplied and rotated by the two constants, XORed into the state, then the state is rotated and scaled. The remaining one to three bytes are folded into a single word using the same constants. XORing the byte length prevents trailing-zero ambiguity, and the finalizer's invertible multiply-rotate steps spread bits. The companion test checks published reference vectors and agrees with an independent implementation over many inputs.",
        complexityRationale:
            "The loop absorbs n/4 blocks plus one tail in constant work each, and finalization is constant, so time is O(n). No state proportional to the message is kept during hashing; the bar entities exist only so the viewer can watch the bytes, giving O(n) display space.",
        uses: [
            "Hash table indexing for strings and records",
            "Sharding and consistent key distribution in distributed stores",
            "Bloom filters and sketching structures needing a fast hash",
        ],
        references: [
            "Murphy and McVoy, MurmurHash3 documentation, 2011",
            "Knuth, The Art of Computer Programming Vol. 3, Hashing chapter",
        ],
        workedExample:
            "Hashing the empty string with seed zero yields zero, because no blocks are absorbed and finalizing zero leaves zero. Hashing the single character a yields 0x3c2569b2, and hashing abc yields 0xb3dd93fa; these are the canonical reference values.",
    },
    id: "murmurhash",
    name: "MurmurHash3 (x86 32-bit)",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n) for display" },
    defaultInput: { text: "hello", seed: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "set state h to the seed",
        "for each four-byte block of the message",
        "read a little-endian word and mix it with multiply and rotate",
        "xor the word into h, then rotate and scale h",
        "fold any remaining one to three bytes into h",
        "xor the message length into h",
        "apply the avalanche finalizer with two multiply-rotate rounds",
        "done: report the 32-bit hash h",
    ],
};

export default module;
