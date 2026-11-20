/**
 * cast-256.ts - CAST-256-Style Feistel Round (Small Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a teaching model of CAST-256, not the production cipher and not for
 * security use. It keeps CAST's distinctive round function: add the round key
 * to one half, rotate the sum left by an amount derived from the data itself,
 * split the result into four bytes, pass them through four different S-boxes,
 * and combine the lookups with XOR, subtraction, and addition modulo two to
 * the 32. The Feistel structure means the round function does not need to be
 * invertible for decryption to work. The model uses six rounds and generated
 * S-boxes instead of the production constants.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block   Space: O(rounds + 1024) for keys and S-boxes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the eight block bytes after each round.
 *   - The final frame shows the ciphertext or recovered plaintext.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CipherInput {
    block?: number[];
    key?: number[];
    rounds?: number;
    mode?: "encrypt" | "decrypt";
}

const MASK = 0xffffffff;

function rotl(x: number, n: number): number {
    const shift = n & 31;
    return shift === 0 ? x >>> 0 : ((x << shift) | (x >>> (32 - shift))) >>> 0;
}

function buildTables(seedValue: number): { sboxes: number[][]; roundKeys: number[] } {
    let seed = seedValue >>> 0;
    const next = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed;
    };
    const sboxes = Array.from({ length: 4 }, () => Array.from({ length: 256 }, () => next()));
    return { sboxes, roundKeys: [] };
}

function expandKey(key: number[], rounds: number): { sboxes: number[][]; roundKeys: number[] } {
    let seed = 0x2f1e3d4c;
    for (const byte of key) {
        seed = (Math.imul(seed ^ byte, 0x7feb352d) + 0x846ca68b) >>> 0;
    }
    const tables = buildTables(seed);
    tables.roundKeys = Array.from({ length: rounds }, () => {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        return seed >>> 0;
    });
    return tables;
}

function fFunction(sboxes: number[][], x: number, roundKey: number): number {
    const sum = (x + roundKey) >>> 0;
    const rotation = sum % 32;
    const rotated = rotl(sum, rotation);
    const a = (rotated >>> 24) & 0xff;
    const b = (rotated >>> 16) & 0xff;
    const c = (rotated >>> 8) & 0xff;
    const d = rotated & 0xff;
    const first = (sboxes[0]?.[a] ?? 0) ^ (sboxes[1]?.[b] ?? 0);
    const second = (first - (sboxes[2]?.[c] ?? 0)) >>> 0;
    return ((second + (sboxes[3]?.[d] ?? 0)) >>> 0) & MASK;
}

function toWords(block: number[]): [number, number] {
    let left = 0;
    let right = 0;
    for (let index = 0; index < 4; index += 1) {
        left |= (block[index] ?? 0) << (8 * index);
        right |= (block[4 + index] ?? 0) << (8 * index);
    }
    return [left >>> 0, right >>> 0];
}

function fromWords(left: number, right: number): number[] {
    const out: number[] = [];
    for (let index = 0; index < 4; index += 1) {
        out.push((left >>> (8 * index)) & 0xff);
    }
    for (let index = 0; index < 4; index += 1) {
        out.push((right >>> (8 * index)) & 0xff);
    }
    return out;
}

function makeBars(bytes: number[], state: EntityState): VisualEntity[] {
    return bytes.map((value, index) => ({
        id: `byte-${index}`,
        type: "bar" as const,
        label: (value & 0xff).toString(16).padStart(2, "0"),
        value: value & 0xff,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CipherInput | null) ?? {};
    const key = task.key ?? [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];
    const rounds = Math.max(1, Math.min(16, Math.floor(Number(task.rounds) || 6)));
    const mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    let [left, right] = toWords([...(task.block ?? [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef])]);
    const tables = expandKey(key, rounds);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(fromWords(left, right), "idle"),
        edges: [],
        description: `Starting CAST-256-style ${mode} with ${rounds} Feistel round(s) and four generated S-boxes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, mode, rounds, sboxWords: tables.sboxes.flat().length, output: fromWords(left, right) },
    };
    step += 1;

    const order =
        mode === "encrypt"
            ? Array.from({ length: rounds }, (_, index) => index)
            : Array.from({ length: rounds }, (_, index) => rounds - 1 - index);
    for (const round of order) {
        const roundKey = tables.roundKeys[round] ?? 0;
        if (mode === "encrypt") {
            const mixed = (right ^ fFunction(tables.sboxes, left, roundKey)) >>> 0;
            right = left;
            left = mixed;
        } else {
            const originalRight = (left ^ fFunction(tables.sboxes, right, roundKey)) >>> 0;
            left = right;
            right = originalRight;
        }
        yield {
            stepNumber: step,
            entities: makeBars(fromWords(left, right), "active"),
            edges: [],
            description: `${mode === "encrypt" ? "Round" : "Inverse round"} ${round + 1}: rotate the keyed sum by a data-derived amount and mix F(L) into R, then swap.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { step, round: round + 1, output: fromWords(left, right) },
        };
        step += 1;
    }

    const output = fromWords(left, right);
    yield {
        stepNumber: step,
        entities: makeBars(output, "sorted"),
        edges: [],
        description: `Finished CAST-256-style ${mode}; output ${output.map((value) => value.toString(16).padStart(2, "0")).join("")}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { step, mode, rounds, output, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "CAST round functions are unusual because they rotate by an amount that depends on the data rather than a fixed constant. The round key is added to the input half, the sum is rotated left by a number of bits taken from that sum, and four S-box lookups are combined with XOR, subtraction, and addition. That value is XORed into the other half and the halves are swapped. Decryption walks the rounds in reverse with the matching mirror operation.",
        invariants: [
            "The rotation amount is derived from the low bits of the keyed sum, so it changes with the data.",
            "Each Feistel round XORs F of the left half into the right half and then swaps the halves.",
            "Decryption uses the same F function and round keys in reverse order with the inverse half update.",
        ],
        correctness:
            "This teaching model implements the CAST-style F function exactly and places it in a Feistel network. A Feistel round stays invertible even when F is not: given the swapped output, the original left half is the new right half, and XORing F of that half into the new left half recovers the original right half. The test replays the generated tables, F function, and round order independently, confirms that decryption restores the plaintext for many blocks and keys, and checks that changing the key changes the output.",
        complexityRationale:
            "A round performs one key addition, one rotation, four table lookups, and two modular operations, so the time is O(rounds) per block. The four 256-word S-boxes and the round keys take O(1024 + rounds) space.",
        uses: [
            "A teaching example of data-dependent rotations in a block cipher",
            "Understanding Feistel decryption with a non-invertible round function",
            "Comparing CAST-style F functions with other S-box-based rounds",
        ],
        references: [
            "Adams, Constructing Symmetric Ciphers Using the CAST Design Procedure, 1997",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Ch. 7",
        ],
        workedExample:
            "With the default key, a round adds the round key to the left half, takes the low five bits of the sum as the rotation amount, rotates the sum left, and looks up its four bytes in four S-boxes. XOR of the first two lookups, minus the third, plus the fourth, is XORed into the right half before the swap.",
    },
    id: "cast-256",
    name: "CAST-256 (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(1024 + rounds)" },
    defaultInput: {
        block: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef],
        key: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08],
        rounds: 6,
        mode: "encrypt",
    },
    visualType: "array",
    run,
    pseudocode: [
        "generate four S-boxes and one round key per round from the secret key",
        "pack eight block bytes into two 32-bit halves L and R",
        "for each encryption round add the round key to R",
        "rotate the sum left by a number of bits taken from the sum itself",
        "look up its four bytes in four S-boxes and combine them with XOR, subtract, and add",
        "XOR that result into R and swap L and R",
        "decryption reverses the rounds with the mirror half update",
        "unpack the two halves into eight output bytes",
    ],
};

export default module;
