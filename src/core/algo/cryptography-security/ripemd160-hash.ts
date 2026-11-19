/**
 * ripemd160-hash.ts - RIPEMD-160 Message Digest
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RIPEMD-160 processes 512-bit blocks with two parallel lines of five rounds
 * each. The lines use mirrored boolean functions, different message-word
 * orders, and different rotation schedules; their results are combined after
 * every block into a 160-bit state. The twin lines are what give RIPEMD-160
 * its resistance to the attacks that broke MD4 and MD5.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(message length)   Space: O(message length) for padded bytes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show padded message bytes with the active round highlighted.
 *   - The final frame shows the twenty digest bytes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RipemdInput {
    message?: string;
}

const R = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
    3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
    1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
    4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13,
];

const Rp = [
    5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
    6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
    15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
    8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
    12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11,
];

const S = [
    11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
    7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
    11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
    11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
    9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6,
];

const Sp = [
    8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
    9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
    9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
    15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
    8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11,
];

const K = [0, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
const Kp = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0];

function rotl(x: number, n: number): number {
    return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function fLeft(round: number, x: number, y: number, z: number): number {
    if (round === 0) return x ^ y ^ z;
    if (round === 1) return (x & y) | (~x & z);
    if (round === 2) return (x | ~y) ^ z;
    if (round === 3) return (x & z) | (y & ~z);
    return x ^ (y | ~z);
}

function fRight(round: number, x: number, y: number, z: number): number {
    if (round === 0) return x ^ (y | ~z);
    if (round === 1) return (x & z) | (y & ~z);
    if (round === 2) return (x | ~y) ^ z;
    if (round === 3) return (x & y) | (~x & z);
    return x ^ y ^ z;
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

function hex8(value: number): string {
    return (value >>> 0).toString(16).padStart(8, "0");
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RipemdInput | null) ?? {};
    const message = typeof task.message === "string" ? task.message : "abc";
    const padded = pad(message);
    const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(padded, "idle"),
        edges: [],
        description: `Padding "${message}" into ${padded.length / 64} RIPEMD-160 block(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, message, blocks: padded.length / 64 },
    };
    step += 1;

    for (let block = 0; block < padded.length / 64; block += 1) {
        const x = words(padded, block * 64);
        let [al, bl, cl, dl, el] = h;
        let [ar, br, cr, dr, er] = h;
        for (let round = 0; round < 5; round += 1) {
            for (let j = 0; j < 16; j += 1) {
                const i = round * 16 + j;
                const tl = (rotl((al + fLeft(round, bl, cl, dl) + (x[R[i] ?? 0] ?? 0) + K[round]) >>> 0, S[i] ?? 0) + el) >>> 0;
                al = el;
                el = dl;
                dl = rotl(cl, 10);
                cl = bl;
                bl = tl;
                const tr = (rotl((ar + fRight(round, br, cr, dr) + (x[Rp[i] ?? 0] ?? 0) + Kp[round]) >>> 0, Sp[i] ?? 0) + er) >>> 0;
                ar = er;
                er = dr;
                dr = rotl(cr, 10);
                cr = br;
                br = tr;
            }
            yield {
                stepNumber: step,
                entities: makeBars(padded, "active"),
                edges: [],
                description: `Block ${block + 1}, round ${round + 1}: advanced both the left and right lines.`,
                codeLineNumber: 1 + round,
                layout: "array",
                meta: {
                    step: step,
                    block: block + 1,
                    round: round + 1,
                    left: [hex8(al), hex8(bl), hex8(cl), hex8(dl), hex8(el)],
                    right: [hex8(ar), hex8(br), hex8(cr), hex8(dr), hex8(er)],
                },
            };
            step += 1;
        }
        const t = (h[1] + cl + dr) >>> 0;
        h[1] = (h[2] + dl + er) >>> 0;
        h[2] = (h[3] + el + ar) >>> 0;
        h[3] = (h[4] + al + br) >>> 0;
        h[4] = (h[0] + bl + cr) >>> 0;
        h[0] = t;
    }

    const digestBytes: number[] = [];
    for (const word of h) {
        for (let j = 0; j < 4; j += 1) {
            digestBytes.push((word >>> (8 * j)) & 0xff);
        }
    }
    const digest = digestBytes.map((value) => value.toString(16).padStart(2, "0")).join("");
    yield {
        stepNumber: step,
        entities: makeBars(digestBytes, "sorted"),
        edges: [],
        description: `RIPEMD-160 digest of "${message}" is ${digest}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step, digest, message, state: h.map(hex8) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "RIPEMD-160 runs two different MD5-like computations on the same block at once, then folds their results together. Because the two lines use mirrored functions and different word orders, an attack that breaks one line does not automatically break the other.",
        invariants: [
            "Each line keeps five 32-bit working words and runs five rounds of sixteen steps.",
            "The left and right lines use mirrored boolean functions and constants.",
            "The two lines are combined into the running hash after every block.",
        ],
        correctness:
            "The implementation follows the RIPEMD-160 specification tables for message order and rotation counts on both lines. The companion test verifies the known digests for the empty string, abc, and longer phrases from a standard reference implementation.",
        complexityRationale:
            "Two lines of eighty steps run per 64-byte block, so time is linear in message length with a constant twice that of MD5; space is dominated by the padded bytes.",
        uses: [
            "Historical digital signature standards such as RIPEMD-160 in early PGP",
            "Bitcoin address hashing combined with SHA-256",
            "A teaching example of dual-line hash construction",
        ],
        references: [
            "Dobbertin, Bosselaers, and Preneel, RIPEMD-160, 1996",
            "ISO/IEC 10118-3: Hash functions dedicated hash algorithms",
        ],
        workedExample:
            "For the empty message one padded block is processed by both lines. After five rounds each, the ten working words are folded with the initial state, producing the digest 9c1185a5c5e9fc54612808977ee8f548b2258d31.",
    },
    id: "ripemd-160",
    name: "RIPEMD-160 Hash",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { message: "abc" },
    visualType: "array",
    run,
    pseudocode: [
        "pad the message with one, zeroes, and a 64-bit little-endian length",
        "initialize five hash words to the standard constants",
        "for each 512-bit block initialize left and right working states",
        "for each of five rounds do sixteen steps on both lines",
        "left: rotate A + f(B,C,D) + X[r[i]] + K by s[i] and add E",
        "right: use the mirrored function, word order Rp, and rotation Sp",
        "after eighty steps fold both lines into the running hash",
        "serialize the five hash words little-endian into the digest",
    ],
};

export default module;
