/**
 * aria-block-cipher.ts - ARIA-Style Substitution-Permutation Network (Toy)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a small teaching model of ARIA, not the production cipher and not
 * for security use. Unlike a Feistel cipher, ARIA is a substitution-permutation
 * network: every byte of the sixteen-byte state is replaced through an
 * inversion-based S-box, then a diffusion layer permutes the bytes and mixes
 * them with XOR, and finally a round key is added. The S-box here is computed
 * exactly as the inverse in the field GF(256) followed by a toy affine map,
 * and the diffusion layer is an invertible byte permutation plus a chained XOR.
 * The model uses four rounds so the steps stay easy to follow.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block   Space: O(rounds * 16) for round keys and tables
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

const PERMUTATION = [0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12, 1, 6, 11];

function gmul(a: number, b: number): number {
    let product = 0;
    let x = a & 0xff;
    let y = b & 0xff;
    for (let index = 0; index < 8; index += 1) {
        if (y & 1) {
            product ^= x;
        }
        const carry = x & 0x80;
        x = (x << 1) & 0xff;
        if (carry) {
            x ^= 0x1b;
        }
        y >>>= 1;
    }
    return product;
}

function fieldInverse(value: number): number {
    if (value === 0) {
        return 0;
    }
    let result = 1;
    let base = value & 0xff;
    let exponent = 254;
    while (exponent > 0) {
        if (exponent & 1) {
            result = gmul(result, base);
        }
        base = gmul(base, base);
        exponent >>>= 1;
    }
    return result;
}

const AFFINE_MULTIPLIER = 0x2d;
const AFFINE_CONSTANT = 0x5a;

function sboxValue(value: number): number {
    return (gmul(fieldInverse(value), AFFINE_MULTIPLIER) ^ AFFINE_CONSTANT) & 0xff;
}

const SBOX: number[] = Array.from({ length: 256 }, (_, value) => sboxValue(value));
const INV_SBOX: number[] = new Array<number>(256);
SBOX.forEach((value, index) => {
    INV_SBOX[value] = index;
});

function diffuse(state: number[]): number[] {
    const permuted: number[] = PERMUTATION.map((index) => state[index] ?? 0);
    const out: number[] = new Array(16);
    for (let index = 0; index < 15; index += 1) {
        out[index] = (permuted[index] ^ permuted[index + 1]) & 0xff;
    }
    out[15] = permuted[15];
    return out;
}

function diffuseInverse(state: number[]): number[] {
    const permuted: number[] = new Array(16);
    permuted[15] = state[15] ?? 0;
    for (let index = 14; index >= 0; index -= 1) {
        permuted[index] = (state[index] ^ permuted[index + 1]) & 0xff;
    }
    const out: number[] = new Array(16);
    PERMUTATION.forEach((source, index) => {
        out[source] = permuted[index];
    });
    return out;
}

function expandKey(key: number[], rounds: number): number[][] {
    let seed = 0x13579bdf;
    for (const byte of key) {
        seed = (Math.imul(seed ^ byte, 0x27d4eb2d) + 0x165667b1) >>> 0;
    }
    const keys: number[][] = [];
    for (let round = 0; round <= rounds; round += 1) {
        const words: number[] = [];
        for (let index = 0; index < 16; index += 1) {
            seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
            words.push((seed >>> 17) & 0xff);
        }
        keys.push(words);
    }
    return keys;
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
    const key = task.key ?? [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07];
    const rounds = Math.max(1, Math.min(12, Math.floor(Number(task.rounds) || 4)));
    const mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    let bytes = [...(task.block ?? Array.from({ length: 16 }, (_, index) => (index * 17) & 0xff))];
    while (bytes.length < 16) {
        bytes.push(0);
    }
    bytes = bytes.slice(0, 16);
    const keys = expandKey(key, rounds);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(bytes, "idle"),
        edges: [],
        description: `Starting ARIA-style ${mode} with ${rounds} substitution-permutation round(s) over sixteen bytes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, mode, rounds, sboxEntries: SBOX.length, output: [...bytes] },
    };
    step += 1;

    if (mode === "encrypt") {
        for (let round = 0; round < rounds; round += 1) {
            bytes = bytes.map((value) => SBOX[value & 0xff] ?? 0);
            bytes = diffuse(bytes);
            const roundKey = keys[round] ?? [];
            bytes = bytes.map((value, index) => (value ^ roundKey[index]) & 0xff);
            yield {
                stepNumber: step,
                entities: makeBars(bytes, "active"),
                edges: [],
                description: `Round ${round + 1}: substitute every byte through the inverse-based S-box, diffuse, then add the round key.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { step, round: round + 1, output: [...bytes] },
            };
            step += 1;
        }
        const finalKey = keys[rounds] ?? [];
        bytes = bytes.map((value, index) => (value ^ finalKey[index]) & 0xff);
    } else {
        const finalKey = keys[rounds] ?? [];
        bytes = bytes.map((value, index) => (value ^ finalKey[index]) & 0xff);
        for (let round = rounds - 1; round >= 0; round -= 1) {
            const roundKey = keys[round] ?? [];
            bytes = bytes.map((value, index) => (value ^ roundKey[index]) & 0xff);
            bytes = diffuseInverse(bytes);
            bytes = bytes.map((value) => INV_SBOX[value & 0xff] ?? 0);
            yield {
                stepNumber: step,
                entities: makeBars(bytes, "active"),
                edges: [],
                description: `Inverse round ${round + 1}: remove the round key, undo diffusion, then apply the inverse S-box.`,
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
        description: `Finished ARIA-style ${mode}; output ${bytes.map((value) => value.toString(16).padStart(2, "0")).join("")}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step, mode, rounds, output: [...bytes], done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "ARIA is a substitution-permutation network, which means it changes every byte of the state in each round rather than splitting the block in half like a Feistel cipher. First an S-box replaces each byte with a nonlinear value derived from its multiplicative inverse in a finite field. A diffusion layer then permutes the bytes and XORs neighbors so that one changed input byte spreads across the whole state, and a round key is added on top.",
        invariants: [
            "The S-box is a bijection: every input byte maps to a unique output byte.",
            "The diffusion layer is invertible by reversing the chained XOR and the byte permutation.",
            "Each round is undone in reverse order by removing its key, undoing diffusion, and applying the inverse S-box.",
        ],
        correctness:
            "This teaching model computes its S-box exactly as multiplication of the GF(256) inverse by a fixed constant followed by an XOR constant, both of which are bijections. Its diffusion layer permutes bytes and applies a chained XOR with one byte left unchanged, which is inverted by walking the chain backwards. The test independently rebuilds the S-box tables and replays every round, verifies that decryption restores the original block for many inputs and keys, and confirms that a different key changes the output.",
        complexityRationale:
            "A round makes one table lookup per byte and a fixed number of XORs over sixteen bytes, so the time is O(rounds) per block. Round keys occupy sixteen bytes per round plus one final key, giving O(rounds * 16) space.",
        uses: [
            "A teaching example of a substitution-permutation network that is not a Feistel cipher",
            "Understanding inversion-based S-box construction",
            "Comparing diffusion layers such as ARIA's byte mixing with AES row and column mixing",
        ],
        references: [
            "Kwon et al., ARIA: A New 128-Bit Block Cipher, 2003",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Ch. 7",
        ],
        workedExample:
            "For input byte zero the field inverse is zero, so the S-box returns the constant 0x5a. For a nonzero byte the model inverts it in GF(256), multiplies by 0x2d, and XORs 0x5a. The diffusion step then replaces byte zero with the XOR of permuted bytes zero and one, while byte fifteen stays as its permuted value.",
    },
    id: "aria-block-cipher",
    name: "ARIA Block Cipher (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds * 16)" },
    defaultInput: {
        block: Array.from({ length: 16 }, (_, index) => (index * 17) & 0xff),
        key: [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07],
        rounds: 4,
        mode: "encrypt",
    },
    visualType: "array",
    run,
    pseudocode: [
        "build the S-box from field inversion and a toy affine map",
        "expand the key into one round key per round plus a final key",
        "for each round replace every byte by its S-box value",
        "permute the sixteen bytes and XOR each byte with its neighbor",
        "XOR the diffused state with the round key",
        "after all rounds XOR the final key into the state",
        "decryption undoes the final key, then key, diffusion, and S-box in reverse",
        "emit the sixteen output bytes",
    ],
};

export default module;
