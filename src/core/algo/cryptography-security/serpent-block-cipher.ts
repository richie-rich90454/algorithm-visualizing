/**
 * serpent-block-cipher.ts - Serpent-Style SPN Core (Small Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a reduced teaching model of Serpent, not the AES finalist and not for
 * security use. It keeps the substitution-permutation-network idea: XOR a
 * round key, apply a bijective byte S-box to every byte, permute the eight byte
 * positions, and repeat. Decryption applies the inverse permutation, inverse
 * S-box, and the same round keys in reverse order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block   Space: O(rounds) for round keys
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the eight block bytes after each SPN round.
 *   - The final frame shows the ciphertext or recovered plaintext.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SerpentInput {
    block?: number[];
    key?: number[];
    rounds?: number;
    mode?: "encrypt" | "decrypt";
}

const PERMUTATION = [7, 0, 5, 2, 3, 4, 1, 6];

function sbox(value: number): number {
    return ((((value & 0xff) << 1) | ((value & 0xff) >>> 7)) ^ 0x5a) & 0xff;
}

function inverseSbox(value: number): number {
    const z = (value ^ 0x5a) & 0xff;
    return ((z >>> 1) | ((z << 7) & 0xff)) & 0xff;
}

function roundKeys(key: number[], rounds: number): number[][] {
    return Array.from({ length: rounds + 1 }, (_, i) =>
        Array.from({ length: 8 }, (_, j) => ((key[(i * 8 + j) % key.length] ?? 0) ^ (i * 0x11)) & 0xff),
    );
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
    const task = (input as SerpentInput | null) ?? {};
    const key = task.key ?? [3, 1, 4, 1, 5, 9, 2, 6];
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.min(16, task.rounds)) : 8;
    const mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const bytes = [...(task.block ?? [0, 1, 2, 3, 4, 5, 6, 7])];
    const rk = roundKeys(key, rounds);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(bytes, "idle"),
        edges: [],
        description: `Starting Serpent-style ${mode} with ${rounds} substitution-permutation rounds.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, mode, rounds },
    };
    step += 1;

    if (mode === "encrypt") {
        for (let i = 0; i < rounds; i += 1) {
            for (let j = 0; j < 8; j += 1) {
                bytes[j] = (bytes[j] ^ (rk[i]?.[j] ?? 0)) & 0xff;
            }
            const substituted = bytes.map(sbox);
            const permuted = PERMUTATION.map((source) => substituted[source] ?? 0);
            for (let j = 0; j < 8; j += 1) {
                bytes[j] = permuted[j] ?? 0;
            }
            yield {
                stepNumber: step,
                entities: makeBars(bytes, "active"),
                edges: [],
                description: `Round ${i + 1}: XORed key, substituted each byte, then permuted byte positions.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { step: step, round: i + 1 },
            };
            step += 1;
        }
        for (let j = 0; j < 8; j += 1) {
            bytes[j] = (bytes[j] ^ (rk[rounds]?.[j] ?? 0)) & 0xff;
        }
    } else {
        for (let j = 0; j < 8; j += 1) {
            bytes[j] = (bytes[j] ^ (rk[rounds]?.[j] ?? 0)) & 0xff;
        }
        for (let i = rounds - 1; i >= 0; i -= 1) {
            const unpermuted = new Array<number>(8).fill(0);
            for (let j = 0; j < 8; j += 1) {
                unpermuted[PERMUTATION[j] ?? 0] = bytes[j] ?? 0;
            }
            for (let j = 0; j < 8; j += 1) {
                bytes[j] = inverseSbox(unpermuted[j] ?? 0) ^ (rk[i]?.[j] ?? 0);
                bytes[j] = bytes[j] & 0xff;
            }
            yield {
                stepNumber: step,
                entities: makeBars(bytes, "active"),
                edges: [],
                description: `Inverse round ${rounds - i}: undid permutation, S-box, and key XOR.`,
                codeLineNumber: 4,
                layout: "array",
                meta: { step: step, round: rounds - i },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(bytes, "sorted"),
        edges: [],
        description: `Finished Serpent-style ${mode}; output ${bytes.map((v) => v.toString(16).padStart(2, "0")).join("")}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step, mode, output: bytes.slice(), rounds },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Serpent is a substitution-permutation cipher: every round confuses the bytes with a nonlinear S-box and then diffuses them by moving each byte to a new position. Because each layer is invertible, decryption runs the layers backward with the same round keys.",
        invariants: [
            "The S-box is a bijective rotation and XOR, so it has an exact inverse.",
            "The positional permutation is a bijection on the eight byte slots.",
            "Decryption undoes the final key XOR before reversing the rounds.",
        ],
        correctness:
            "The teaching model implements both directions of the SPN exactly. The companion test replays the layers independently, verifies that encryption followed by decryption returns the original block, and checks that the S-box is a bijection over all 256 byte values.",
        complexityRationale:
            "Each round substitutes and permutes eight bytes in constant time, so O(rounds) per block with O(rounds) key material.",
        uses: [
            "A teaching example of a substitution-permutation network",
            "Understanding invertible S-boxes and diffusion layers",
            "Contrasting SPN design with Feistel design",
        ],
        references: [
            "Anderson, Biham, and Knudsen, Serpent: A New Block Cipher Proposal, 1998",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Ch. 7",
        ],
        workedExample:
            "With block 00 01 02 03 04 05 06 07, the first round XORs the first round key, rotates and XORs each byte, then places byte 7 first, byte 0 second, and so on according to the fixed permutation.",
    },
    id: "serpent-block-cipher",
    name: "Serpent Block Cipher (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: {
        block: [0, 1, 2, 3, 4, 5, 6, 7],
        key: [3, 1, 4, 1, 5, 9, 2, 6],
        rounds: 8,
        mode: "encrypt",
    },
    visualType: "array",
    run,
    pseudocode: [
        "derive one eight-byte round key per round plus a final whitening key",
        "encryption round: XOR key into every byte",
        "apply the bijective byte S-box to all eight bytes",
        "permute the byte positions with a fixed permutation",
        "decryption: XOR the final key, then reverse permutation, S-box, and key XOR",
        "walk the rounds in reverse order for decryption",
        "emit the ciphertext or the recovered plaintext",
    ],
};

export default module;
