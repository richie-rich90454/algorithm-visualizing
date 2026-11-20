/**
 * triple-des.ts - Toy Three-Key Feistel EDE (3DES Teachable Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Triple DES applies encrypt-decrypt-encrypt with two or three keys so that
 * brute-force search no longer breaks a single DES key. This is a small toy
 * model of that structure, not DES: an eight-bit block is processed by a
 * four-round Feistel network with a fixed four-bit substitution box, and the
 * EDE composition uses two keys. Every step is exact and easy to verify, and
 * no claim of cryptographic security is made.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block, three cipher calls for EDE
 *   Space: O(1) for one block and the round keys
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the left and right four-bit halves at each EDE stage.
 *   - Keys, subkeys, ciphertext, and the round-trip check are in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TripleDesInput { plaintext?: number; k1?: number; k2?: number }

const SBOX = [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7];
const ROUNDS = 4;

function subkeys(key: number): number[] {
    const hi = (key >> 4) & 15;
    const lo = key & 15;
    return [
        hi,
        lo,
        (hi + lo) & 15,
        (hi + 2 * lo + 1) & 15,
    ];
}

function feistel(block: number, roundKeys: number[], decrypt: boolean): number {
    let L = decrypt ? block & 15 : (block >> 4) & 15;
    let R = decrypt ? (block >> 4) & 15 : block & 15;
    const keys = decrypt ? [...roundKeys].reverse() : roundKeys;
    for (const k of keys) {
        const f = SBOX[(R ^ k) & 15] ?? 0;
        const nextL = R;
        const nextR = L ^ f;
        L = nextL;
        R = nextR;
    }
    return decrypt ? ((R << 4) | L) & 255 : ((L << 4) | R) & 255;
}

function hex(value: number): string {
    return value.toString(16).toUpperCase();
}

function makeCells(stages: Array<{ L: number; R: number }>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < stages.length; col += 1) {
            const nibble = row === 0 ? (stages[col]?.L ?? 0) : (stages[col]?.R ?? 0);
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: hex(nibble),
                value: nibble,
                state: (col === stages.length - 1 ? "sorted" : col === 0 ? "idle" : "comparing") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function split(block: number): { L: number; R: number } {
    return { L: (block >> 4) & 15, R: block & 15 };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TripleDesInput | null) ?? {};
    const clampByte = (v: unknown, fallback: number): number =>
        typeof v === "number" && Number.isFinite(v) ? ((Math.trunc(v) % 256) + 256) % 256 : fallback;
    const plaintext = clampByte(task.plaintext, 0xA5);
    const k1 = clampByte(task.k1, 0x12);
    const k2 = clampByte(task.k2, 0x34);
    const sk1 = subkeys(k1);
    const sk2 = subkeys(k2);
    const afterE1 = feistel(plaintext, sk1, false);
    const afterD2 = feistel(afterE1, sk2, true);
    const ciphertext = feistel(afterD2, sk1, false);
    const backD1 = feistel(ciphertext, sk1, true);
    const backE2 = feistel(backD1, sk2, false);
    const recovered = feistel(backE2, sk1, true);
    const valid = recovered === plaintext;

    const encStages = [plaintext, afterE1, afterD2, ciphertext].map(split);
    const decStages = [ciphertext, backD1, backE2, recovered].map(split);
    const base = { rows: 2, cols: 4, plaintext, k1, k2, subkeys1: sk1, subkeys2: sk2, rounds: ROUNDS };

    yield {
        stepNumber: 0,
        entities: makeCells(encStages),
        edges: [],
        description: `Encrypt-decrypt-encrypt on the eight-bit block ${hex(plaintext)} with keys ${hex(k1)} and ${hex(k2)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "encrypt", stages: encStages.map((s) => `${hex(s.L)}${hex(s.R)}`).join(" "), ciphertext: -1, recovered: -1, valid: false },
    };
    yield {
        stepNumber: 1,
        entities: makeCells(decStages),
        edges: [],
        description: `Ciphertext is ${hex(ciphertext)}; decrypt-decrypt-encrypt in reverse key order recovers ${hex(recovered)}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...base, phase: "decrypt", stages: decStages.map((s) => `${hex(s.L)}${hex(s.R)}`).join(" "), ciphertext, recovered, valid },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Feistel cipher splits a block into halves, applies a round function to one half, and swaps. Because the round function need not be reversible, it is simple to build. DES uses sixteen such rounds; triple DES runs the cipher, its inverse, and the cipher again using two keys, which defeats a brute-force search on a single DES key. This toy keeps only the structure on an eight-bit block.",
        invariants: [
            "Each Feistel round swaps the halves and combines the other half with a substitution-box output.",
            "Decryption uses the round keys in reverse order.",
            "Encrypt-decrypt-encrypt followed by decrypt-encrypt-decrypt returns the original block.",
        ],
        correctness:
            "A Feistel round maps (L, R) to (R, L xor f(R, k)). Applying the next round with the same key undoes the swap and the xor, so running the rounds with reversed keys inverts the cipher exactly. Since triple encryption is the composition E(k1), D(k2), E(k1), its inverse is D(k1), E(k2), D(k1). Composing a function with its inverse returns the plaintext, so the round trip holds for every block and key pair.",
        complexityRationale:
            "A block passes through four rounds per cipher call and three calls for encryption, so time is constant per block. The state is one block, the two round-key arrays, and the stage halves, all constant space.",
        uses: [
            "Teaching the Feistel structure and key reversal in decryption",
            "Explaining why triple encryption extends a block cipher's key strength",
            "A historical example of backward-compatible cipher design",
        ],
        references: [
            "National Bureau of Standards, Data Encryption Standard, FIPS 46, 1977",
            "National Institute of Standards and Technology, Triple DES, SP 800-67",
        ],
        workedExample:
            "For the block A5 with key 12, the four round keys are 1, 2, 3 and 6. Encrypting gives an intermediate block, decrypting with key 34 gives another, and encrypting again gives the ciphertext. Reversing the three operations with reversed round keys returns A5 exactly.",
    },
    id: "triple-des",
    name: "Triple DES (Toy Feistel EDE Core)",
    category: "cryptography-security",
    complexity: { time: "O(1) toy", space: "O(1) toy" },
    defaultInput: { plaintext: 0xA5, k1: 0x12, k2: 0x34 },
    visualType: "grid",
    run,
    pseudocode: [
        "split the block into two four-bit halves",
        "derive four round keys from each eight-bit key",
        "for a round compute f from the right half and swap",
        "encrypt with key one, decrypt with key two, encrypt with key one",
        "record the resulting ciphertext block",
        "invert with the reverse key order to check the round trip",
        "done: report ciphertext and whether the plaintext is recovered",
    ],
};

export default module;
