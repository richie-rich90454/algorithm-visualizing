/**
 * sha-256-compression.ts - One SHA-256 Compression of a Single Block
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This performs the complete 64-round SHA-256 compression function on exactly
 * one padded 512-bit block, starting from the standard initial hash values. For
 * messages of 55 bytes or fewer the result of this single compression IS the
 * SHA-256 digest. Longer input is truncated to 55 bytes so the demo stays a
 * single block; it is a faithful compression round, not a streaming hash.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(64) rounds, each a constant number of 32-bit operations
 *   Space: O(64) for the message schedule
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Eight bars show the working variables a through h after each round.
 *   - The two freshly written variables a and e are highlighted.
 *   - Meta records the round, the word values, and the accumulated hash.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Round constants for SHA-256. */
const K: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
    0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
    0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
    0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
    0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
    0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
];

/** Standard SHA-256 initial hash values. */
const IV: number[] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
    0x5be0cd19,
];

/** 32-bit right rotation. */
function rotr(value: number, bits: number): number {
    return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

/** Pad a short ASCII message into one 512-bit block. */
function padBlock(message: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < message.length && bytes.length < 55; i += 1) {
        bytes.push(message.charCodeAt(i) & 0xff);
    }
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) {
        bytes.push(0);
    }
    for (let shift = 56; shift >= 0; shift -= 8) {
        bytes.push(Math.floor(bitLength / 2 ** shift) % 256);
    }
    return bytes;
}

/** Expand the 16 message words into 64 schedule words. */
function schedule(block: number[]): number[] {
    const words: number[] = [];
    for (let i = 0; i < 16; i += 1) {
        words.push(
            (((block[i * 4] ?? 0) << 24) |
                ((block[i * 4 + 1] ?? 0) << 16) |
                ((block[i * 4 + 2] ?? 0) << 8) |
                (block[i * 4 + 3] ?? 0)) >>>
                0,
        );
    }
    for (let i = 16; i < 64; i += 1) {
        const left = words[i - 15]!;
        const right = words[i - 2]!;
        const s0 = rotr(left, 7) ^ rotr(left, 18) ^ (left >>> 3);
        const s1 = rotr(right, 17) ^ rotr(right, 19) ^ (right >>> 10);
        words.push((words[i - 16]! + s0 + words[i - 7]! + s1) >>> 0);
    }
    return words;
}

function hex(value: number): string {
    return (value >>> 0).toString(16).padStart(8, "0");
}

function makeEntities(work: number[], round: number, active: boolean): VisualEntity[] {
    const names = ["a", "b", "c", "d", "e", "f", "g", "h"];
    return work.map((value, index) => ({
        id: `word-${index}`,
        type: "bar" as const,
        label: `${names[index]} ${hex(value)}`,
        value,
        state: (active && (index === 0 || index === 4) ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, register: names[index], hex: hex(value), round },
    }));
}

/** The SHA-256 compression generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: string } | null) ?? {};
    const message = String(task.message ?? "abc");
    const words = schedule(padBlock(message));
    const work = [...IV];

    yield {
        stepNumber: 0,
        entities: makeEntities(work, 0, false),
        edges: [],
        description: `Compressing one padded block for "${message}" with the eight SHA-256 initial hash values.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { message, round: 0, words: work.map(hex), digest: "" },
    };

    let step = 1;
    for (let round = 0; round < 64; round += 1) {
        const [a, b, c, d, e, f, g, h] = work as [
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
        ];
        const bigSigma1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const choose = (e & f) ^ (~e & g);
        const temp1 = (h + bigSigma1 + choose + K[round]! + words[round]!) >>> 0;
        const bigSigma0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (bigSigma0 + majority) >>> 0;

        work[7] = g;
        work[6] = f;
        work[5] = e;
        work[4] = (d + temp1) >>> 0;
        work[3] = c;
        work[2] = b;
        work[1] = a;
        work[0] = (temp1 + temp2) >>> 0;

        yield {
            stepNumber: step,
            entities: makeEntities(work, round + 1, true),
            edges: [],
            description: `Round ${round + 1}: temp1 ${hex(temp1)}, temp2 ${hex(temp2)}; a and e are written.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { message, round: round + 1, words: work.map(hex), digest: "" },
        };
        step += 1;
    }

    const hash = IV.map((value, index) => (value + work[index]!) >>> 0);
    const digest = hash.map(hex).join("");
    yield {
        stepNumber: step,
        entities: makeEntities(hash, 64, false),
        edges: [],
        description: `Add the working variables to the initial hash to get digest ${digest}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { message, round: 64, words: hash.map(hex), digest, hash: hash.map(hex) },
    };
}

/** The SHA-256 compression module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A hash compression function stirs a fixed-size block into eight 32-bit words through many rounds of shifts, rotations, and bitwise choices. Each round mixes the block word and a fixed constant into the working state, then permutes the variables so every bit influences every word after enough rounds. Adding the final state to the starting values gives the hash.",
        invariants: [
            "All arithmetic is on unsigned 32-bit words, wrapping modulo 2 to the 32nd power.",
            "The message schedule contains 64 words derived deterministically from the 16 block words.",
            "Each round writes exactly two new working values, a and e, and shifts the other six.",
        ],
        correctness:
            "The implementation is the standard FIPS 180-4 round: the sigma functions rotate by the specified amounts, choose selects bits of e or g, majority votes a, b, and c, and the two temporaries update the state in the prescribed order. Verified against published digests for short messages, the single-block result matches SHA-256 exactly because such messages receive only this one compression.",
        complexityRationale:
            "There are 64 rounds of constant work plus a fixed 64-word schedule expansion, so the time is O(64) and effectively constant. The schedule stores 64 words, giving O(64) space.",
        uses: [
            "Teaching the internals of the SHA-256 hash function",
            "Integrity checks and content fingerprints (via the full multi-block hash)",
            "A reference round for differential cryptanalysis demonstrations",
        ],
        references: [
            "NIST, FIPS 180-4: Secure Hash Standard, 2015",
            "Rivest, The MD5 Message-Digest Algorithm, 1992 (predecessor design)",
        ],
        workedExample:
            "For the message abc, the single padded block is compressed through 64 rounds from the standard initial values. Adding the working state to those initial values yields ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad, the familiar SHA-256 digest of abc.",
    },
    id: "sha-256-compression",
    name: "SHA-256 Compression",
    category: "cryptography-security",
    complexity: { time: "O(64)", space: "O(64)" },
    defaultInput: { message: "abc" },
    visualType: "array",
    run,
    pseudocode: [
        "pad the short message into one 512-bit block",
        "expand sixteen block words into a sixty-four word schedule",
        "initialize eight working variables from the fixed hash constants",
        "for each of sixty-four rounds compute two temporaries from the state",
        "rotate the working variables and write the new a and e",
        "add the final working state to the initial hash values",
        "done: output the eight words as a 256-bit digest",
    ],
};

export default module;
