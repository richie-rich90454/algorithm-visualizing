/**
 * present-cipher.ts - PRESENT Block Cipher (Teaching Core)
 *
 * A compact substitution-permutation network that keeps the structure of the
 * PRESENT lightweight block cipher: an S-box layer, a bit permutation, and
 * round keys, all of which are invertible. This implementation is deliberately
 * reduced to a 16-bit block and a configurable small number of rounds so the
 * whole state fits on screen; it is a faithful teaching model, not the 64-bit
 * standard and not secure for real data.
 *
 * Complexity:
 *   Time:  O(rounds) per block
 *   Space: O(rounds) for the displayed round states
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const SBOX = [0xc, 0x5, 0xb, 0xf, 0x7, 0x8, 0x6, 0xd, 0x3, 0xa, 0x0, 0x9, 0xe, 0x4, 0x2, 0x1];
const INV_SBOX: number[] = [];
for (let i = 0; i < 16; i += 1) {
    INV_SBOX[SBOX[i] ?? 0] = i;
}

/** Bit permutation of the 16-bit toy block: the transpose of a 4x4 bit matrix. */
const PERM = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15];
const INV_PERM: number[] = [];
for (let i = 0; i < 16; i += 1) {
    INV_PERM[PERM[i] ?? 0] = i;
}

function nibble(block: number, index: number): number {
    return (block >>> (index * 4)) & 0xf;
}

function setNibble(block: number, index: number, value: number): number {
    const shift = index * 4;
    return (block & ~(0xf << shift)) | ((value & 0xf) << shift);
}

function roundKey(key: number, round: number): number {
    const rotation = ((round * 3) % 16 + 16) % 16;
    const rotated = ((key << rotation) | (key >>> (16 - rotation))) & 0xffff;
    return (rotated ^ ((round * 0x2a) & 0xffff)) & 0xffff;
}

function addKey(block: number, key: number): number {
    return block ^ key;
}

function sBoxLayer(block: number): number {
    let out = 0;
    for (let i = 0; i < 4; i += 1) {
        out = setNibble(out, i, SBOX[nibble(block, i)] ?? 0);
    }
    return out;
}

function invSBoxLayer(block: number): number {
    let out = 0;
    for (let i = 0; i < 4; i += 1) {
        out = setNibble(out, i, INV_SBOX[nibble(block, i)] ?? 0);
    }
    return out;
}

function permute(block: number): number {
    let out = 0;
    for (let i = 0; i < 16; i += 1) {
        if ((block >>> i) & 1) {
            out |= 1 << (PERM[i] ?? 0);
        }
    }
    return out & 0xffff;
}

function inversePermute(block: number): number {
    let out = 0;
    for (let i = 0; i < 16; i += 1) {
        if ((block >>> i) & 1) {
            out |= 1 << (INV_PERM[i] ?? 0);
        }
    }
    return out & 0xffff;
}

function encrypt(block: number, key: number, rounds: number): number[] {
    const states = [block];
    let state = block;
    for (let r = 1; r <= rounds; r += 1) {
        state = sBoxLayer(addKey(state, roundKey(key, r)));
        state = permute(state);
        states.push(state);
    }
    state = addKey(state, roundKey(key, rounds + 1));
    states[states.length - 1] = state;
    return states;
}

function decrypt(block: number, key: number, rounds: number): number {
    let state = addKey(block, roundKey(key, rounds + 1));
    for (let r = rounds; r >= 1; r -= 1) {
        state = inversePermute(state);
        state = invSBoxLayer(state);
        state = addKey(state, roundKey(key, r));
    }
    return state;
}

function makeCells(states: number[], activeRow: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < states.length; row += 1) {
        const state = states[row] ?? 0;
        for (let col = 0; col < 4; col += 1) {
            const stateName: EntityState = row === activeRow ? "active" : row === states.length - 1 ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: (nibble(state, 3 - col) ?? 0).toString(16).toUpperCase(),
                value: nibble(state, 3 - col),
                state: stateName,
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { block?: number; key?: number; rounds?: number } | null) ?? {};
    const block = (task.block ?? 0x1234) & 0xffff;
    const key = (task.key ?? 0xabcd) & 0xffff;
    const rounds = Math.max(1, Math.min(8, typeof task.rounds === "number" ? task.rounds : 4));
    const states = encrypt(block, key, rounds);
    const ciphertext = states[states.length - 1] ?? block;
    const recovered = decrypt(ciphertext, key, rounds);
    const base = { rows: states.length, cols: 4, rounds };

    yield {
        stepNumber: 0,
        entities: makeCells(states, 0),
        edges: [],
        description: "Toy SPN block: add the round key, apply the S-box, then permute bits.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "start", ciphertext: ciphertext.toString(16) },
    };
    for (let r = 1; r < states.length; r += 1) {
        yield {
            stepNumber: r,
            entities: makeCells(states, r),
            edges: [],
            description: `Round ${r}: the block after key addition, S-box substitution, and permutation.`,
            codeLineNumber: r <= rounds ? 3 : 5,
            layout: "grid",
            meta: { ...base, phase: r <= rounds ? "round" : "final", ciphertext: ciphertext.toString(16) },
        };
    }
    yield {
        stepNumber: states.length,
        entities: makeCells(states, states.length - 1),
        edges: [],
        description: `Ciphertext 0x${ciphertext.toString(16).toUpperCase()}; reversing the rounds restores 0x${recovered.toString(16).toUpperCase()}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, phase: "done", ciphertext: ciphertext.toString(16), plaintext: recovered.toString(16) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A substitution-permutation cipher repeatedly mixes a block with key material, substitutes each nibble through a nonlinear S-box, and then permutes the bits so that one nibble influences many others. Doing this several rounds makes the relationship between plaintext and ciphertext hard to trace. This teaching core keeps that exact structure on a small block so every round can be watched.",
        invariants: [
            "The S-box is a bijection, so its inverse table is well defined.",
            "The bit permutation is a bijection on the 16 positions.",
            "Each round key is invertible by XOR with the same value.",
        ],
        correctness:
            "Decryption applies the inverse operations in reverse order. XOR is its own inverse, the inverse S-box undoes the forward S-box because the table is a permutation, and the inverse permutation undoes the bit shuffle because it is the reverse mapping. Reversing rounds from last to first therefore maps the ciphertext back to the original block exactly.",
        complexityRationale:
            "Each round touches a constant number of bits and nibbles, so a block takes O(rounds) time. Storing one state per displayed round uses O(rounds) space, which is only a few cells for the teaching parameters.",
        uses: [
            "Teaching substitution-permutation networks and confusion versus diffusion",
            "A hands-on model of lightweight block cipher round structure",
            "A classroom exercise in invertible bit permutations",
        ],
        references: [
            "Bogdanov et al., PRESENT: An Ultra-Lightweight Block Cipher, CHES 2007",
            "Stinson, Cryptography Theory and Practice, Chapter 3",
        ],
        workedExample:
            "Starting from block 0x1234 with key 0xABCD, round one XORs a derived round key, replaces each hexadecimal nibble through the S-box, and permutes the sixteen bits. Repeating four rounds and adding a final key gives the ciphertext; XORing the same keys in reverse and applying the inverse layers returns 0x1234.",
    },
    id: "present-cipher",
    name: "PRESENT Block Cipher (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: { block: 0x1234, key: 0xabcd, rounds: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "load the 16-bit block and the derived round keys",
        "for each round XOR the block with the round key",
        "replace each nibble through the nonlinear S-box",
        "permute the sixteen bits with the fixed layer",
        "after the last round XOR the final round key",
        "to decrypt XOR keys in reverse and invert each layer",
        "done: report ciphertext and recovered block",
    ],
};

export default module;
