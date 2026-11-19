/**
 * hight-cipher.ts - HIGHT-Style Eight-Branch Cipher (Small Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a teaching model of HIGHT, not the production cipher and not for
 * security use. HIGHT works on eight one-byte branches and never uses an
 * S-box. A round adds a keyed value into the left four branches, subtracts a
 * keyed value from the right four using the updated left branches, XORs every
 * branch with a subkey and a round constant, and rotates the branch positions.
 * These operations are all invertible byte by byte, so reversing the round is
 * exact. The model uses eight rounds to keep the replay short.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block   Space: O(rounds) for the expanded subkeys
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

const MASK = 0xff;

function expandKey(key: number[], rounds: number): number[][] {
    let state = 0x9e3779b9;
    for (const byte of key) {
        state = (Math.imul(state ^ byte, 0x85ebca6b) + 0x27d4eb2d) >>> 0;
    }
    const perRound: number[][] = [];
    for (let round = 0; round < rounds; round += 1) {
        const keys: number[] = [];
        for (let index = 0; index < 16; index += 1) {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            keys.push((state >>> 13) & MASK);
        }
        perRound.push(keys);
    }
    return perRound;
}

function forwardRound(bytes: number[], keys: number[], round: number): number[] {
    const left: number[] = [];
    const right: number[] = [];
    for (let index = 0; index < 4; index += 1) {
        left.push((bytes[index] + ((bytes[4 + index] ^ keys[index]) & MASK)) & MASK);
    }
    for (let index = 0; index < 4; index += 1) {
        right.push((bytes[4 + index] - (left[index] ^ keys[4 + index])) & MASK);
    }
    const mixed = [...left, ...right].map((value, index) => value ^ keys[8 + index] ^ (round & MASK));
    return Array.from({ length: 8 }, (_, index) => mixed[(index + 7) % 8] ?? 0);
}

function inverseRound(bytes: number[], keys: number[], round: number): number[] {
    const mixed: number[] = [];
    for (let index = 0; index < 8; index += 1) {
        mixed.push(bytes[(index + 1) % 8] ?? 0);
    }
    const left: number[] = [];
    const right: number[] = [];
    for (let index = 0; index < 4; index += 1) {
        left.push(mixed[index] ^ keys[8 + index] ^ (round & MASK));
    }
    for (let index = 0; index < 4; index += 1) {
        right.push(mixed[4 + index] ^ keys[12 + index] ^ (round & MASK));
    }
    const original: number[] = [];
    for (let index = 0; index < 4; index += 1) {
        original[4 + index] = (right[index] + (left[index] ^ keys[4 + index])) & MASK;
    }
    for (let index = 0; index < 4; index += 1) {
        original[index] = (left[index] - (original[4 + index] ^ keys[index])) & MASK;
    }
    return original;
}

function makeBars(bytes: number[], state: EntityState): VisualEntity[] {
    return bytes.map((value, index) => ({
        id: `byte-${index}`,
        type: "bar" as const,
        label: (value & MASK).toString(16).padStart(2, "0"),
        value: value & MASK,
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
    const key = task.key ?? [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77];
    const rounds = Math.max(1, Math.min(32, Math.floor(Number(task.rounds) || 8)));
    const mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    let bytes = [...(task.block ?? [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef])].slice(0, 8);
    while (bytes.length < 8) {
        bytes.push(0);
    }
    const subkeys = expandKey(key, rounds);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(bytes, "idle"),
        edges: [],
        description: `Starting HIGHT-style ${mode} with ${rounds} eight-branch round(s) over eight bytes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, mode, rounds, branchBits: 8, output: [...bytes] },
    };
    step += 1;

    if (mode === "encrypt") {
        for (let round = 0; round < rounds; round += 1) {
            const keys = subkeys[round] ?? [];
            bytes = forwardRound(bytes, keys, round);
            yield {
                stepNumber: step,
                entities: makeBars(bytes, "active"),
                edges: [],
                description: `Round ${round + 1}: keyed add on the left, keyed subtract on the right, XOR, then rotate branches.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { step, round: round + 1, output: [...bytes] },
            };
            step += 1;
        }
    } else {
        for (let round = rounds - 1; round >= 0; round -= 1) {
            const keys = subkeys[round] ?? [];
            bytes = inverseRound(bytes, keys, round);
            yield {
                stepNumber: step,
                entities: makeBars(bytes, "active"),
                edges: [],
                description: `Inverse round ${round + 1}: undo the rotation and XOR, then add the right and subtract the left.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { step, round: round + 1, output: [...bytes] },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(bytes, "sorted"),
        edges: [],
        description: `Finished HIGHT-style ${mode}; output ${bytes.map((value) => value.toString(16).padStart(2, "0")).join("")}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { step, mode, rounds, output: [...bytes], done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "HIGHT treats a block as eight independent byte branches and mixes them with addition, subtraction, XOR, and a shift of branch positions. The left four branches absorb a keyed value from the right four, then the right four absorb a keyed value from the newly updated left four. XORing a subkey and rotating the positions complete the round. Because every step has an obvious inverse, decryption just walks the recipe backwards.",
        invariants: [
            "The left-branch additions use the right branches before they are modified.",
            "The right-branch subtractions use the left branches after they are modified.",
            "The round constant and subkeys are re-applied during decryption to undo the XOR layer exactly.",
        ],
        correctness:
            "This teaching model performs the HIGHT-style add, subtract, XOR, and rotate steps exactly on eight bytes. Undoing the rotation reads the next branch, undoing the XOR repeats the same subkey and round constant, then the right branches are recovered by adding the keyed left value and the left branches by subtracting the keyed right value. The test replays both directions independently, verifies decrypt of encrypt over many blocks and keys, and checks that a different key changes the output.",
        complexityRationale:
            "A round touches each of the eight branches a constant number of times, so encryption is O(rounds) per block. Sixteen subkey bytes per round require O(rounds) space.",
        uses: [
            "A teaching example of a cipher with no S-box at all",
            "Studying lightweight ciphers for radio-frequency and embedded systems",
            "Comparing byte-branch updates with word-oriented ARX rounds",
        ],
        references: [
            "Hong et al., HIGHT: A New Block Cipher Suitable for Low-Resource Device, 2006",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Ch. 7",
        ],
        workedExample:
            "In a round, byte 0 becomes byte 0 plus the value of byte 4 XOR a subkey, all modulo 256. Byte 4 then becomes its old value minus the new byte 0 XOR a second subkey. To reverse it, add that keyed value back to byte 4 first, then subtract it from byte 0.",
    },
    id: "hight-cipher",
    name: "HIGHT Cipher (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: {
        block: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef],
        key: [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77],
        rounds: 8,
        mode: "encrypt",
    },
    visualType: "array",
    run,
    pseudocode: [
        "expand the key into sixteen subkey bytes per round",
        "load the eight block bytes as eight branches",
        "for each round add a keyed right-branch value into each left branch",
        "subtract a keyed left-branch value from each right branch",
        "XOR every branch with its subkey and the round constant",
        "rotate the eight branch positions by one place",
        "decryption undoes rotation, XOR, subtraction, then addition",
        "emit the eight output bytes",
    ],
};

export default module;
