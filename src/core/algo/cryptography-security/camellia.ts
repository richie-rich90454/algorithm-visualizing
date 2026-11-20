/**
 * camellia.ts - Camellia-Style Feistel Core (Small Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a reduced teaching model of Camellia, not the production cipher and
 * not for security use. It keeps the recognizable structure: a six-round
 * Feistel network, a keyed F function built from rotation and byte substitution,
 * an invertible FL layer inserted at the midpoint, and key whitening at the
 * edges. Every component is invertible, so decryption restores the plaintext.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block   Space: O(rounds)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the eight block bytes after each round and the FL layer.
 *   - The final frame shows the ciphertext or recovered plaintext.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CamelliaInput {
    block?: number[];
    key?: number[];
    rounds?: number;
    mode?: "encrypt" | "decrypt";
}

function rotl(value: number, n: number): number {
    return ((value << n) | (value >>> (32 - n))) >>> 0;
}

function rotr(value: number, n: number): number {
    return ((value >>> n) | (value << (32 - n))) >>> 0;
}

function sbox(value: number): number {
    return ((((value & 0xff) << 1) | ((value & 0xff) >>> 7)) ^ 0x5a) & 0xff;
}

function fFunction(x: number, key: number): number {
    const t = rotl((x ^ key) >>> 0, 7);
    const substituted =
        (sbox((t >>> 24) & 0xff) << 24) |
        (sbox((t >>> 16) & 0xff) << 16) |
        (sbox((t >>> 8) & 0xff) << 8) |
        sbox(t & 0xff);
    return (t ^ (substituted >>> 0)) >>> 0;
}

function fl(x: number, key: number): number {
    return rotl((x ^ key) >>> 0, 3);
}

function flInverse(x: number, key: number): number {
    return (rotr(x, 3) ^ key) >>> 0;
}

function subkeys(key: number[], rounds: number) {
    const word = (i: number): number =>
        (((key[i % key.length] ?? 0) << 24) |
            ((key[(i + 1) % key.length] ?? 0) << 16) |
            ((key[(i + 2) % key.length] ?? 0) << 8) |
            (key[(i + 3) % key.length] ?? 0)) >>> 0;
    return {
        whitening: [word(0), word(4), word(8), word(12)],
        round: Array.from({ length: rounds }, (_, i) => word(i + 1)),
        fl: [word(rounds + 1), word(rounds + 5)],
    };
}

function toWords(block: number[]): [number, number] {
    let left = 0;
    let right = 0;
    for (let i = 0; i < 4; i += 1) {
        left |= (block[i] ?? 0) << (8 * i);
        right |= (block[4 + i] ?? 0) << (8 * i);
    }
    return [left >>> 0, right >>> 0];
}

function fromWords(left: number, right: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < 4; i += 1) {
        out.push((left >>> (8 * i)) & 0xff);
    }
    for (let i = 0; i < 4; i += 1) {
        out.push((right >>> (8 * i)) & 0xff);
    }
    return out;
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
    const task = (input as CamelliaInput | null) ?? {};
    const key = task.key ?? [1, 2, 3, 4, 5, 6, 7, 8];
    const rounds = typeof task.rounds === "number" ? Math.max(2, Math.min(12, task.rounds)) : 6;
    const mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const block = [...(task.block ?? [0, 1, 2, 3, 4, 5, 6, 7])];
    const keys = subkeys(key, rounds);
    const middle = Math.floor(rounds / 2) - 1;
    let [left, right] = toWords(block);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(block, "idle"),
        edges: [],
        description: `Starting Camellia-style ${mode} with ${rounds} rounds and a midpoint FL layer.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, mode, rounds, middle: middle + 1 },
    };
    step += 1;

    if (mode === "encrypt") {
        left = (left ^ (keys.whitening[0] ?? 0)) >>> 0;
        right = (right ^ (keys.whitening[1] ?? 0)) >>> 0;
        for (let i = 0; i < rounds; i += 1) {
            left = (left ^ fFunction(right, keys.round[i] ?? 0)) >>> 0;
            const temp = left;
            left = right;
            right = temp;
            if (i === middle) {
                left = fl(left, keys.fl[0] ?? 0);
                right = fl(right, keys.fl[1] ?? 0);
            }
            yield {
                stepNumber: step,
                entities: makeBars(fromWords(left, right), "active"),
                edges: [],
                description: `Round ${i + 1}: Feistel mix${i === middle ? " followed by the FL diffusion layer" : ""}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { step: step, round: i + 1, left, right },
            };
            step += 1;
        }
        const temp = left;
        left = right;
        right = temp;
        left = (left ^ (keys.whitening[2] ?? 0)) >>> 0;
        right = (right ^ (keys.whitening[3] ?? 0)) >>> 0;
    } else {
        left = (left ^ (keys.whitening[2] ?? 0)) >>> 0;
        right = (right ^ (keys.whitening[3] ?? 0)) >>> 0;
        const temp = left;
        left = right;
        right = temp;
        for (let i = rounds - 1; i >= 0; i -= 1) {
            if (i === middle) {
                left = flInverse(left, keys.fl[0] ?? 0);
                right = flInverse(right, keys.fl[1] ?? 0);
            }
            const previousRight = left;
            const previousLeft = (right ^ fFunction(left, keys.round[i] ?? 0)) >>> 0;
            left = previousLeft;
            right = previousRight;
            yield {
                stepNumber: step,
                entities: makeBars(fromWords(left, right), "active"),
                edges: [],
                description: `Inverse round ${rounds - i}: undid the Feistel mix${i === middle ? " and FL layer" : ""}.`,
                codeLineNumber: 4,
                layout: "array",
                meta: { step: step, round: rounds - i, left, right },
            };
            step += 1;
        }
        left = (left ^ (keys.whitening[0] ?? 0)) >>> 0;
        right = (right ^ (keys.whitening[1] ?? 0)) >>> 0;
    }

    const output = fromWords(left, right);
    yield {
        stepNumber: step,
        entities: makeBars(output, "sorted"),
        edges: [],
        description: `Finished Camellia-style ${mode}; output ${output.map((v) => v.toString(16).padStart(2, "0")).join("")}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step, mode, output, rounds },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Camellia is a Feistel cipher that also inserts invertible FL transformations halfway through the rounds. The FL layer mixes key material with rotation, while the F function uses rotation and byte substitution. Running the same steps with keys reversed and FL inverted recovers the input.",
        invariants: [
            "Each Feistel round mixes F of one half into the other and swaps.",
            "The FL layer rotates a half after XORing a key and has a simple inverse.",
            "Whitening keys are applied at both ends of the cipher.",
        ],
        correctness:
            "The teaching model implements the Feistel rounds, FL layer, and whitening with exact inverses. The companion test replays both directions independently and confirms that encryption followed by decryption restores every byte of the original block.",
        complexityRationale:
            "Each round costs a constant number of lookups and rotations, so O(rounds) time and O(rounds) key storage.",
        uses: [
            "A teaching example of Feistel ciphers with extra diffusion layers",
            "Understanding invertible FL and FL-inverse transformations",
            "Studying whitening at the boundaries of a block cipher",
        ],
        references: [
            "Aoki et al., Camellia: A 128-Bit Block Cipher, 2000",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Ch. 7",
        ],
        workedExample:
            "After whitening, the first round XORs F(right) into left and swaps. At the midpoint both halves pass through FL, which rotates them by three bits after a key XOR; decryption rotates back by three and removes the same key before continuing in reverse.",
    },
    id: "camellia",
    name: "Camellia (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: {
        block: [0, 1, 2, 3, 4, 5, 6, 7],
        key: [1, 2, 3, 4, 5, 6, 7, 8],
        rounds: 6,
        mode: "encrypt",
    },
    visualType: "array",
    run,
    pseudocode: [
        "derive whitening, round, and FL subkeys from the key bytes",
        "whiten the left and right halves at the start",
        "encryption round: L = L xor F(R, key[i]), then swap halves",
        "at the midpoint apply the invertible FL layer to both halves",
        "undo the final swap and whiten the halves again",
        "decryption reverses the rounds, inverting FL at the midpoint",
        "reassemble the halves into eight bytes",
        "emit the ciphertext or the recovered plaintext",
    ],
};

export default module;
