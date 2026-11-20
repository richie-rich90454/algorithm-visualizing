/**
 * aes-xts.ts - XTS Tweakable Encryption (Toy Block Cipher)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * XTS is the NIST-approved mode for encrypting data on storage devices. It
 * uses two keys: one encrypts each block after XORing a secret tweak, and the
 * other encrypts the tweak, which is multiplied by a field element after every
 * block. The XOR-then-encrypt-then-XOR structure, called a tweakable codebook
 * mode, makes each block depend on its position without leaking equality the
 * way plain ECB does. This module keeps the XTS structure exactly but replaces
 * AES with a small invertible toy permutation, so it is a teaching model,
 * not a secure disk encryption implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(L) block encryptions for L blocks
 *   Space: O(L) for the ciphertext buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Rows show the plaintext block, the current tweak, and the ciphertext.
 *   - The current block is highlighted during its XOR-encrypt-XOR step.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MASK = (1n << 128n) - 1n;
const MUL = 0x9e3779b97f4a7c15n;
const CONST = 0xa5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5n;
const REDUCE = 0xe1000000000000000000000000000000n;

function rotl(value: bigint, shift: number): bigint {
    const n = shift & 127;
    if (n === 0) return value & MASK;
    return (((value << BigInt(n)) | (value >> BigInt(128 - n))) & MASK);
}

function rotr(value: bigint, shift: number): bigint {
    const n = shift & 127;
    if (n === 0) return value & MASK;
    return (((value >> BigInt(n)) | (value << BigInt(128 - n))) & MASK);
}

function oddInverse(value: bigint): bigint {
    let x = 1n;
    for (let i = 0; i < 8; i += 1) {
        x = (x * (2n - value * x)) & MASK;
    }
    return x;
}

function roundKey(key: number): bigint {
    return (BigInt(key >>> 0) * MUL) & MASK;
}

/** A small invertible toy permutation standing in for AES encryption. */
export function toyEncrypt(block: bigint, key: number): bigint {
    let z = (block ^ roundKey(key)) & MASK;
    z = rotl(z, 13 + (key & 7));
    z = (z * MUL) & MASK;
    return (z ^ CONST) & MASK;
}

/** Inverse of the toy permutation. */
export function toyDecrypt(block: bigint, key: number): bigint {
    let z = (block ^ CONST) & MASK;
    z = (z * oddInverse(MUL)) & MASK;
    z = rotr(z, 13 + (key & 7));
    return (z ^ roundKey(key)) & MASK;
}

/** Multiply the tweak by x in the toy 128-bit field. */
export function doubleTweak(tweak: bigint): bigint {
    const high = (tweak >> 127n) & 1n;
    return (((tweak << 1n) & MASK) ^ (high ? REDUCE : 0n)) & MASK;
}

/** Convert up to sixteen bytes to a big-endian block. */
export function bytesToBlock(bytes: number[]): bigint {
    let value = 0n;
    for (let i = 0; i < 16; i += 1) {
        value = (value << 8n) | BigInt(bytes[i] ?? 0 & 0xff);
    }
    return value & MASK;
}

/** Expand a block into sixteen bytes. */
export function blockToBytes(block: bigint): number[] {
    const out: number[] = [];
    for (let i = 15; i >= 0; i -= 1) {
        out.push(Number((block >> BigInt(8 * i)) & 0xffn));
    }
    return out;
}

function splitBlocks(data: number[]): bigint[] {
    const blocks: bigint[] = [];
    for (let i = 0; i < data.length; i += 16) {
        blocks.push(bytesToBlock(data.slice(i, i + 16)));
    }
    return blocks;
}

function joinBlocks(blocks: bigint[]): number[] {
    const out: number[] = [];
    for (const block of blocks) {
        out.push(...blockToBytes(block));
    }
    return out;
}

/** XTS encryption with a fixed initial tweak. */
export function xtsEncrypt(plaintext: number[], key1: number, key2: number, initialTweak: bigint): number[] {
    let tweak = toyEncrypt(initialTweak, key2);
    const out: number[] = [];
    for (const block of splitBlocks(plaintext)) {
        out.push(...blockToBytes(toyEncrypt(block ^ tweak, key1) ^ tweak));
        tweak = doubleTweak(tweak);
    }
    return out;
}

/** XTS decryption: XOR the tweak, invert the block, XOR the tweak again. */
export function xtsDecrypt(ciphertext: number[], key1: number, key2: number, initialTweak: bigint): number[] {
    let tweak = toyEncrypt(initialTweak, key2);
    const out: number[] = [];
    for (const block of splitBlocks(ciphertext)) {
        out.push(...blockToBytes(toyDecrypt(block ^ tweak, key1) ^ tweak));
        tweak = doubleTweak(tweak);
    }
    return out;
}

function rowCells(row: number, bytes: number[], state: EntityState): VisualEntity[] {
    return Array.from({ length: 16 }, (_, col) => {
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
    const task = (input as { plaintext?: number[]; key1?: number; key2?: number; tweak?: number } | null) ?? {};
    const plaintext = Array.isArray(task.plaintext) ? task.plaintext : [72, 105, 33, 42, 68, 69, 83, 33];
    const key1 = typeof task.key1 === "number" ? task.key1 & 0xff : 0x31;
    const key2 = typeof task.key2 === "number" ? task.key2 & 0xff : 0x7c;
    const tweak = BigInt((typeof task.tweak === "number" ? task.tweak : 5) >>> 0);

    const blocks = splitBlocks(plaintext);
    const ciphertext = xtsEncrypt(plaintext, key1, key2, tweak);
    let currentTweak = toyEncrypt(tweak, key2);
    let step = 0;

    const frame = (index: number, description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: [
            ...rowCells(0, index >= 0 ? blockToBytes(blocks[Math.min(index, blocks.length - 1)] ?? 0n) : [], index >= 0 ? "active" : "unvisited"),
            ...rowCells(1, blockToBytes(currentTweak), "pivot"),
            ...rowCells(2, index >= 0 ? ciphertext.slice(index * 16, index * 16 + 16) : [], index >= 0 ? "sorted" : "unvisited"),
        ],
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows: 3,
            cols: 16,
            key1,
            key2,
            tweak: tweak.toString(16),
            blocks: blocks.length,
            ciphertext: ciphertext.map((b) => b.toString(16).padStart(2, "0")).join(""),
            roundTripOk: xtsDecrypt(ciphertext, key1, key2, tweak).every((b, i) => b === (plaintext[i] ?? 0)),
        },
    });

    yield frame(-1, "Encrypt the initial tweak with the second key.", 0);
    for (let i = 0; i < blocks.length; i += 1) {
        yield frame(i, `Block ${i + 1}: XOR the tweak, encrypt with key one, then XOR the tweak again.`, 1);
        currentTweak = doubleTweak(currentTweak);
    }
    yield frame(blocks.length - 1, `All ${blocks.length} block(s) encrypted; XTS decryption recovers the plaintext.`, 2);
}

const module: AlgorithmModule = {
    id: "aes-xts",
    name: "XTS Tweakable Mode (Toy Block Cipher)",
    category: "cryptography-security",
    complexity: { time: "O(L)", space: "O(L)" },
    defaultInput: { plaintext: [72, 105, 33, 42, 68, 69, 83, 33], key1: 49, key2: 124, tweak: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "T ← encrypt the sector tweak with key two",
        "for each plaintext block P: C ← encrypt(P xor T) with key one, then xor T",
        "T ← T multiplied by x in the field",
        "move to the next block",
        "decryption applies the inverse block encryption in the same tweak order",
        "done: output the ciphertext and the recovered-plaintext check",
    ],
    education: {
        intuition:
            "Disk encryption must hide whether two sectors contain the same data, yet it cannot expand the data and must allow random access. XTS solves this by deriving a per-block tweak from the sector number: each block is XORed with a secret tweak before and after encryption, so the same plaintext at different positions produces different ciphertext, and any block can be decrypted on its own.",
        invariants: [
            "The tweak for block i is the encrypted initial tweak multiplied by x exactly i times.",
            "Each block is encrypted independently, so XTS supports random access.",
            "Decryption applies the same tweak sequence and the inverse block permutation.",
        ],
        correctness:
            "For block i, encryption computes C = E_K(P xor T_i) xor T_i. Decryption computes D_K(C xor T_i) xor T_i = (P xor T_i) xor T_i = P because D_K inverts E_K. Using the same deterministic tweak sequence in both directions guarantees that every block decrypts to its original plaintext.",
        complexityRationale:
            "One toy block encryption plus two XORs are done per block, so encryption and decryption are O(L) in the number of blocks and need O(L) space to hold the output bytes.",
        uses: [
            "Full-disk and partition encryption in IEEE 1619 compliant tools",
            "Encrypted filesystems that require random-access reads",
            "Teaching tweakable block ciphers and codebook-mode pitfalls",
        ],
        references: [
            "NIST Special Publication 800-38E, XTS-AES Mode, 2010",
            "IEEE Standard 1619, Standard for Cryptographic Protection of Data on Block-Oriented Storage Devices",
        ],
        workedExample:
            "With keys 49 and 124 and tweak 5, the tool first encrypts the tweak with key two. For the 8-byte plaintext Hi!*DES! it pads one 16-byte block, XORs the tweak, applies the toy permutation with key one, XORs the tweak again, and the final frame confirms that decryption returns the original bytes.",
    },
};

export default module;
