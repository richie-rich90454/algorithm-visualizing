/**
 * md5.ts - MD5 Message Digest (Historical Algorithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MD5 pads the message, splits it into 512-bit blocks, and processes each
 * block in four rounds of 16 steps. Each step mixes one 32-bit state word with
 * a nonlinear function, a sine-derived constant, and one message word, then
 * rotates the result. The four final state words form a 128-bit digest.
 *
 * MD5 is broken as a collision-resistant hash and is shown here only as a
 * historical teaching example. It must not be used for security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(message length)   Space: O(message length) for the padded blocks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the padded message bytes; the active round is highlighted.
 *   - The final frame shows the 16 digest bytes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Md5Input {
    message?: string;
}

const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];

const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];

function rotl(x: number, n: number): number {
    return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function pad(message: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < message.length; i += 1) {
        bytes.push(message.charCodeAt(i) & 0xff);
    }
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) {
        bytes.push(0);
    }
    for (let b = 0; b < 8; b += 1) {
        bytes.push(Math.floor(bitLength / Math.pow(2, 8 * b)) & 0xff);
    }
    return bytes;
}

function words(bytes: number[], offset: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < 16; i += 1) {
        let value = 0;
        for (let j = 0; j < 4; j += 1) {
            value += (bytes[offset + i * 4 + j] ?? 0) * Math.pow(2, 8 * j);
        }
        result.push(value >>> 0);
    }
    return result;
}

function roundFunction(round: number, b: number, c: number, d: number): number {
    if (round === 0) return (b & c) | (~b & d);
    if (round === 1) return (d & b) | (~d & c);
    if (round === 2) return b ^ c ^ d;
    return c ^ (b | ~d);
}

function gIndex(round: number, i: number): number {
    if (round === 0) return i;
    if (round === 1) return (5 * i + 1) % 16;
    if (round === 2) return (3 * i + 5) % 16;
    return (7 * i) % 16;
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

function hex8(value: number): string {
    return (value >>> 0).toString(16).padStart(8, "0");
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Md5Input | null) ?? {};
    const message = typeof task.message === "string" ? task.message : "abc";
    const padded = pad(message);
    let a = 0x67452301;
    let b = 0xefcdab89;
    let c = 0x98badcfe;
    let d = 0x10325476;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(padded, "idle"),
        edges: [],
        description: `Padding "${message}" into ${padded.length / 64} MD5 block(s) of 512 bits.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, message, blocks: padded.length / 64 },
    };
    step += 1;

    for (let block = 0; block < padded.length / 64; block += 1) {
        const m = words(padded, block * 64);
        let a0 = a;
        let b0 = b;
        let c0 = c;
        let d0 = d;
        for (let round = 0; round < 4; round += 1) {
            for (let i = round * 16; i < (round + 1) * 16; i += 1) {
                const f = roundFunction(round, b, c, d);
                const sum = (a + f + K[i] + (m[gIndex(round, i - round * 16)] ?? 0)) >>> 0;
                a = d;
                d = c;
                c = b;
                b = (b + rotl(sum, S[i] ?? 0)) >>> 0;
            }
            yield {
                stepNumber: step,
                entities: makeBars(padded, "active"),
                edges: [],
                description: `Block ${block + 1}, round ${round + 1}: mixed 16 steps and updated a, b, c, d.`,
                codeLineNumber: 1 + round,
                layout: "array",
                meta: {
                    step: step,
                    block: block + 1,
                    round: round + 1,
                    state: [hex8(a), hex8(b), hex8(c), hex8(d)],
                },
            };
            step += 1;
        }
        a = (a + a0) >>> 0;
        b = (b + b0) >>> 0;
        c = (c + c0) >>> 0;
        d = (d + d0) >>> 0;
    }

    const digestWords = [a, b, c, d];
    const digestBytes: number[] = [];
    for (const word of digestWords) {
        for (let j = 0; j < 4; j += 1) {
            digestBytes.push((word >>> (8 * j)) & 0xff);
        }
    }
    const digest = digestBytes.map((value) => value.toString(16).padStart(2, "0")).join("");
    yield {
        stepNumber: step,
        entities: makeBars(digestBytes, "sorted"),
        edges: [],
        description: `MD5 digest of "${message}" is ${digest}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { step, digest, message, state: [hex8(a), hex8(b), hex8(c), hex8(d)] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "MD5 runs a small nonlinear mixer over 512-bit blocks, feeding each message word into a rotating 128-bit state. Four different boolean functions are used across four rounds so that every state bit eventually depends on every message bit.",
        invariants: [
            "All arithmetic is on 32-bit words modulo two to the 32.",
            "Each block starts from the current state and adds it back after 64 steps.",
            "Padding ends with a little-endian 64-bit message length.",
        ],
        correctness:
            "The implementation follows the RFC 1321 step schedule exactly, including the per-round message-word orders, the 64 sine constants, and the rotation counts. The companion test checks the published digests for the empty string, abc, and several standard phrases.",
        complexityRationale:
            "Each 64-byte block needs 64 fixed steps, so time is linear in the padded message length; the padded byte array is the only growing structure, giving linear space.",
        uses: [
            "Historical file-integrity checksums, now superseded",
            "A teaching example of the Merkle-Damgard construction",
            "Understanding why collision-resistant hashes need larger state",
        ],
        references: [
            "Rivest, RFC 1321: The MD5 Message-Digest Algorithm, 1992",
            "Wang et al., Collisions for Hash Functions MD4, MD5, HAVAL-128, 2004",
        ],
        workedExample:
            "For the empty message the padding is a single 0x80 byte, zeroes up to byte 56, and an eight-byte zero length. Processing that one block gives the digest d41d8cd98f00b204e9800998ecf8427e.",
    },
    id: "md5",
    name: "MD5 Hash",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { message: "abc" },
    visualType: "array",
    run,
    pseudocode: [
        "pad the message with one, zeroes, and a 64-bit little-endian length",
        "initialize a, b, c, d to the four standard constants",
        "for each 512-bit block read sixteen little-endian words",
        "for round 0 to 3 and step 0 to 15 do",
        "mix a with a nonlinear function of b, c, d, a constant, and a message word",
        "rotate the sum left by the scheduled amount and swap the state words",
        "after 64 steps add the original state words back",
        "emit the four state words as a 128-bit digest",
    ],
};

export default module;
