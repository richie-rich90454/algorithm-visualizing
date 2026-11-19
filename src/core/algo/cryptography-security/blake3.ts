/**
 * blake3.ts - BLAKE3 Compression Core (Small Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a single-block teaching model of the BLAKE3 compression function, not
 * the full BLAKE3 hash with its binary tree and extendable output, and not for
 * security use. It keeps the exact G mixing function, the seven-round schedule,
 * the message-word permutation, and the final XOR fold. The chaining value is
 * fixed to the standard initialization vector and only one 64-byte block is
 * processed, so every step is easy to replay by hand.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * 8) mixing steps   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the sixteen message words while rounds run.
 *   - The final frame shows the 32 output bytes of the compression core.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Blake3Input {
    message?: string;
}

const IV = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const PERMUTATION = [2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8];

function rotr(x: number, n: number): number {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function g(v: number[], a: number, b: number, c: number, d: number, mx: number, my: number): void {
    let va = (v[a] + v[b] + mx) >>> 0;
    let vd = rotr((v[d] ^ va) >>> 0, 16);
    let vc = (v[c] + vd) >>> 0;
    let vb = rotr((v[b] ^ vc) >>> 0, 12);
    va = (va + vb + my) >>> 0;
    vd = rotr((vd ^ va) >>> 0, 8);
    vc = (vc + vd) >>> 0;
    vb = rotr((vb ^ vc) >>> 0, 7);
    v[a] = va;
    v[b] = vb;
    v[c] = vc;
    v[d] = vd;
}

function messageWords(message: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < message.length && i < 64; i += 1) {
        bytes.push(message.charCodeAt(i) & 0xff);
    }
    const words: number[] = [];
    for (let w = 0; w < 16; w += 1) {
        let value = 0;
        for (let j = 0; j < 4; j += 1) {
            value += (bytes[w * 4 + j] ?? 0) * Math.pow(2, 8 * j);
        }
        words.push(value >>> 0);
    }
    return words;
}

function makeBars(values: number[], state: EntityState, bytes = false): VisualEntity[] {
    return values.map((value, index) => ({
        id: bytes ? `byte-${index}` : `word-${index}`,
        type: "bar" as const,
        label: bytes
            ? (value & 0xff).toString(16).padStart(2, "0")
            : (value >>> 0).toString(16).padStart(8, "0"),
        value: bytes ? value & 0xff : value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Blake3Input | null) ?? {};
    const message = typeof task.message === "string" ? task.message : "abc";
    const bytesLength = Math.min(message.length, 64);
    const m = messageWords(message);
    const v = [
        ...IV,
        IV[0] ?? 0,
        IV[1] ?? 0,
        IV[2] ?? 0,
        IV[3] ?? 0,
        0,
        0,
        bytesLength,
        0,
    ];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(m, "idle"),
        edges: [],
        description: `Initialized BLAKE3 compression with 16 message words from ${bytesLength} input byte(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, bytesLength, rounds: 7 },
    };
    step += 1;

    let current = m;
    for (let round = 0; round < 7; round += 1) {
        g(v, 0, 4, 8, 12, current[0] ?? 0, current[1] ?? 0);
        g(v, 1, 5, 9, 13, current[2] ?? 0, current[3] ?? 0);
        g(v, 2, 6, 10, 14, current[4] ?? 0, current[5] ?? 0);
        g(v, 3, 7, 11, 15, current[6] ?? 0, current[7] ?? 0);
        g(v, 0, 5, 10, 15, current[8] ?? 0, current[9] ?? 0);
        g(v, 1, 6, 11, 12, current[10] ?? 0, current[11] ?? 0);
        g(v, 2, 7, 8, 13, current[12] ?? 0, current[13] ?? 0);
        g(v, 3, 4, 9, 14, current[14] ?? 0, current[15] ?? 0);
        yield {
            stepNumber: step,
            entities: makeBars(current, "active"),
            edges: [],
            description: `Round ${round + 1}: ran four column and four diagonal G mixers.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { step: step, round: round + 1 },
        };
        step += 1;
        if (round < 6) {
            current = PERMUTATION.map((index) => current[index] ?? 0);
        }
    }

    const outputWords = Array.from({ length: 8 }, (_, i) =>
        ((v[i] ?? 0) ^ (v[i + 8] ?? 0)) >>> 0,
    );
    const outputBytes: number[] = [];
    for (const word of outputWords) {
        for (let j = 0; j < 4; j += 1) {
            outputBytes.push((word >>> (8 * j)) & 0xff);
        }
    }
    const hash = outputBytes.map((value) => value.toString(16).padStart(2, "0")).join("");
    yield {
        stepNumber: step,
        entities: makeBars(outputBytes, "sorted", true),
        edges: [],
        description: `BLAKE3 compression core produced 32 bytes beginning ${hash.slice(0, 16)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { step, hash, bytesLength },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "BLAKE3 compresses by repeatedly applying a G function that adds message words into a working state and mixes with rotations. Eight G calls make a round, columns then diagonals, and the message words are permuted between rounds so each one touches many state positions.",
        invariants: [
            "The working state starts from a chaining value and the initialization vector.",
            "Each G call updates four words with add, rotate, and XOR.",
            "The output folds the upper and lower halves of the state by XOR.",
        ],
        correctness:
            "The teaching model implements BLAKE3's G function, seven-round schedule, and message permutation exactly for one block. The companion test replays the compression independently and checks that a one-character input change produces a different output.",
        complexityRationale:
            "Seven rounds of eight G calls, each with four rotations, give a fixed constant cost, so time and space are constant for one block.",
        uses: [
            "A teaching example of a modern ARX compression function",
            "Understanding column and diagonal mixing schedules",
            "A stepping stone to the full BLAKE3 tree hash",
        ],
        references: [
            "O'Connor, Henson, and Guo, BLAKE3, 2020",
            "Aumasson et al., BLAKE2, 2013",
        ],
        workedExample:
            "For the message abc the sixteen little-endian message words feed eight G calls in the first round. After seven rounds and the permutation between them, folding v0 through v7 against v8 through v15 yields the 32-byte compression output.",
    },
    id: "blake3",
    name: "BLAKE3 Compression (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { message: "abc" },
    visualType: "array",
    run,
    pseudocode: [
        "initialize sixteen working words from the chaining value and IV",
        "read the 64-byte block as sixteen little-endian message words",
        "for each of seven rounds run four column G calls",
        "then run four diagonal G calls with the next message pairs",
        "G adds a message word, rotates by 16, 12, 8, and 7 bits, and XORs",
        "permute the message words after each round except the last",
        "fold the working state by XORing the upper and lower halves",
        "serialize eight words into a 32-byte compression output",
    ],
};

export default module;
