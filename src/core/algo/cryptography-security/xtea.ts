/**
 * xtea.ts - XTEA Block Cipher (Faithful Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * XTEA is a Feistel cipher over a 64-bit block, stored as two 32-bit words,
 * with a 128-bit key. Each round mixes a word with a shifted copy of itself,
 * adds a key word selected by the current sum, and advances by the golden
 * ratio constant. Decryption walks the same rounds in reverse.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block
 *   Space: O(1) for the working words
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row 0 holds the two data words v0 and v1.
 *   - Row 1 holds the four 32-bit key words.
 *   - The word updated in the current round is highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CipherInput {
    words?: [number, number];
    key?: [number, number, number, number];
    rounds?: number;
}

const DELTA = 0x9e3779b9;

/** Mix a word using the XTEA round function. */
function mix(word: number, sum: number, keyWord: number): number {
    return ((((word << 4) ^ (word >>> 5)) + word) ^ (sum + keyWord)) >>> 0;
}

/** Build the data and key cells for a step. */
function makeCells(
    v0: number,
    v1: number,
    key: number[],
    updated: 0 | 1 | null,
): VisualEntity[] {
    const data: Array<[string, number]> = [
        ["v0", v0],
        ["v1", v1],
    ];
    const entities: VisualEntity[] = data.map(([name, value], index) => ({
        id: `word-${index}`,
        type: "cell" as const,
        label: `${name}=${value.toString(16).padStart(8, "0")}`,
        value,
        state: (updated === index ? "comparing" : "visited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, word: name, value },
    }));
    key.forEach((value, index) => {
        entities.push({
            id: `key-${index}`,
            type: "cell" as const,
            label: `k${index}=${value.toString(16).padStart(8, "0")}`,
            value,
            state: "idle" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: index, word: `k${index}`, value },
        });
    });
    return entities;
}

/** The XTEA encryption generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CipherInput | null) ?? {};
    const words = Array.isArray(task.words) ? [...task.words] : [0x8e73b0f7, 0xda0e6452];
    const key = Array.isArray(task.key) ? [...task.key] : [0x03020100, 0x07060504, 0x0b0a0908, 0x0f0e0d0c];
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.floor(task.rounds)) : 32;
    let v0 = (words[0] ?? 0) >>> 0;
    let v1 = (words[1] ?? 0) >>> 0;
    const k0 = key[0] ?? 0;
    const k1 = key[1] ?? 0;
    const k2 = key[2] ?? 0;
    const k3 = key[3] ?? 0;
    let sum = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(v0, v1, key, null),
        edges: [],
        description: `XTEA: encrypting two words over ${rounds} rounds with a 128-bit key.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols: 4, round: 0, rounds, sum: 0, v0, v1, ciphertext: "" },
    };
    step += 1;

    const keyWords = [k0, k1, k2, k3];
    for (let round = 0; round < rounds; round += 1) {
        v0 = (v0 + mix(v1, sum, key[sum & 3] ?? k0)) >>> 0;
        sum = (sum + DELTA) >>> 0;
        yield {
            stepNumber: step,
            entities: makeCells(v0, v1, key, 0),
            edges: [],
            description: `Round ${round + 1}: updated v0 using sum ${sum}, got ${v0.toString(16)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 2, cols: 4, round: round + 1, rounds, sum, v0, v1, ciphertext: "" },
        };
        step += 1;

        const secondKey = keyWords[(sum >>> 11) & 3] ?? k0;
        v1 = (v1 + mix(v0, sum, secondKey)) >>> 0;
        yield {
            stepNumber: step,
            entities: makeCells(v0, v1, key, 1),
            edges: [],
            description: `Round ${round + 1}: updated v1 using sum ${sum}, got ${v1.toString(16)}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows: 2, cols: 4, round: round + 1, rounds, sum, v0, v1, ciphertext: "" },
        };
        step += 1;
    }

    const hex = `${v0.toString(16).padStart(8, "0")}${v1.toString(16).padStart(8, "0")}`;
    yield {
        stepNumber: step,
        entities: makeCells(v0, v1, key, null),
        edges: [],
        description: `Ciphertext after ${rounds} rounds is 0x${hex}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 2, cols: 4, round: rounds, rounds, sum, v0, v1, ciphertext: hex },
    };
}

/** The XTEA module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "XTEA is a Feistel network, so each round changes only one of the two half-blocks and the operation can always be undone. The value added to a half depends on a shifted copy of the other half and on a key word chosen by a running sum. The sum advances by a constant derived from the golden ratio so key words are used in a nonrepeating order.",
        invariants: [
            "All words are kept modulo 2 to the 32nd power.",
            "Each round updates exactly one of the two data words.",
            "The round key index is the low bits of the sum shifted right by eleven.",
        ],
        correctness:
            "Every operation inside the round function is an addition, XOR, or shift on 32-bit words, each invertible once the sum and key are known. Decryption starts from the final sum and replays the rounds in reverse order, subtracting the mixed value and stepping the sum backward. Because the Feistel structure never needs the round function to be invertible, encryption followed by decryption always restores the original block. The companion test checks this round-trip and agrees with an independently coded reference.",
        complexityRationale:
            "Encryption performs a constant number of integer operations per round, so time is O(rounds) for one 64-bit block. Only the two data words, the sum, and the four key words are held, so working space is O(1).",
        uses: [
            "A compact block cipher for embedded and archival systems",
            "A teaching example of Feistel round design and key schedules",
            "Historical use in early versions of the Linux kernel crypto API",
        ],
        references: [
            "Needham and Wheeler, XTEA: A Fast Block Cipher, 1997",
            "Knuth, The Art of Computer Programming Vol. 2, Golden ratio discussion",
        ],
        workedExample:
            "With the key bytes 00 through 0f and plaintext words 8e73b0f7 and da0e6452, the first round adds a mix of v1 and key word 0 to v0. After 32 rounds the state holds the ciphertext, and reversing the same 32 rounds with the same key recovers the original two words exactly.",
    },
    id: "xtea",
    name: "XTEA Block Cipher",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(1)" },
    defaultInput: {
        words: [0x8e73b0f7, 0xda0e6452],
        key: [0x03020100, 0x07060504, 0x0b0a0908, 0x0f0e0d0c],
        rounds: 8,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "split the block into two 32-bit words v0 and v1",
        "set the running sum to zero",
        "for each round",
        "add the mixed v1 and key word to v0, using the sum",
        "advance the sum by the delta constant",
        "add the mixed v0 and key word to v1, using the sum",
        "repeat for the chosen number of rounds",
        "done: output v0 and v1 as the ciphertext",
    ],
};

export default module;
