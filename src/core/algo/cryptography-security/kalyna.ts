/**
 * kalyna.ts - Kalyna-Style Feistel Round (Small Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a teaching model of Kalyna, not the production cipher and not for
 * security use. It keeps the defining Kalyna round ingredients: a large
 * substitution box, modular addition, XOR with a round key, and rotation. The
 * large 64-by-64 S-box is replaced here by a bytewise bijective substitution
 * applied to a 32-bit half, and the block is reduced to eight bytes. Each round
 * adds a key to the left half, substitutes and rotates it, XORs it into the
 * right half, and swaps the halves. Because every ingredient has an inverse,
 * decryption runs the rounds backwards exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block   Space: O(rounds) for the expanded round keys
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
const S_CONSTANT = 0x5a;
const S_MULTIPLIER = 13;

function sbox(byte: number): number {
    return ((((byte ^ S_CONSTANT) * S_MULTIPLIER) + 7) >>> 0) & 0xff;
}

function substituteWord(word: number): number {
    let out = 0;
    for (let index = 0; index < 4; index += 1) {
        out |= sbox((word >>> (8 * index)) & 0xff) << (8 * index);
    }
    return out >>> 0;
}

function rotl(x: number, n: number): number {
    const shift = n & 31;
    return shift === 0 ? x >>> 0 : ((x << shift) | (x >>> (32 - shift))) >>> 0;
}

interface RoundKey {
    add: number;
    xor: number;
    rotation: number;
}

function expandKey(key: number[], rounds: number): RoundKey[] {
    let seed = 0xa5a5f00d;
    for (const byte of key) {
        seed = (Math.imul(seed ^ byte, 0x9e3779b1) + 0x85ebca6b) >>> 0;
    }
    const next = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed >>> 0;
    };
    return Array.from({ length: rounds }, () => ({ add: next(), xor: next(), rotation: next() % 32 }));
}

function roundFunction(left: number, key: RoundKey): number {
    const added = (left + key.add) >>> 0;
    const substituted = substituteWord((added ^ key.xor) >>> 0);
    return rotl(substituted, key.rotation);
}

function forwardRound(left: number, right: number, key: RoundKey): [number, number] {
    return [(right ^ roundFunction(left, key)) >>> 0, left];
}

function inverseRound(left: number, right: number, key: RoundKey): [number, number] {
    const originalRight = (left ^ roundFunction(right, key)) >>> 0;
    return [right, originalRight];
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
    const key = task.key ?? [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80];
    const rounds = Math.max(1, Math.min(16, Math.floor(Number(task.rounds) || 8)));
    const mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    let [left, right] = toWords([...(task.block ?? [0, 1, 2, 3, 4, 5, 6, 7])]);
    const roundKeys = expandKey(key, rounds);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(fromWords(left, right), "idle"),
        edges: [],
        description: `Starting Kalyna-style ${mode} with ${rounds} Feistel round(s) over eight bytes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, mode, rounds, wordBits: 32, output: fromWords(left, right) },
    };
    step += 1;

    if (mode === "encrypt") {
        for (let round = 0; round < rounds; round += 1) {
            [left, right] = forwardRound(left, right, roundKeys[round] ?? { add: 0, xor: 0, rotation: 0 });
            yield {
                stepNumber: step,
                entities: makeBars(fromWords(left, right), "active"),
                edges: [],
                description: `Round ${round + 1}: add a key to L, substitute bytes, rotate, XOR into R, then swap halves.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { step, round: round + 1, output: fromWords(left, right) },
            };
            step += 1;
        }
    } else {
        for (let round = rounds - 1; round >= 0; round -= 1) {
            [left, right] = inverseRound(left, right, roundKeys[round] ?? { add: 0, xor: 0, rotation: 0 });
            yield {
                stepNumber: step,
                entities: makeBars(fromWords(left, right), "active"),
                edges: [],
                description: `Inverse round ${round + 1}: recompute the round function from R and XOR it into L, then swap halves back.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { step, round: round + 1, output: fromWords(left, right) },
            };
            step += 1;
        }
    }

    const output = fromWords(left, right);
    yield {
        stepNumber: step,
        entities: makeBars(output, "sorted"),
        edges: [],
        description: `Finished Kalyna-style ${mode}; output ${output.map((value) => value.toString(16).padStart(2, "0")).join("")}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { step, mode, rounds, output, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Kalyna is a modern Feistel cipher whose round mixes four kinds of operation: add a round key modulo the word size, pass the result through a very large substitution box, rotate it, and XOR it into the other half before swapping. The S-box is the source of nonlinearity and the addition and rotation provide diffusion across bits. Because addition undoes by subtraction, rotation by opposite rotation, and the S-box is a bijection, the whole round is reversible.",
        invariants: [
            "The bytewise substitution is a bijection, since multiplying by 13 modulo 256 is invertible.",
            "Each round adds a key to the left half, mixes the result into the right half, and swaps the halves.",
            "The mirror inverse round recomputes the same round function from the new right half.",
        ],
        correctness:
            "This teaching model applies the Kalyna-style add, substitute, rotate, XOR, and swap steps exactly on 32-bit halves. Because a Feistel round stays invertible even when its round function is not, the inverse round reads the original left half from the new right half, recomputes the same round function, and XORs it into the new left half to recover the original right half. The test replays both directions independently, checks decryption of encryption over many blocks and keys, confirms key sensitivity, and validates every frame's shape.",
        complexityRationale:
            "A round substitutes four bytes and performs a constant number of 32-bit operations, so encryption is O(rounds) per block. Three words per round for the round keys give O(rounds) space.",
        uses: [
            "A teaching example of a Feistel round that combines addition, rotation, and substitution",
            "Understanding large S-box design and its trade-offs",
            "Comparing modern block cipher round structures with older Feistel ciphers",
        ],
        references: [
            "Oliynykov et al., A New Encryption Standard of Ukraine: The Kalyna Block Cipher, 2015",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Ch. 7",
        ],
        workedExample:
            "With the default key, a round adds a 32-bit key to the left half, maps each of its four bytes through the substitution, rotates the word by a keyed amount, XORs it into the right half, and swaps. Undoing it rotates back, inverts each byte, XORs the key, and subtracts the added word.",
    },
    id: "kalyna",
    name: "Kalyna (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: {
        block: [0, 1, 2, 3, 4, 5, 6, 7],
        key: [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80],
        rounds: 8,
        mode: "encrypt",
    },
    visualType: "array",
    run,
    pseudocode: [
        "expand the key into an add word, an XOR word, and a rotation per round",
        "pack eight block bytes into two 32-bit halves L and R",
        "for each round add the add key to L modulo two to the 32",
        "substitute each byte of L through the bijective S-box",
        "rotate the substituted word by the round rotation amount",
        "XOR it into R and swap L and R",
        "decryption reverses the rounds with the mirror half update",
        "unpack the two halves into eight output bytes",
    ],
};

export default module;
