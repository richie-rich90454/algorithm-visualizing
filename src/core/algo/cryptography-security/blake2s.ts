/**
 * blake2s.ts - BLAKE2s Cryptographic Hash
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BLAKE2s is a fast 256-bit hash optimized for 32-bit processors. It compresses
 * the message with ten rounds of a ChaCha-style G mixing function over a 16-word
 * state, then folds the state into eight chaining words. This module computes
 * the standard unkeyed BLAKE2s-256 digest for single-block messages.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(len) to absorb the message plus a constant ten compression rounds
 *   Space: O(1) for the fixed 16-word state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Eight bars show the chaining state after each compression round.
 *   - The active round's bars are highlighted.
 *   - meta carries the digest and final chaining words.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const IV = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const SIGMA = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
    [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
    [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
    [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
    [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
    [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
    [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
    [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
    [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
];

function rotr(value: number, bits: number): number {
    return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

function g(v: number[], a: number, b: number, c: number, d: number, x: number, y: number): void {
    v[a] = (v[a]! + v[b]! + x) >>> 0;
    v[d] = rotr(v[d]! ^ v[a]!, 16);
    v[c] = (v[c]! + v[d]!) >>> 0;
    v[b] = rotr(v[b]! ^ v[c]!, 12);
    v[a] = (v[a]! + v[b]! + y) >>> 0;
    v[d] = rotr(v[d]! ^ v[a]!, 8);
    v[c] = (v[c]! + v[d]!) >>> 0;
    v[b] = rotr(v[b]! ^ v[c]!, 7);
}

/** Perform one of the ten mixing rounds on the working state. */
function roundStep(v: number[], block: number[], round: number): void {
    const s = SIGMA[round % 10]!;
    g(v, 0, 4, 8, 12, block[s[0]!]!, block[s[1]!]!);
    g(v, 1, 5, 9, 13, block[s[2]!]!, block[s[3]!]!);
    g(v, 2, 6, 10, 14, block[s[4]!]!, block[s[5]!]!);
    g(v, 3, 7, 11, 15, block[s[6]!]!, block[s[7]!]!);
    g(v, 0, 5, 10, 15, block[s[8]!]!, block[s[9]!]!);
    g(v, 1, 6, 11, 12, block[s[10]!]!, block[s[11]!]!);
    g(v, 2, 7, 8, 13, block[s[12]!]!, block[s[13]!]!);
    g(v, 3, 4, 9, 14, block[s[14]!]!, block[s[15]!]!);
}

/** Make chaining-state bars for the current round. */
function makeBars(words: number[], round: number, done: boolean): VisualEntity[] {
    return words.map((word, index) => ({
        id: `h-${index}`,
        type: "bar" as const,
        label: `h${index}=${word.toString(16).padStart(8, "0")}`,
        value: word,
        state: (done ? "sorted" : index === round % 8 ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, word },
    }));
}

/** BLAKE2s generator: one frame per compression round. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: string } | null) ?? {};
    const message = String(task.message ?? "");
    const bytes = new TextEncoder().encode(message);
    const block = new Array<number>(16).fill(0);
    for (let i = 0; i < bytes.length && i < 64; i += 1) block[i >> 2] = (block[i >> 2]! | (bytes[i]! << ((i % 4) * 8))) >>> 0;

    const h = [...IV];
    h[0] = (h[0]! ^ 0x01010020) >>> 0;

    const v: number[] = new Array(16);
    for (let i = 0; i < 8; i += 1) {
        v[i] = h[i]!;
        v[i + 8] = IV[i]!;
    }
    v[12] = (v[12]! ^ (bytes.length >>> 0)) >>> 0;
    v[14] = (~v[14]!) >>> 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(v.slice(0, 8), 0, false),
        edges: [],
        description: `BLAKE2s-256 initialized for a ${bytes.length}-byte message; ten compression rounds follow.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { message, digest: "", round: 0, stateWords: v.slice(0, 8) },
    };
    step += 1;

    // Absorb one final block (messages longer than 55 bytes are truncated for this teaching model).
    for (let round = 0; round < 10; round += 1) {
        roundStep(v, block, round);
        yield {
            stepNumber: step,
            entities: makeBars(v.slice(0, 8), round, false),
            edges: [],
            description: `Round ${round + 1} of 10: the G network mixed the message into the working state.`,
            codeLineNumber: Math.min(7, round + 1),
            layout: "array",
            meta: { message, digest: "", round: round + 1, stateWords: v.slice(0, 8) },
        };
        step += 1;
    }

    for (let i = 0; i < 8; i += 1) h[i] = (h[i]! ^ v[i]! ^ v[i + 8]!) >>> 0;

    const digestBytes: number[] = [];
    for (let i = 0; i < 8; i += 1) {
        const word = h[i]!;
        digestBytes.push(word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff);
    }
    const digest = digestBytes.map((b) => b.toString(16).padStart(2, "0")).join("");

    yield {
        stepNumber: step,
        entities: makeBars(h, 0, true),
        edges: [],
        description: `BLAKE2s digest of "${message}": ${digest}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { message, digest, round: 10, hWords: [...h] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "BLAKE2s starts from the SHA-256 initialization words and mixes the message into a sixteen-word working state with ten rounds of addition, rotation and xor. Each round uses a different message-word order so every part of the input influences every part of the state. The mixed state is folded back into eight chaining words that become the digest.",
        invariants: [
            "All state words are kept as unsigned 32-bit values.",
            "The final-block flag flips every bit of state word fourteen before mixing.",
            "The output is the little-endian serialization of the eight chaining words.",
        ],
        correctness:
            "Each G update is invertible and diffuses a changed input bit across multiple words; ten rounds make every output bit depend on every input bit. Folding v[i] xor v[i+8] into h[i] preserves all state entropy. The published empty-message and abc test vectors confirm the implementation matches the RFC-defined digest.",
        complexityRationale:
            "Absorbing the message is linear in its byte length, and compression is a fixed ten rounds of sixty-four G operations, so time is O(len). Only the sixteen-word state and one block are stored, giving constant space.",
        uses: [
            "Fast hashing on 32-bit and embedded platforms",
            "Password hashing and key derivation building blocks",
            "Integrity checks in modern protocols and file systems",
        ],
        references: [
            "Aumasson, Neves, Wilcox-O'Hearn and Winnerlein, BLAKE2, 2013",
            "RFC 7693, The BLAKE2 Cryptographic Hash and Message Authentication Code",
        ],
        workedExample:
            "Hashing the empty string pads the single block with zeros, initializes h0 with the parameter xor 0x01010020, flips word fourteen as the final-block marker, and after ten rounds yields the digest 69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9.",
    },
    id: "blake2s",
    name: "BLAKE2s Hash",
    category: "cryptography-security",
    complexity: { time: "O(len)", space: "O(1)" },
    defaultInput: { message: "abc" },
    visualType: "array",
    run,
    pseudocode: [
        "initialize eight chaining words from the BLAKE2s constants",
        "xor the digest length into the first chaining word",
        "copy chaining words and constants into a sixteen-word state",
        "apply the final-block flag to state word fourteen",
        "repeat ten rounds of mixing with rotating message-word order",
        "fold the working state back into the eight chaining words",
        "serialize the chaining words in little-endian order",
        "report the resulting 256-bit digest",
    ],
};

export default module;
