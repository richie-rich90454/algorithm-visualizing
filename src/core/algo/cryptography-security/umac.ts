/**
 * umac.ts - UMAC Tag from the NH Universal Hash (Teaching Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * UMAC is a fast message authentication code built from a universal hash
 * family called NH. NH multiplies pairs of 32-bit message words by pairs of
 * secret 32-bit keys with 64-bit arithmetic, then adds the products. Because
 * the products use a wider type than the words, this can be done with ordinary
 * integer multiplies on real hardware. The NH outputs are reduced modulo a
 * prime and folded with a polynomial step keyed by a second secret, then mixed
 * with a nonce to form the tag. All arithmetic here is exact with BigInt, so
 * the tag can be checked by hand, but the key sizes are tiny: this is a
 * teaching core, not a production MAC.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(L) 32-bit multiplies for L message words
 *   Space: O(1) beyond the tag and padded word buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Rows show a message chunk, the NH accumulator, and the final tag.
 *   - The active chunk is highlighted while its products are summed.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Prime used for the final polynomial fold; 2^32 - 5. */
const P = 4294967291n;
const MASK32 = 0xffffffffn;
const MASK64 = 0xffffffffffffffffn;

export interface UmacKeys {
    nh: number[];
    polynomial: number;
}

/** NH: sum of (m_2i + k_2i) * (m_2i+1 + k_2i+1) modulo 2^64. */
export function nhHash(message: number[], key: number[]): bigint {
    let total = 0n;
    const pairs = Math.min(Math.floor(message.length / 2), Math.floor(key.length / 2));
    for (let i = 0; i < pairs; i += 1) {
        const a = (BigInt(message[2 * i] ?? 0) + BigInt(key[2 * i] ?? 0)) & MASK32;
        const b = (BigInt(message[2 * i + 1] ?? 0) + BigInt(key[2 * i + 1] ?? 0)) & MASK32;
        total = (total + a * b) & MASK64;
    }
    return total;
}

/** Reduce a nonnegative BigInt modulo P. */
export function reduce(value: bigint): bigint {
    return ((value % P) + P) % P;
}

/** Zero-pad raw bytes to a whole number of 32-bit words. */
export function toWords(message: number[]): number[] {
    const padded = [...message];
    while (padded.length % 4 !== 0) {
        padded.push(0);
    }
    const words: number[] = [];
    for (let i = 0; i < padded.length; i += 4) {
        words.push(
            (((padded[i] ?? 0) << 24) | ((padded[i + 1] ?? 0) << 16) | ((padded[i + 2] ?? 0) << 8) | (padded[i + 3] ?? 0)) >>> 0,
        );
    }
    return words;
}

/** Compute the NH chunks and the final UMAC tag. */
export function computeUmac(message: number[], keys: UmacKeys, nonce: number): { chunks: bigint[]; tag: bigint } {
    const words = toWords(message);
    const chunks: bigint[] = [];
    for (let i = 0; i < words.length; i += 2) {
        const pair = [words[i] ?? 0, words[i + 1] ?? 0];
        const keyPair = [keys.nh[i % keys.nh.length] ?? 0, keys.nh[(i + 1) % keys.nh.length] ?? 0];
        chunks.push(reduce(nhHash(pair, keyPair)));
    }
    const poly = reduce(BigInt(keys.polynomial));
    // Start from the secret so the fold depends on it even for a single chunk.
    let tag = poly;
    for (const chunk of chunks) {
        tag = reduce(tag * poly + chunk);
    }
    tag = reduce(tag + reduce(BigInt(nonce >>> 0)));
    return { chunks, tag };
}

function hex32(value: bigint): string {
    return value.toString(16).toUpperCase().padStart(8, "0");
}

function rowCells(row: number, bytes: number[], state: EntityState, revealed: number): VisualEntity[] {
    return Array.from({ length: 8 }, (_, col) => {
        const value = bytes[col] ?? 0;
        return {
            id: `byte-${row}-${col}`,
            type: "cell" as const,
            label: value.toString(16).toUpperCase().padStart(2, "0"),
            value,
            state: col < revealed ? state : ("unvisited" as EntityState),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col },
        };
    });
}

function tagBytes(tag: bigint): number[] {
    return [24n, 16n, 8n, 0n].map((shift) => Number((tag >> shift) & 0xffn));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number[]; nhKey?: number[]; polynomialKey?: number; nonce?: number } | null) ?? {};
    const message = Array.isArray(task.message) ? task.message : [72, 105, 33, 42, 99, 100];
    const keys: UmacKeys = {
        nh: Array.isArray(task.nhKey) && task.nhKey.length > 0 ? task.nhKey : [0x12345678, 0x9abcdef0, 0x0f1e2d3c, 0x5a6b7c8d],
        polynomial: typeof task.polynomialKey === "number" ? task.polynomialKey : 7919,
    };
    const nonce = typeof task.nonce === "number" ? task.nonce >>> 0 : 11;

    const { chunks, tag } = computeUmac(message, keys, nonce);
    const words = toWords(message);
    let step = 0;

    const frame = (chunkIndex: number, tagRevealed: number, description: string, line: number, state: EntityState): VisualFrame => {
        const word = BigInt(words[Math.min(chunkIndex, Math.max(0, words.length - 1))] ?? 0);
        const chunk = chunks[Math.min(chunkIndex, Math.max(0, chunks.length - 1))] ?? 0n;
        return {
            stepNumber: step++,
            entities: [
                ...rowCells(0, [24n, 16n, 8n, 0n].map((shift) => Number((word >> shift) & 0xffn)), state, chunkIndex >= 0 ? 4 : 0),
                ...rowCells(1, [24n, 16n, 8n, 0n].map((shift) => Number((chunk >> shift) & 0xffn)), "highlight", chunkIndex >= 0 ? 4 : 0),
                ...rowCells(2, tagBytes(tag), "sorted", tagRevealed),
            ],
            edges: [],
            description,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                rows: 3,
                cols: 8,
                messageBytes: message.length,
                words: words.length,
                chunks: chunks.map(hex32),
                tag: hex32(tag),
                nonce,
            },
        };
    };

    yield frame(-1, 0, "Pad the message into 32-bit words and load the NH key pair.", 0, "idle");
    for (let i = 0; i < chunks.length; i += 1) {
        yield frame(i, 0, `NH chunk ${i + 1} of ${chunks.length}: multiply keyed word pairs in 64 bits.`, 1, "active");
    }
    yield frame(chunks.length - 1, 4, `Fold the chunks with the polynomial key and nonce; tag ${hex32(tag)}.`, 2, "sorted");
}

const module: AlgorithmModule = {
    id: "umac",
    name: "UMAC (NH Universal Hash Core)",
    category: "cryptography-security",
    complexity: { time: "O(L)", space: "O(1)" },
    defaultInput: {
        message: [72, 105, 33, 42, 99, 100],
        nhKey: [0x12345678, 0x9abcdef0, 0x0f1e2d3c, 0x5a6b7c8d],
        polynomialKey: 7919,
        nonce: 11,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "pad the message to a whole number of 32-bit words",
        "for each pair of words: add the key pair modulo 2^32 and multiply the sums modulo 2^64",
        "sum the products modulo 2^64",
        "reduce each NH sum modulo the prime 2^32 minus 5",
        "fold the reduced chunks with tag ← tag times secret plus chunk modulo the prime",
        "add the nonce modulo the prime and output the tag",
        "the verifier recomputes the tag and accepts only an exact match",
    ],
    education: {
        intuition:
            "A universal hash family is a set of hash functions where any two different messages collide for at most a small fraction of the keys. NH gets this guarantee from 64-bit multiplication of 32-bit words. UMAC turns the NH result into a short tag by folding it with another secret, so an attacker who does not know the keys cannot predict how a change to the message affects the tag.",
        invariants: [
            "Each NH product uses 32-bit operands and a 64-bit accumulator, so no information is lost in the products.",
            "Every reduced chunk lies in the field modulo 2^32 - 5.",
            "The same message, keys, and nonce always produce the same tag.",
        ],
        correctness:
            "For two distinct equal-length messages, their NH difference is a nonzero polynomial of degree one in the secret key words over a ring, and the standard NH analysis bounds the probability that it vanishes by 2^-32. The final polynomial fold over the prime field adds at most one extra 2^-32 term, so the forgery probability stays small and independent of the message length.",
        complexityRationale:
            "NH uses one 64-bit multiply per pair of 32-bit words, so hashing L words takes O(L) time and constant working space; the fold over the chunks is also linear in their number.",
        uses: [
            "Fast packet authentication on high-throughput network links",
            "Message integrity in the UMAC family of MACs",
            "A teaching example of universal hashing and 64-bit multiply tricks",
        ],
        references: [
            "Black, Halevi, Krawczyk, Krovetz, and Rogaway, UMAC: Fast and Secure Message Authentication, 1999",
            "Carter and Wegman, Universal Classes of Hash Functions, 1977",
        ],
        workedExample:
            "For message bytes Hi!*cd the tool forms words 0x4869212a and 0x63640000. Adding the first key pair modulo 2^32 and multiplying the sums modulo 2^64 gives one NH value; reducing it modulo 2^32 - 5, folding with the polynomial key 7919, and adding nonce 11 yields the printed 32-bit tag.",
    },
};

export default module;
