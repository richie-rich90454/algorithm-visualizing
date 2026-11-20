/**
 * simon-cipher.ts - Simon 32/64 Lightweight Block Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Simon is a balanced Feistel cipher designed for hardware-constrained devices.
 * This module implements the Simon 32/64 member: a 32-bit block split into two
 * 16-bit words, a 64-bit key split into four words, and 32 rounds. Each round
 * maps (x, y) to (y XOR f(x) XOR roundKey, x), where f combines left rotations
 * by one, two and eight bits with a bitwise AND and XOR. The key schedule
 * expands four words into thirty-two using right rotations and the z0 sequence. Decryption
 * runs the same Feistel rounds in reverse with the round keys in reverse order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T) for T rounds, each a constant number of word operations
 *   Space: O(T) for the expanded round keys
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two bars show the left and right 16-bit Feistel words.
 *   - The active round is highlighted and the round key is reported in meta.
 *   - meta carries the key schedule, every round state and the final block.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const WORD_MASK = 0xffff;
const ROUNDS = 32;
const CONSTANT = 0xfffc;
const Z0 = "11111010001001010110000111001101111101000100101011000011100110";

interface SimonInput {
    key?: number[];
    block?: number;
    mode?: string;
}

/** Rotate a 16-bit word right by j bits. */
function ror(value: number, j: number): number {
    return ((value >>> j) | (value << (16 - j))) & WORD_MASK;
}

/** Rotate a 16-bit word left by j bits. */
function rol(value: number, j: number): number {
    return ((value << j) | (value >>> (16 - j))) & WORD_MASK;
}

/** The Simon round function f(x) = (rol(x,1) and rol(x,8)) xor rol(x,2). */
function roundFunction(x: number): number {
    return ((rol(x, 1) & rol(x, 8)) ^ rol(x, 2)) & WORD_MASK;
}

/** Expand four 16-bit key words into thirty-two round keys. */
function expandKey(seed: number[]): number[] {
    const keys = seed.slice(0, 4).map((word) => word & WORD_MASK);
    while (keys.length < 4) keys.push(0);
    while (keys.length < ROUNDS) {
        const i = keys.length - 4;
        const inner = ror(keys[i + 3]!, 3) ^ keys[i + 1]!;
        const constantBit = Z0[i % Z0.length] === "1" ? 1 : 0;
        const next = CONSTANT ^ constantBit ^ keys[i]! ^ inner ^ ror(inner, 1);
        keys.push(next & WORD_MASK);
    }
    return keys;
}

/** Build the two word bars for a frame. */
function makeBars(x: number, y: number, focus: number, state: EntityState): VisualEntity[] {
    return [
        { id: "word-left", type: "bar" as const, label: `L:${x.toString(16).padStart(4, "0")}`, value: x, state: (focus === 0 ? state : "idle") as EntityState, x: 0, y: 0, width: 0, height: 0, metadata: { word: 0, value: x } },
        { id: "word-right", type: "bar" as const, label: `R:${y.toString(16).padStart(4, "0")}`, value: y, state: (focus === 1 ? state : "idle") as EntityState, x: 0, y: 0, width: 0, height: 0, metadata: { word: 1, value: y } },
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SimonInput | null) ?? {};
    const mode = String(task.mode ?? "encrypt") === "decrypt" ? "decrypt" : "encrypt";
    const seed = Array.isArray(task.key) && task.key.length === 4
        ? task.key.map((word) => Math.floor(Number(word) || 0) & WORD_MASK)
        : [0x0100, 0x0908, 0x1110, 0x1918];
    const block = Math.floor(Number(task.block ?? 0x65656877)) >>> 0;
    let x = (block >>> 16) & WORD_MASK;
    let y = block & WORD_MASK;
    const roundKeys = expandKey(seed);
    const states: Array<[number, number]> = [];
    let step = 0;
    const emit = (description: string, codeLine: number, focus: number, state: EntityState, extra: Record<string, unknown>) => ({
        stepNumber: step++,
        entities: makeBars(x, y, focus, state),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "array" as const,
        meta: {
            mode,
            wordSize: 16,
            rounds: ROUNDS,
            keyWords: seed.slice(),
            roundKeys: roundKeys.slice(),
            left: x,
            right: y,
            states: states.slice(),
            ...extra,
        },
    });

    yield emit(`Simon 32/64 ${mode} of block 0x${block.toString(16).padStart(8, "0")} with four key words.`, 0, -1, "idle", { block });

    if (mode === "encrypt") {
        for (let round = 0; round < ROUNDS; round += 1) {
            const previous = x;
            x = (roundFunction(previous) ^ y ^ roundKeys[round]!) & WORD_MASK;
            y = previous;
            states.push([x, y]);
            yield emit(`Round ${round + 1}: f(0x${previous.toString(16)}) mixed with the right word and key 0x${(roundKeys[round] ?? 0).toString(16)}.`, 4, 0, "active", { round: round + 1, roundKey: roundKeys[round] });
        }
    } else {
        for (let round = ROUNDS - 1; round >= 0; round -= 1) {
            const previous = y;
            y = (x ^ roundFunction(previous) ^ roundKeys[round]!) & WORD_MASK;
            x = previous;
            states.push([x, y]);
            yield emit(`Reverse round ${round + 1}: undo the Feistel step with key 0x${(roundKeys[round] ?? 0).toString(16)}.`, 4, 1, "active", { round: ROUNDS - round, roundKey: roundKeys[round] });
        }
    }

    const output = ((x << 16) | y) >>> 0;
    yield emit(
        `${mode === "encrypt" ? "Encrypted" : "Decrypted"} block is 0x${output.toString(16).padStart(8, "0")}.`,
        7,
        -1,
        "sorted",
        { output, roundCount: ROUNDS },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Split a 32-bit block into two halves and repeatedly mix them. The new left half is the old right half XORed with a nonlinear function of the old left half and a round key; the new right half is simply the old left half. That swap makes the Feistel network reversible without a separate inverse round function. The nonlinear function rotates the word by one, two and eight bits, ANDs two rotations together and XORs in the third, which is cheap in hardware.",
        invariants: [
            "Each Feistel round is a bijection on the two word state.",
            "The round keys are fixed by the key schedule and the z0 constant sequence.",
            "Decryption uses the identical Feistel step with keys taken in reverse order.",
        ],
        correctness:
            "A forward round sends (x, y) to (y xor f(x) xor k, x). Given the output (u, v), the original x is v and the original y is u xor f(v) xor k, so applying the same step with the same key in reverse order recovers the input exactly. Because every round is invertible, composing the thirty-two rounds gives a permutation of the block space and decryption inverts encryption for every key and block. The z0 constants break slide symmetry in the schedule but do not affect this inverse property.",
        complexityRationale:
            "Expanding the key computes twenty-eight further words from a fixed recurrence, and encryption applies thirty-two rounds of constant-time word operations, so time is O(T) with T fixed for this variant. The expanded round-key array holds T words, giving O(T) space.",
        uses: [
            "Lightweight encryption for RFID tags and sensor nodes",
            "Hardware-constrained Internet of Things devices",
            "A compact teaching example of a Feistel network and key schedule",
        ],
        references: [
            "Beaulieu et al., The SIMON and SPECK Families of Lightweight Block Ciphers, 2013",
            "Beaulieu et al., Simon and Speck: Block Ciphers for the Internet of Things, 2015",
        ],
        workedExample:
            "With key words 0x0100, 0x0908, 0x1110, 0x1918 and plaintext 0x65656877, the schedule expands to thirty-two round keys and the encryption produces 0xc69be9bb. Starting from that ciphertext and running the rounds with keys in reverse order returns 0x65656877, confirming that the Feistel step is inverted correctly.",
    },
    id: "simon-cipher",
    name: "Simon 32/64 Block Cipher",
    category: "cryptography-security",
    complexity: { time: "O(T)", space: "O(T)" },
    defaultInput: {
        key: [0x0100, 0x0908, 0x1110, 0x1918],
        block: 0x65656877,
        mode: "encrypt",
    },
    visualType: "array",
    run,
    pseudocode: [
        "split the 64-bit key into four 16-bit words",
        "expand the key into thirty-two round keys using z0 constants",
        "split the 32-bit block into left and right 16-bit words",
        "for each encryption round compute f of the left word",
        "set the new left to right XOR f XOR the round key",
        "swap the two words and continue",
        "for decryption walk the rounds in reverse order",
        "combine the final words into the output block",
        "done: report the transformed block",
    ],
};

export default module;
