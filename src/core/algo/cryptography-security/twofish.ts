/**
 * twofish.ts - Twofish-Style Feistel Core (Small Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a reduced teaching model of the Twofish round structure, not the
 * AES-finalist cipher and not suitable for security. It splits a 64-bit block
 * into two 32-bit halves and applies a Feistel network whose F function passes
 * four bytes through a bijective S-box and then through a circulant MDS matrix
 * over GF(2^8). The mechanical steps are exact and fully replayable; only the
 * key schedule and S-box are simplified.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block   Space: O(rounds) for round keys
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the eight bytes of the block after each round.
 *   - The final frame shows the ciphertext or recovered plaintext.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TwofishInput {
    block?: number[];
    key?: number[];
    rounds?: number;
    mode?: "encrypt" | "decrypt";
}

const MDS = [
    [1, 2, 3, 1],
    [1, 1, 2, 3],
    [3, 1, 1, 2],
    [2, 3, 1, 1],
];

function gmul(a: number, b: number): number {
    let product = 0;
    let x = a & 0xff;
    let y = b & 0xff;
    for (let i = 0; i < 8; i += 1) {
        if (y & 1) {
            product ^= x;
        }
        const high = x & 0x80;
        x = (x << 1) & 0xff;
        if (high) {
            x ^= 0x1b;
        }
        y >>= 1;
    }
    return product & 0xff;
}

function sbox(value: number): number {
    return ((((value & 0xff) << 1) | ((value & 0xff) >>> 7)) ^ 0x63) & 0xff;
}

function fFunction(word: number, roundKey: number): number {
    const t = (word ^ roundKey) >>> 0;
    const input = [
        t & 0xff,
        (t >>> 8) & 0xff,
        (t >>> 16) & 0xff,
        (t >>> 24) & 0xff,
    ];
    const substituted = input.map(sbox);
    let result = 0;
    for (let i = 0; i < 4; i += 1) {
        let byte = 0;
        for (let j = 0; j < 4; j += 1) {
            byte ^= gmul(MDS[i]?.[j] ?? 0, substituted[j] ?? 0);
        }
        result |= byte << (8 * i);
    }
    return result >>> 0;
}

function roundKeys(key: number[], rounds: number): number[] {
    const keys: number[] = [];
    for (let i = 0; i < rounds; i += 1) {
        keys.push(((key[i % key.length] ?? 0) + Math.imul(i, 0x9e3779b9)) >>> 0);
    }
    return keys;
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
    const task = (input as TwofishInput | null) ?? {};
    const key = task.key ?? [1, 2, 3, 4, 5, 6, 7, 8];
    const rounds = typeof task.rounds === "number" ? Math.max(1, task.rounds) : 16;
    const mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const block = [...(task.block ?? [0, 1, 2, 3, 4, 5, 6, 7])];
    const rk = roundKeys(key, rounds);
    let [left, right] = toWords(block);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(block, "idle"),
        edges: [],
        description: `Starting Twofish-style ${mode} with ${rounds} Feistel rounds on an 8-byte block.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, mode, rounds },
    };
    step += 1;

    if (mode === "encrypt") {
        for (let i = 0; i < rounds; i += 1) {
            const nextLeft = right;
            const nextRight = (left ^ fFunction(right, rk[i] ?? 0)) >>> 0;
            left = nextLeft;
            right = nextRight;
            const bytes = fromWords(left, right);
            yield {
                stepNumber: step,
                entities: makeBars(bytes, "active"),
                edges: [],
                description: `Round ${i + 1}: L = previous R, R = previous L xor F(R, roundKey).`,
                codeLineNumber: 2,
                layout: "array",
                meta: { step: step, round: i + 1, left, right },
            };
            step += 1;
        }
    } else {
        for (let i = rounds - 1; i >= 0; i -= 1) {
            const previousRight = left;
            const previousLeft = (right ^ fFunction(left, rk[i] ?? 0)) >>> 0;
            left = previousLeft;
            right = previousRight;
            const bytes = fromWords(left, right);
            yield {
                stepNumber: step,
                entities: makeBars(bytes, "active"),
                edges: [],
                description: `Inverse round ${rounds - i}: undid one Feistel step using the same round key.`,
                codeLineNumber: 4,
                layout: "array",
                meta: { step: step, round: rounds - i, left, right },
            };
            step += 1;
        }
    }

    const output = fromWords(left, right);
    yield {
        stepNumber: step,
        entities: makeBars(output, "sorted"),
        edges: [],
        description: `Finished Twofish-style ${mode}; output ${output.map((v) => v.toString(16).padStart(2, "0")).join("")}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step, mode, output, rounds },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Twofish is a Feistel cipher whose round function applies S-boxes and a matrix over a finite field. In a Feistel network decryption does not need the inverse of the round function: running the same rounds with the keys in reverse order recovers the plaintext.",
        invariants: [
            "Each round replaces the left half with the right and the right with left xor F.",
            "The MDS matrix comes from a fixed circulant pattern over GF(2 to the 8).",
            "Decryption uses identical round keys in reverse order.",
        ],
        correctness:
            "The teaching model implements the Feistel recurrence and its exact inverse. The companion test replays both directions with an independent routine, verifies that encrypt then decrypt returns the original block, and confirms a one-byte key change alters the ciphertext.",
        complexityRationale:
            "Each round performs a fixed number of field multiplications, so time is O(rounds) per block and round-key storage is O(rounds).",
        uses: [
            "A teaching example of a Feistel cipher with an MDS diffusion layer",
            "Understanding why Feistel decryption reuses the encryption round function",
            "Demonstrating finite-field arithmetic in a cipher",
        ],
        references: [
            "Schneier et al., Twofish: A 128-Bit Block Cipher, 1998",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Ch. 7",
        ],
        workedExample:
            "With block 00 01 02 03 04 05 06 07, the first encryption round sets the new left half to 04 05 06 07 and the new right half to the old left xor F(old right). Reversing the sixteen rounds with the same keys restores the original eight bytes.",
    },
    id: "twofish",
    name: "Twofish (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: {
        block: [0, 1, 2, 3, 4, 5, 6, 7],
        key: [1, 2, 3, 4, 5, 6, 7, 8],
        rounds: 16,
        mode: "encrypt",
    },
    visualType: "array",
    run,
    pseudocode: [
        "split the 8-byte block into left and right 32-bit words",
        "derive one round key per round from the secret key",
        "encryption: for each round do L, R = R, L xor F(R, key[i])",
        "decryption: for each round in reverse do L, R = R xor F(L, key[i]), L",
        "F substitutes four bytes then multiplies by a circulant MDS matrix",
        "field multiplication uses polynomials modulo x^8 + x^4 + x^3 + x + 1",
        "reassemble the two words into eight bytes",
        "emit the ciphertext or the recovered plaintext",
    ],
};

export default module;
