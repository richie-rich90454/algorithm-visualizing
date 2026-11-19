/**
 * lea-cipher.ts - LEA-Style ARX Block Cipher (Small Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a teaching model of LEA, not the production cipher and not for
 * security use. It keeps LEA's defining idea: a four-word state advanced by
 * add, rotate, and XOR operations only, with no S-boxes. Each LEA-style step
 * mixes four round-key words into the state with alternating addition and XOR,
 * rotates each word by a fixed amount, then spreads the words with a parallel
 * addition chain. Two steps form a round; decryption applies the exact inverse
 * of every operation in reverse order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block   Space: O(rounds) for the round-key array
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

const MASK = 0xffff;

function rotl(x: number, n: number): number {
    const shift = n & 15;
    return shift === 0 ? x & MASK : ((x << shift) | (x >>> (16 - shift))) & MASK;
}

function rotr(x: number, n: number): number {
    const shift = n & 15;
    return shift === 0 ? x & MASK : ((x >>> shift) | (x << (16 - shift))) & MASK;
}

function expandKey(key: number[], rounds: number): number[] {
    let seed = 0x1a2b3c4d;
    for (const byte of key) {
        seed = (Math.imul(seed ^ byte, 0x5bd1e995) + 0x9e3779b9) >>> 0;
    }
    const next = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed & MASK;
    };
    return Array.from({ length: rounds * 8 }, () => next());
}

function arxStep(words: number[], keys: number[]): number[] {
    const a = rotl((words[0] + keys[0]) & MASK, 1);
    const b = rotl((words[1] ^ keys[1]) & MASK, 3);
    const c = rotl((words[2] + keys[2]) & MASK, 6);
    const d = rotl((words[3] ^ keys[3]) & MASK, 11);
    const na = (a + b) & MASK;
    const nb = (b + c) & MASK;
    const nc = (c + d) & MASK;
    const nd = (d + na) & MASK;
    return [na, nb, nc, nd];
}

function arxStepInv(words: number[], keys: number[]): number[] {
    const d = (words[3] - words[0]) & MASK;
    const c = (words[2] - d) & MASK;
    const b = (words[1] - c) & MASK;
    const a = (words[0] - b) & MASK;
    return [
        (rotr(a, 1) - keys[0]) & MASK,
        rotr(b, 3) ^ keys[1],
        (rotr(c, 6) - keys[2]) & MASK,
        rotr(d, 11) ^ keys[3],
    ];
}

function toWords(block: number[]): number[] {
    return Array.from({ length: 4 }, (_, index) => ((block[2 * index] ?? 0) | ((block[2 * index + 1] ?? 0) << 8)) & MASK);
}

function fromWords(words: number[]): number[] {
    const out: number[] = [];
    for (let index = 0; index < 4; index += 1) {
        out.push((words[index] ?? 0) & 0xff);
        out.push(((words[index] ?? 0) >>> 8) & 0xff);
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
    const key = task.key ?? [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88];
    const rounds = Math.max(1, Math.min(16, Math.floor(Number(task.rounds) || 6)));
    const mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const block = [...(task.block ?? [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef])];
    const roundKeys = expandKey(key, rounds);
    let words = toWords(block);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(block, "idle"),
        edges: [],
        description: `Starting LEA-style ${mode} with ${rounds} ARX round(s) over an eight-byte block.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, mode, rounds, wordBits: 16, output: block },
    };
    step += 1;

    if (mode === "encrypt") {
        for (let round = 0; round < rounds; round += 1) {
            words = arxStep(words, roundKeys.slice(round * 8, round * 8 + 4));
            words = arxStep(words, roundKeys.slice(round * 8 + 4, round * 8 + 8));
            const bytes = fromWords(words);
            yield {
                stepNumber: step,
                entities: makeBars(bytes, "active"),
                edges: [],
                description: `Round ${round + 1}: two add-rotate-XOR steps with a parallel addition chain.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { step, round: round + 1, words: [...words] },
            };
            step += 1;
        }
    } else {
        for (let round = rounds - 1; round >= 0; round -= 1) {
            words = arxStepInv(words, roundKeys.slice(round * 8 + 4, round * 8 + 8));
            words = arxStepInv(words, roundKeys.slice(round * 8, round * 8 + 4));
            const bytes = fromWords(words);
            yield {
                stepNumber: step,
                entities: makeBars(bytes, "active"),
                edges: [],
                description: `Inverse round ${round + 1}: undo the addition chain, then undo each add, rotate, and XOR.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { step, round: round + 1, words: [...words] },
            };
            step += 1;
        }
    }

    const output = fromWords(words);
    yield {
        stepNumber: step,
        entities: makeBars(output, "sorted"),
        edges: [],
        description: `Finished LEA-style ${mode}; output ${output.map((value) => value.toString(16).padStart(2, "0")).join("")}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { step, mode, rounds, output, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "LEA is built entirely from three cheap operations: addition, fixed rotation, and exclusive OR, collectively called ARX. A four-word state is mixed with round keys by alternating addition and XOR, each word is rotated by a different fixed amount, and a chain of additions spreads one word's change into all the others. Reversing these steps uses subtraction, opposite rotations, and XOR, so decryption closely mirrors encryption.",
        invariants: [
            "Each word is rotated by a fixed amount that does not depend on the data.",
            "The diffusion step is a parallel addition chain whose inverse is a chain of subtractions.",
            "No S-box or multiplication appears anywhere in the round.",
        ],
        correctness:
            "This teaching model applies the LEA-style add, rotate, XOR, and addition-chain operations exactly with 16-bit words. Every primitive is a bijection: adding a constant is undone by subtracting it, XOR is self-inverse, rotation is undone by the opposite rotation, and the addition chain is undone by subtracting in reverse order. Decryption therefore restores every word, which the test confirms with an independent replay of both directions over many blocks and keys.",
        complexityRationale:
            "A round performs two steps and each step does a constant number of 16-bit operations, so a block takes O(rounds) time. The expanded round-key array holds eight words per round, giving O(rounds) space.",
        uses: [
            "A teaching example of ARX-only block cipher design",
            "Understanding software-friendly ciphers on small embedded processors",
            "Comparing fixed rotations with the data-dependent rotations of RC5",
        ],
        references: [
            "Hong et al., LEA: A 128-Bit Block Cipher for Fast Encryption on Common Processors, 2013",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Ch. 7",
        ],
        workedExample:
            "With the default key and block, the first step adds a round key to word 0, XORs one into word 1, rotates by 1, 3, 6, and 11 bits, then replaces the words by their pairwise sums. Undoing the chain subtracts the first new word from the last, then walks back to recover all four original words.",
    },
    id: "lea-cipher",
    name: "LEA Cipher (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: {
        block: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef],
        key: [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88],
        rounds: 6,
        mode: "encrypt",
    },
    visualType: "array",
    run,
    pseudocode: [
        "expand the secret key into eight round words per round",
        "pack eight block bytes into four 16-bit words",
        "for each round apply two add-rotate-XOR steps",
        "for decryption apply the inverse steps in reverse round order",
        "in a step add or XOR four keys, rotate by 1, 3, 6, and 11 bits",
        "replace the words by the parallel addition chain of adjacent words",
        "invert the chain by subtracting in reverse order",
        "unpack the four words into eight output bytes",
    ],
};

export default module;
