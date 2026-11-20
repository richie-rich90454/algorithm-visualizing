/**
 * cham-cipher.ts - CHAM-Style Add-Rotate-XOR Cipher (Small Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a teaching model of CHAM, not the production cipher and not for
 * security use. It keeps CHAM's unusually simple round: a word is rotated left
 * after an XOR with key material and then added to a second word that has been
 * XORed with more key material. There are no S-boxes and no multiplications.
 * A round alternates updating the odd-numbered words from the even ones and
 * the even words from the odd ones, which makes every word change and keeps the
 * transformation invertible by subtracting and rotating back.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block   Space: O(rounds) for the round-key array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the sixteen block bytes after each round.
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
const WORDS = 8;

function rotl(x: number, n: number): number {
    const shift = n & 15;
    return shift === 0 ? x & MASK : ((x << shift) | (x >>> (16 - shift))) & MASK;
}

function rotr(x: number, n: number): number {
    const shift = n & 15;
    return shift === 0 ? x & MASK : ((x >>> shift) | (x << (16 - shift))) & MASK;
}

function expandKey(key: number[], rounds: number): number[] {
    let seed = 0x0badf00d;
    for (const byte of key) {
        seed = (Math.imul(seed ^ byte, 0x85ebca6b) + 0xc2b2ae35) >>> 0;
    }
    const next = (): number => {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        return seed & MASK;
    };
    return Array.from({ length: rounds * 16 }, () => next());
}

/** Odd words are updated from the unchanged even words. */
function stepA(words: number[], keys: number[]): number[] {
    const after = words.slice();
    for (let index = 0; index < 4; index += 1) {
        const target = 2 * index + 1;
        const source = 2 * index;
        const rotated = rotl((words[target] ^ keys[index]) & MASK, 1);
        after[target] = (rotated + (words[source] ^ keys[4 + index])) & MASK;
    }
    return after;
}

/** Even words are updated from the unchanged odd words. */
function stepB(words: number[], keys: number[]): number[] {
    const after = words.slice();
    for (let index = 0; index < 4; index += 1) {
        const target = 2 * index;
        const source = 2 * index + 1;
        const rotated = rotl((words[target] ^ keys[8 + index]) & MASK, 1);
        after[target] = (rotated + (words[source] ^ keys[12 + index])) & MASK;
    }
    return after;
}

function stepAInv(words: number[], keys: number[]): number[] {
    const before = words.slice();
    for (let index = 0; index < 4; index += 1) {
        const target = 2 * index + 1;
        const source = 2 * index;
        const constant = (words[source] ^ keys[4 + index]) & MASK;
        const rotated = (words[target] - constant) & MASK;
        before[target] = rotr(rotated, 1) ^ keys[index];
    }
    return before;
}

function stepBInv(words: number[], keys: number[]): number[] {
    const before = words.slice();
    for (let index = 0; index < 4; index += 1) {
        const target = 2 * index;
        const source = 2 * index + 1;
        const constant = (words[source] ^ keys[12 + index]) & MASK;
        const rotated = (words[target] - constant) & MASK;
        before[target] = rotr(rotated, 1) ^ keys[8 + index];
    }
    return before;
}

function toWords(block: number[]): number[] {
    return Array.from(
        { length: WORDS },
        (_, index) => ((block[2 * index] ?? 0) | ((block[2 * index + 1] ?? 0) << 8)) & MASK,
    );
}

function fromWords(words: number[]): number[] {
    const out: number[] = [];
    for (let index = 0; index < WORDS; index += 1) {
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
    const key = task.key ?? [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef];
    const rounds = Math.max(1, Math.min(16, Math.floor(Number(task.rounds) || 8)));
    const mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const block = [...(task.block ?? Array.from({ length: 16 }, (_, index) => index))];
    const roundKeys = expandKey(key, rounds);
    let words = toWords(block);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(block, "idle"),
        edges: [],
        description: `Starting CHAM-style ${mode} with ${rounds} add-rotate-XOR round(s) over sixteen bytes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, mode, rounds, wordBits: 16, output: block },
    };
    step += 1;

    if (mode === "encrypt") {
        for (let round = 0; round < rounds; round += 1) {
            const keys = roundKeys.slice(round * 16, round * 16 + 16);
            words = stepB(stepA(words, keys), keys);
            yield {
                stepNumber: step,
                entities: makeBars(fromWords(words), "active"),
                edges: [],
                description: `Round ${round + 1}: odd words from even, then even words from odd, each rotate-left by one then add.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { step, round: round + 1, words: [...words] },
            };
            step += 1;
        }
    } else {
        for (let round = rounds - 1; round >= 0; round -= 1) {
            const keys = roundKeys.slice(round * 16, round * 16 + 16);
            words = stepAInv(stepBInv(words, keys), keys);
            yield {
                stepNumber: step,
                entities: makeBars(fromWords(words), "active"),
                edges: [],
                description: `Inverse round ${round + 1}: subtract the keyed partner, rotate right, then undo the key XOR.`,
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
        description: `Finished CHAM-style ${mode}; output ${output.map((value) => value.toString(16).padStart(2, "0")).join("")}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { step, mode, rounds, output, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "CHAM is deliberately minimal: a word is XORed with key material, rotated left by one bit, and then added to another word that was also XORed with key material. A round does this twice with the roles of even and odd words swapped, so every word is touched. The only arithmetic is addition modulo the word size, rotation, and XOR, which makes the round fast and its inverse straightforward to write down.",
        invariants: [
            "Each step updates only half of the words while the other half stays fixed.",
            "A rotation of one bit is undone by a rotation of one bit in the other direction.",
            "All additions are modulo two to the sixteen, so subtraction recovers the original word.",
        ],
        correctness:
            "This teaching model implements the CHAM-style update exactly. In a step, the source words are unchanged, so the added term is a known constant; subtracting it and rotating right recovers the target word before the key XOR. Applying inverse step B then inverse step A for each round in reverse order therefore restores the plaintext. The test uses an independent replay to confirm round trips and checks that changing the key changes the output.",
        complexityRationale:
            "Each round performs a fixed number of 16-bit operations on eight words, so the time is O(rounds) per block. Sixteen round-key words per round give O(rounds) space.",
        uses: [
            "A teaching example of an ARX cipher with no substitution boxes",
            "Studying lightweight ciphers suited to small embedded devices",
            "Comparing word update schedules such as even-odd alternation",
        ],
        references: [
            "Kim et al., CHAM: A Family of Lightweight Block Ciphers for Resource-Constrained Devices, 2017",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Ch. 7",
        ],
        workedExample:
            "In one step, word 1 becomes the rotate-left-by-one of its value XOR a round key, plus word 0 XOR a second round key. To undo it, subtract word 0 XOR that second key, rotate right by one, and XOR the first key back.",
    },
    id: "cham-cipher",
    name: "CHAM Cipher (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: {
        block: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        key: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef],
        rounds: 8,
        mode: "encrypt",
    },
    visualType: "array",
    run,
    pseudocode: [
        "expand the secret key into sixteen round words per round",
        "pack sixteen block bytes into eight 16-bit words",
        "for each round update odd words from even words",
        "then update even words from the new odd words",
        "each update rotates the target left by one after a key XOR",
        "then adds the source word XORed with another key word",
        "decryption subtracts and rotates right in reverse round order",
        "unpack the eight words into sixteen output bytes",
    ],
};

export default module;
