/**
 * siphash.ts - SipHash-2-4 Keyed Hash
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SipHash is a short-key pseudorandom function designed as a fast, keyed hash
 * for hash tables and protocol nonces. It initializes four 64-bit words from
 * the key and two fixed constants, absorbs the message in little-endian
 * eight-byte blocks using two SipRounds each, and finalizes with four more
 * rounds after mixing in the length. The name SipHash-2-4 gives the two and
 * four round counts.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(message length)   Space: O(message length) for the byte array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the message bytes; the active block is highlighted.
 *   - The final frame shows the eight hash bytes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SipHashInput {
    message?: string;
    key?: number[];
}

const MASK = (1n << 64n) - 1n;

function rotl(x: bigint, n: number): bigint {
    return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK;
}

function sipRound(v: bigint[]): void {
    let [v0, v1, v2, v3] = v;
    v0 = (v0 + v1) & MASK;
    v1 = rotl(v1, 13);
    v1 ^= v0;
    v0 = rotl(v0, 32);
    v2 = (v2 + v3) & MASK;
    v3 = rotl(v3, 16);
    v3 ^= v2;
    v0 = (v0 + v3) & MASK;
    v3 = rotl(v3, 21);
    v3 ^= v0;
    v2 = (v2 + v1) & MASK;
    v1 = rotl(v1, 17);
    v1 ^= v2;
    v2 = rotl(v2, 32);
    v[0] = v0;
    v[1] = v1;
    v[2] = v2;
    v[3] = v3;
}

function keyWords(key: number[]): [bigint, bigint] {
    let k0 = 0n;
    let k1 = 0n;
    for (let i = 0; i < 8; i += 1) {
        k0 |= BigInt(key[i] ?? 0) << BigInt(8 * i);
        k1 |= BigInt(key[8 + i] ?? 0) << BigInt(8 * i);
    }
    return [k0, k1];
}

function makeBars(bytes: number[], state: EntityState): VisualEntity[] {
    return bytes.map((value, index) => ({
        id: `byte-${index}`,
        type: "bar" as const,
        label: value.toString(16).padStart(2, "0"),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function hex16(value: bigint): string {
    return (value & MASK).toString(16).padStart(16, "0");
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SipHashInput | null) ?? {};
    const message = typeof task.message === "string" ? task.message : "";
    const key = task.key ?? Array.from({ length: 16 }, (_, i) => i);
    const bytes: number[] = [];
    for (let i = 0; i < message.length; i += 1) {
        bytes.push(message.charCodeAt(i) & 0xff);
    }
    const [k0, k1] = keyWords(key);
    const v = [
        0x736f6d6570736575n ^ k0,
        0x646f72616e646f6dn ^ k1,
        0x6c7967656e657261n ^ k0,
        0x7465646279746573n ^ k1,
    ];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(bytes, "idle"),
        edges: [],
        description: `Initializing SipHash-2-4 on ${bytes.length} byte(s) with the supplied 128-bit key.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, messageLength: bytes.length, state: v.map(hex16) },
    };
    step += 1;

    let offset = 0;
    while (offset + 8 <= bytes.length) {
        let m = 0n;
        for (let j = 0; j < 8; j += 1) {
            m |= BigInt(bytes[offset + j] ?? 0) << BigInt(8 * j);
        }
        v[3] = (v[3] ^ m) & MASK;
        sipRound(v);
        sipRound(v);
        v[0] = (v[0] ^ m) & MASK;
        yield {
            stepNumber: step,
            entities: makeBars(bytes, "active"),
            edges: [],
            description: `Absorbed the 8-byte block at offset ${offset} with two SipRounds.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { step: step, offset, state: v.map(hex16) },
        };
        step += 1;
        offset += 8;
    }

    let last = BigInt(bytes.length & 0xff) << 56n;
    let shift = 0n;
    for (let j = offset; j < bytes.length; j += 1) {
        last |= BigInt(bytes[j] ?? 0) << shift;
        shift += 8n;
    }
    v[3] = (v[3] ^ last) & MASK;
    sipRound(v);
    sipRound(v);
    v[0] = (v[0] ^ last) & MASK;
    v[2] = (v[2] ^ 0xffn) & MASK;
    for (let r = 0; r < 4; r += 1) {
        sipRound(v);
    }
    const result = (v[0] ^ v[1] ^ v[2] ^ v[3]) & MASK;

    const hashBytes: number[] = [];
    for (let j = 7; j >= 0; j -= 1) {
        hashBytes.push(Number((result >> BigInt(8 * j)) & 0xffn));
    }
    const hash = hashBytes.map((value) => value.toString(16).padStart(2, "0")).join("");
    yield {
        stepNumber: step,
        entities: makeBars(hashBytes, "sorted"),
        edges: [],
        description: `SipHash-2-4 tag for the message is ${hash}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { step, hash, messageLength: bytes.length, state: v.map(hex16) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SipHash is built for hashing data structures that an adversary can influence. Four state words absorb eight-byte blocks with a few rounds of addition, rotation, and XOR, and the key is mixed in at the start so an attacker who knows the hash function still cannot predict the output.",
        invariants: [
            "The four state words begin as fixed constants XORed with the two key halves.",
            "Each full block is XORed into v3 before two rounds and into v0 after them.",
            "The final block includes the message length in its top byte.",
        ],
        correctness:
            "The generator follows the SipHash-2-4 specification, including the four SipRound steps and the final four rounds after XORing 255 into v2. The companion test checks the published vectors for the standard sequential key and cross-checks longer inputs against an independent implementation.",
        complexityRationale:
            "Each eight-byte block costs two fixed rounds and the finalization costs four more, so time is linear in message length; memory is dominated by the input byte array.",
        uses: [
            "Hash-table keys that resist hash-flooding denial of service",
            "Short message authentication tags in network protocols",
            "Randomized seeding in language runtimes",
        ],
        references: [
            "Aumasson and Bernstein, SipHash: a fast short-input PRF, 2012",
            "Aumasson and Bernstein, SipHash reference vectors",
        ],
        workedExample:
            "Using the key bytes 00 through 0f and an empty message, only the finalization block carries a top byte of zero. After two absorption rounds and four final rounds the 64-bit tag is 726fdb47dd0e0e31.",
    },
    id: "siphash",
    name: "SipHash-2-4",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        message: "abc",
        key: Array.from({ length: 16 }, (_, i) => i),
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize v0 through v3 from constants XORed with the two key words",
        "for each full eight-byte little-endian block m do",
        "v3 = v3 XOR m, then apply two SipRounds, then v0 = v0 XOR m",
        "SipRound mixes four words with additions, rotations, and XORs",
        "form the last block from remaining bytes and the length in the top byte",
        "absorb it with two rounds; set v2 = v2 XOR 255 and apply four rounds",
        "output v0 XOR v1 XOR v2 XOR v3 as the 64-bit tag",
    ],
};

export default module;
