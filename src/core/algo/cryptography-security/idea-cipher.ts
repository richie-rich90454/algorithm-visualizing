/**
 * idea-cipher.ts - IDEA-Style Block Cipher Core (Small Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a teaching model of the IDEA round structure, not a production
 * implementation and not for security use. It splits a 64-bit block into four
 * 16-bit words and runs eight rounds that alternate addition modulo 2^16,
 * multiplication modulo 2^16+1, and XOR. The distinctive Lai-Massey-style
 * multiplication layers are kept exactly; only the key schedule is simplified.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block   Space: O(rounds) for subkeys
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the four 16-bit words (eight bytes) after each round.
 *   - The final frame shows the ciphertext or recovered plaintext.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface IdeaInput {
    block?: number[];
    key?: number[];
    mode?: "encrypt" | "decrypt";
}

function mul(a: number, b: number): number {
    const x = a === 0 ? 65536 : a;
    const y = b === 0 ? 65536 : b;
    const product = (x * y) % 65537;
    return product === 65536 ? 0 : product;
}

function modularInverse(a: number): number {
    let x = a === 0 ? 65536 : a;
    let oldR = 65537;
    let r = x;
    let oldS = 0;
    let s = 1;
    while (r !== 0) {
        const q = Math.floor(oldR / r);
        const nextR = oldR - q * r;
        oldR = r;
        r = nextR;
        const nextS = oldS - q * s;
        oldS = s;
        s = nextS;
    }
    const inverse = ((oldS % 65537) + 65537) % 65537;
    return inverse === 65536 ? 0 : inverse;
}

function subkeys(key: number[]): number[] {
    const words: number[] = [];
    for (let i = 0; i < 8; i += 1) {
        words.push((((key[i * 2] ?? 0) << 8) | (key[i * 2 + 1] ?? 0)) & 0xffff);
    }
    return Array.from({ length: 52 }, (_, i) => (words[i % 8] + Math.imul(i, 0x2d1)) & 0xffff);
}

function toWords(block: number[]): number[] {
    return Array.from({ length: 4 }, (_, i) =>
        (((block[i * 2] ?? 0) << 8) | (block[i * 2 + 1] ?? 0)) & 0xffff,
    );
}

function fromWords(words: number[]): number[] {
    const out: number[] = [];
    for (let i = 0; i < 4; i += 1) {
        out.push((words[i] ?? 0) >>> 8);
        out.push((words[i] ?? 0) & 0xff);
    }
    return out;
}

function makeBars(bytes: number[], state: EntityState): VisualEntity[] {
    return bytes.map((value, index) => ({
        id: `word-${index}`,
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
    const task = (input as IdeaInput | null) ?? {};
    const key = task.key ?? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const block = [...(task.block ?? [0, 1, 2, 3, 4, 5, 6, 7])];
    const k = subkeys(key);
    let words = toWords(block);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(block, "idle"),
        edges: [],
        description: `Starting IDEA-style ${mode} on four 16-bit words with multiplication modulo 65537.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, mode, rounds: 8 },
    };
    step += 1;

    if (mode === "encrypt") {
        for (let r = 0; r < 8; r += 1) {
            const k1 = k[6 * r] ?? 0;
            const k2 = k[6 * r + 1] ?? 0;
            const k3 = k[6 * r + 2] ?? 0;
            const k4 = k[6 * r + 3] ?? 0;
            const k5 = k[6 * r + 4] ?? 0;
            const k6 = k[6 * r + 5] ?? 0;
            words[0] = mul(words[0] ?? 0, k1);
            words[1] = ((words[1] ?? 0) + k2) & 0xffff;
            words[2] = ((words[2] ?? 0) + k3) & 0xffff;
            words[3] = mul(words[3] ?? 0, k4);
            let t = mul(k5, (words[0] ?? 0) ^ (words[2] ?? 0));
            words[1] = (words[1] ?? 0) ^ t;
            words[3] = (words[3] ?? 0) ^ t;
            t = mul(k6, (words[1] ?? 0) ^ (words[3] ?? 0));
            words[0] = (words[0] ?? 0) ^ t;
            words[2] = (words[2] ?? 0) ^ t;
            if (r < 7) {
                const temp = words[1];
                words[1] = words[2];
                words[2] = temp;
            }
            yield {
                stepNumber: step,
                entities: makeBars(fromWords(words), "active"),
                edges: [],
                description: `Round ${r + 1}: added, multiplied mod 65537, and XORed the two Lai-Massey halves.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { step: step, round: r + 1, words: words.slice() },
            };
            step += 1;
        }
        words[0] = mul(words[0] ?? 0, k[48] ?? 0);
        words[2] = ((words[2] ?? 0) + (k[49] ?? 0)) & 0xffff;
        words[1] = ((words[1] ?? 0) + (k[50] ?? 0)) & 0xffff;
        words[3] = mul(words[3] ?? 0, k[51] ?? 0);
    } else {
        words[0] = mul(words[0] ?? 0, modularInverse(k[48] ?? 0));
        words[3] = mul(words[3] ?? 0, modularInverse(k[51] ?? 0));
        words[2] = ((words[2] ?? 0) - (k[49] ?? 0)) & 0xffff;
        words[1] = ((words[1] ?? 0) - (k[50] ?? 0)) & 0xffff;
        for (let r = 7; r >= 0; r -= 1) {
            if (r < 7) {
                const temp = words[1];
                words[1] = words[2];
                words[2] = temp;
            }
            const k1 = k[6 * r] ?? 0;
            const k2 = k[6 * r + 1] ?? 0;
            const k3 = k[6 * r + 2] ?? 0;
            const k4 = k[6 * r + 3] ?? 0;
            const k5 = k[6 * r + 4] ?? 0;
            const k6 = k[6 * r + 5] ?? 0;
            let t = mul(k6, (words[1] ?? 0) ^ (words[3] ?? 0));
            words[0] = (words[0] ?? 0) ^ t;
            words[2] = (words[2] ?? 0) ^ t;
            t = mul(k5, (words[0] ?? 0) ^ (words[2] ?? 0));
            words[1] = (words[1] ?? 0) ^ t;
            words[3] = (words[3] ?? 0) ^ t;
            words[3] = mul(words[3] ?? 0, modularInverse(k4));
            words[2] = ((words[2] ?? 0) - k3) & 0xffff;
            words[1] = ((words[1] ?? 0) - k2) & 0xffff;
            words[0] = mul(words[0] ?? 0, modularInverse(k1));
            yield {
                stepNumber: step,
                entities: makeBars(fromWords(words), "active"),
                edges: [],
                description: `Inverse round ${8 - r}: undid the multiplication and addition layers.`,
                codeLineNumber: 4,
                layout: "array",
                meta: { step: step, round: 8 - r, words: words.slice() },
            };
            step += 1;
        }
    }

    const output = fromWords(words);
    yield {
        stepNumber: step,
        entities: makeBars(output, "sorted"),
        edges: [],
        description: `Finished IDEA-style ${mode}; output ${output.map((v) => v.toString(16).padStart(2, "0")).join("")}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step, mode, output, rounds: 8 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "IDEA alternates three different group operations on four 16-bit words: XOR, addition modulo 2 to the 16, and multiplication modulo 2 to the 16 plus one. That mix of incompatible algebraic groups is what makes the round function hard to attack, and each operation has a clean inverse for decryption.",
        invariants: [
            "Multiplication treats the 16-bit zero word as the value 65536.",
            "Each round multiplies two pairs and XORs the cross terms back.",
            "The inner word pair is swapped after every round except the last.",
        ],
        correctness:
            "The teaching model implements the IDEA round and its exact inverse. The companion test replays the steps independently, checks encrypt then decrypt round-trips, and verifies that multiplication and its modular inverse cancel for sample values.",
        complexityRationale:
            "Eight fixed rounds each do a constant number of 16-bit operations, so O(1) per block with 52 subkeys of storage.",
        uses: [
            "A teaching example of mixing multiple group operations",
            "Understanding the Lai-Massey multiplication layer",
            "Historical PGP block encryption, simplified here",
        ],
        references: [
            "Lai and Massey, A Proposal for a New Block Encryption Standard, 1991",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Ch. 7",
        ],
        workedExample:
            "With words 0x0001, 0x0203, 0x0405, 0x0607, the first round multiplies word one by the first subkey, adds subkeys to the middle words, then XORs the cross products computed with multiplication modulo 65537 before swapping the middle pair.",
    },
    id: "idea-cipher",
    name: "IDEA Cipher (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(1) per block", space: "O(1)" },
    defaultInput: {
        block: [0, 1, 2, 3, 4, 5, 6, 7],
        key: Array.from({ length: 16 }, (_, i) => i),
        mode: "encrypt",
    },
    visualType: "array",
    run,
    pseudocode: [
        "split the block into four 16-bit words and derive 52 subkeys",
        "encryption round: multiply words one and four, add words two and three",
        "t = k5 times (word1 xor word3) modulo 65537; XOR t into words two and four",
        "t = k6 times (word2 xor word4); XOR t into words one and three",
        "swap the middle two words after each round except the last",
        "undetermined output: multiply and add the final four subkeys",
        "decryption uses modular inverses and negated additive keys in reverse",
        "emit the ciphertext or the recovered plaintext",
    ],
};

export default module;
