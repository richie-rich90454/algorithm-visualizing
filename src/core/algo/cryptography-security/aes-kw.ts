/**
 * aes-kw.ts - AES Key Wrap (Toy Block Cipher)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AES Key Wrap protects short key material with a fixed-width construction. A
 * chain value A starts at the repeated byte A6, then each 64-bit key block is
 * fed through six rounds of a block cipher together with a counter that mixes
 * the block position into A. Unwrapping reverses the rounds and accepts the
 * result only when A returns to its initial value, which gives an integrity
 * check. The block cipher here is a small invertible toy permutation, so the
 * wrapping structure is faithful but the module is not a secure key wrap.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n) block encryptions for n key blocks (six rounds)
 *   Space: O(n) for the wrapped buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Rows show the chain value A, the active key block, and the wrapped data.
 *   - A is highlighted when the counter is mixed into it.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MASK128 = (1n << 128n) - 1n;
const MASK64 = (1n << 64n) - 1n;
const IV = 0xa6a6a6a6a6a6a6a6n;
const MUL = 0x9e3779b97f4a7c15n;

function rotl(value: bigint, shift: number): bigint {
    const n = shift & 127;
    if (n === 0) return value & MASK128;
    return (((value << BigInt(n)) | (value >> BigInt(128 - n))) & MASK128);
}

function rotr(value: bigint, shift: number): bigint {
    const n = shift & 127;
    if (n === 0) return value & MASK128;
    return (((value >> BigInt(n)) | (value << BigInt(128 - n))) & MASK128);
}

function oddInverse(value: bigint): bigint {
    let x = 1n;
    for (let i = 0; i < 8; i += 1) {
        x = (x * (2n - value * x)) & MASK128;
    }
    return x;
}

function roundKey(kek: number): bigint {
    return (BigInt(kek >>> 0) * MUL) & MASK128;
}

/** A small invertible stand-in for the AES block encryption E_K. */
export function toyBlock(block: bigint, kek: number): bigint {
    let z = (block ^ roundKey(kek)) & MASK128;
    z = rotl(z, 11 + (kek & 7));
    z = (z * MUL) & MASK128;
    return z ^ 0x3c6ef372fe94f82bn;
}

/** Inverse of the toy block cipher. */
export function toyInverse(block: bigint, kek: number): bigint {
    let z = block ^ 0x3c6ef372fe94f82bn;
    z = (z * oddInverse(MUL)) & MASK128;
    z = rotr(z, 11 + (kek & 7));
    return (z ^ roundKey(kek)) & MASK128;
}

/** Pad key bytes into 64-bit blocks. */
export function toBlocks(keyData: number[]): bigint[] {
    const padded = [...keyData];
    while (padded.length % 8 !== 0) {
        padded.push(0);
    }
    const blocks: bigint[] = [];
    for (let i = 0; i < padded.length; i += 8) {
        let value = 0n;
        for (let j = 0; j < 8; j += 1) {
            value = (value << 8n) | BigInt(padded[i + j] ?? 0 & 0xff);
        }
        blocks.push(value);
    }
    return blocks;
}

export interface UnwrapResult {
    blocks: bigint[];
    integrity: boolean;
}

/** Wrap n key blocks with the six-round chain. */
export function aesKwWrap(keyData: number[], kek: number): bigint[] {
    const blocks = toBlocks(keyData);
    let a = IV;
    for (let round = 0; round < 6; round += 1) {
        for (let i = 1; i <= blocks.length; i += 1) {
            const b = toyBlock((a << 64n) | (blocks[i - 1] ?? 0n), kek);
            a = (b >> 64n) ^ BigInt(blocks.length * round + i);
            blocks[i - 1] = b & MASK64;
        }
    }
    return [a, ...blocks];
}

/** Unwrap and verify the recovered chain value. */
export function aesKwUnwrap(wrapped: bigint[], kek: number): UnwrapResult {
    if (wrapped.length < 2) {
        return { blocks: [], integrity: false };
    }
    let a = wrapped[0] ?? 0n;
    const blocks = wrapped.slice(1);
    for (let round = 5; round >= 0; round -= 1) {
        for (let i = blocks.length; i >= 1; i -= 1) {
            const b = toyInverse(((a ^ BigInt(blocks.length * round + i)) << 64n) | (blocks[i - 1] ?? 0n), kek);
            a = b >> 64n;
            blocks[i - 1] = b & MASK64;
        }
    }
    return { blocks, integrity: a === IV };
}

function chainBytes(value: bigint): number[] {
    return [56n, 48n, 40n, 32n, 24n, 16n, 8n, 0n].map((shift) => Number((value >> shift) & 0xffn));
}

function rowCells(row: number, bytes: number[], state: EntityState): VisualEntity[] {
    return Array.from({ length: 8 }, (_, col) => {
        const value = bytes[col] ?? 0;
        return {
            id: `byte-${row}-${col}`,
            type: "cell" as const,
            label: value.toString(16).toUpperCase().padStart(2, "0"),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keyData?: number[]; kek?: number } | null) ?? {};
    const keyData = Array.isArray(task.keyData) ? task.keyData : [1, 2, 3, 4, 5, 6, 7, 8];
    const kek = typeof task.kek === "number" ? task.kek & 0xff : 42;

    const source = toBlocks(keyData);
    const wrapped = aesKwWrap(keyData, kek);
    const check = aesKwUnwrap(wrapped, kek);
    let step = 0;

    const frame = (round: number, blockIndex: number, a: bigint, description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: [
            ...rowCells(0, chainBytes(a), "pivot"),
            ...rowCells(1, chainBytes(blockIndex >= 0 ? (source[blockIndex] ?? 0n) : 0n), blockIndex >= 0 ? "active" : "unvisited"),
            ...rowCells(2, chainBytes(wrapped[(blockIndex + 1) % wrapped.length] ?? 0n), blockIndex >= 0 ? "sorted" : "unvisited"),
        ],
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows: 3,
            cols: 8,
            kek,
            blocks: source.length,
            rounds: 6,
            round,
            integrityOk: check.integrity,
            wrapped: wrapped.map((v) => v.toString(16).toUpperCase().padStart(16, "0")),
        },
    });

    yield frame(0, -1, IV, "Set the chain value A to the repeated byte A6.", 0);
    let a = IV;
    for (let round = 0; round < 6; round += 1) {
        for (let i = 0; i < source.length; i += 1) {
            const b = toyBlock((a << 64n) | (source[i] ?? 0n), kek);
            a = (b >> 64n) ^ BigInt(source.length * round + i + 1);
            yield frame(round + 1, i, a, `Round ${round + 1}, block ${i + 1}: encrypt A and R into B, then mix the counter into A.`, 1);
        }
    }
    yield frame(6, source.length - 1, a, `Unwrapping recovers the key and checks that A equals A6: ${check.integrity ? "accepted" : "rejected"}.`, 2);
}

const module: AlgorithmModule = {
    id: "aes-kw",
    name: "AES Key Wrap (Toy Block Cipher)",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { keyData: [1, 2, 3, 4, 5, 6, 7, 8], kek: 42 },
    visualType: "grid",
    run,
    pseudocode: [
        "A ← A6 repeated eight times",
        "for round 0 to 5:",
        "for each key block R_i from 1 to n: B ← E_K(A concatenated with R_i)",
        "A ← the left half of B xor (n times round plus i)",
        "R_i ← the right half of B",
        "unwrap by reversing the rounds and checking A against A6",
        "done: output the wrapped key blocks and integrity result",
    ],
    education: {
        intuition:
            "Key wrap encrypts a short key with a key-encryption key while keeping the output the same small size. The chain value A acts like a running checksum: every block is mixed into A through the block cipher, and the block counter is mixed in too. Unwrapping runs the chain backward, and the chance that a damaged ciphertext still returns A to A6 is negligible.",
        invariants: [
            "A always holds a 64-bit chain value; each R_i holds a 64-bit key block.",
            "The counter n times round plus i makes every block encryption distinct.",
            "A correct unwrap returns exactly the initial A6 chain value.",
        ],
        correctness:
            "Each forward step B = E_K(A || R_i), A' = left(B) xor t, R_i' = right(B) is inverted by B = D_K((A' xor t) || R_i'), A = left(B), R_i = right(B). Reversing all six rounds in reverse block order therefore restores the original A and R_i, and any modification to the wrapped data changes A away from the constant with overwhelming probability.",
        complexityRationale:
            "There are six rounds over n blocks, so 6n block operations gives O(n) time; the wrapped output holds n plus one blocks, giving O(n) space.",
        uses: [
            "Wrapping symmetric keys in key-management systems",
            "Key transport in PKCS#11 and CMS",
            "Teaching authenticated encryption of short fixed-width values",
        ],
        references: [
            "NIST Special Publication 800-38F, Key Wrap Modes, 2012",
            "RFC 3394, Advanced Encryption Standard (AES) Key Wrap Algorithm",
        ],
        workedExample:
            "Wrapping the 8-byte key 01 02 03 04 05 06 07 08 under key-encryption key 42 starts with A = A6A6A6A6A6A6A6A6. Each of six rounds processes the single block, XORs counter i into A, and produces a new A and block; the final frame unwraps the two output blocks and confirms the A6 integrity value is recovered.",
    },
};

export default module;
