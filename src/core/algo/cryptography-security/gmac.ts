/**
 * gmac.ts - GMAC Authentication from GHASH (Teaching Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * GMAC is the authentication part of GCM. It hashes the associated data and
 * the ciphertext with GHASH, a polynomial MAC over GF(2^128), and masks the
 * result with a block-cipher encryption of the counter block J0. GHASH is
 * exact here: the carry-less field multiplication uses the GCM reduction
 * polynomial x^128 + x^7 + x^2 + x + 1. The block cipher E_K is replaced by a
 * reproducible invertible toy mixer, so this is a teaching core of GHASH and
 * GMAC, not a production authentication tag. Do not use it to protect data.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(L) field multiplications for L sixteen-byte blocks
 *   Space: O(1) beyond the tag and block buffers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Rows show the hash subkey H, the current block, the GHASH state, and
 *     the final authentication tag.
 *   - The active block is highlighted while its field product is computed.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MASK = (1n << 128n) - 1n;
/** GCM reduction polynomial x^128 + x^7 + x^2 + x + 1. */
const R = 0xe1000000000000000000000000000000n;

/** Carry-less multiplication in GF(2^128), MSB-first, reduced by R. */
export function gfMul(x: bigint, y: bigint): bigint {
    let a = x & MASK;
    let b = y & MASK;
    let result = 0n;
    for (let bit = 127; bit >= 0; bit -= 1) {
        if ((a >> BigInt(bit)) & 1n) {
            result ^= b;
        }
        const lsb = b & 1n;
        b >>= 1n;
        if (lsb) {
            b ^= R;
        }
    }
    return result & MASK;
}

/** A deterministic invertible toy stand-in for the block cipher E_K. */
export function toyBlock(input: bigint, key: number): bigint {
    let z = (input ^ (BigInt(key) * 0x9e3779b97f4a7c15n)) & MASK;
    z = ((z ^ (z >> 33n)) * 0xff51afd7ed558ccdn) & MASK;
    z = ((z ^ (z >> 33n)) * 0xc4ceb9fe1a85ec53n) & MASK;
    return (z ^ (z >> 33n)) & MASK;
}

/** Convert bytes to a big-endian 128-bit block. */
export function bytesToBlock(bytes: number[]): bigint {
    let value = 0n;
    for (let i = 0; i < 16; i += 1) {
        value = (value << 8n) | BigInt(bytes[i] ?? 0 & 0xff);
    }
    return value & MASK;
}

/** Convert a 128-bit block to sixteen bytes. */
export function blockToBytes(block: bigint): number[] {
    const out: number[] = [];
    for (let i = 15; i >= 0; i -= 1) {
        out.push(Number((block >> BigInt(8 * i)) & 0xffn));
    }
    return out;
}

/** Zero-pad raw bytes into a whole number of 128-bit blocks. */
export function padBlocks(data: number[]): bigint[] {
    const blocks: bigint[] = [];
    for (let i = 0; i < data.length; i += 16) {
        blocks.push(bytesToBlock(data.slice(i, i + 16)));
    }
    return blocks;
}

/** GHASH: fold blocks with Y = (Y xor X) * H over GF(2^128). */
export function ghash(h: bigint, blocks: bigint[], init = 0n): bigint {
    let y = init & MASK;
    for (const block of blocks) {
        y = gfMul(y ^ block, h);
    }
    return y;
}

/** The 128-bit length block: bit length of AAD concatenated with ciphertext. */
export function lengthBlock(aadBits: number, cipherBits: number): bigint {
    return (BigInt(aadBits >>> 0) << 64n) | BigInt(cipherBits >>> 0);
}

export interface GmacResult {
    hashSubkey: bigint;
    ghashValue: bigint;
    tag: bigint;
    blocks: bigint[];
}

/** Compute the GHASH subkey, the accumulated hash, and the GMAC tag. */
export function computeGmac(key: number, nonce: number, aad: number[], ciphertext: number[]): GmacResult {
    const hashSubkey = toyBlock(0n, key);
    const j0 = toyBlock(BigInt(nonce >>> 0), key ^ 0x5a);
    const blocks = [...padBlocks(aad), ...padBlocks(ciphertext), lengthBlock(aad.length * 8, ciphertext.length * 8)];
    const ghashValue = ghash(hashSubkey, blocks);
    return { hashSubkey, ghashValue, tag: ghashValue ^ j0, blocks };
}

function hex(block: bigint): string {
    return block.toString(16).toUpperCase().padStart(32, "0");
}

function rowCells(row: number, bytes: number[], state: EntityState, revealed: number): VisualEntity[] {
    return Array.from({ length: 16 }, (_, col) => {
        const value = bytes[col] ?? 0;
        return {
            id: `byte-${row}-${col}`,
            type: "cell" as const,
            label: value.toString(16).toUpperCase().padStart(2, "0"),
            value,
            state: col < revealed ? state : ("unvisited" as EntityState),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { key?: number; nonce?: number; aad?: number[]; ciphertext?: number[] } | null) ?? {};
    const key = typeof task.key === "number" ? task.key & 0xff : 0x2b;
    const nonce = typeof task.nonce === "number" ? task.nonce >>> 0 : 7;
    const aad = Array.isArray(task.aad) ? task.aad : [1, 2, 3, 4];
    const ciphertext = Array.isArray(task.ciphertext) ? task.ciphertext : [9, 8, 7, 6];

    const result = computeGmac(key, nonce, aad, ciphertext);
    const hBytes = blockToBytes(result.hashSubkey);
    const tagBytes = blockToBytes(result.tag);
    let step = 0;
    let state = 0n;

    const frame = (revealedBlock: number, tagRevealed: number, description: string, line: number, active: EntityState): VisualFrame => ({
        stepNumber: step++,
        entities: [
            ...rowCells(0, hBytes, "sorted", 16),
            ...rowCells(1, revealedBlock >= 0 ? blockToBytes(result.blocks[revealedBlock] ?? 0n) : [], active, revealedBlock >= 0 ? 16 : 0),
            ...rowCells(2, blockToBytes(state), "highlight", 16),
            ...rowCells(3, tagBytes, "sorted", tagRevealed),
        ],
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows: 4,
            cols: 16,
            key,
            nonce,
            hashSubkey: hex(result.hashSubkey),
            ghash: hex(result.ghashValue),
            tag: hex(result.tag),
            blocks: result.blocks.length,
            currentBlock: revealedBlock,
        },
    });

    yield frame(-1, 0, "Derive the GHASH subkey H by encrypting the zero block.", 0, "idle");

    for (let i = 0; i < result.blocks.length; i += 1) {
        state = gfMul(state ^ (result.blocks[i] ?? 0n), result.hashSubkey);
        yield frame(i, 0, `Fold block ${i + 1} of ${result.blocks.length} into the GHASH accumulator.`, 1, "active");
    }

    yield frame(result.blocks.length - 1, 16, `Mask the accumulated hash with E_K(J0) to obtain the 128-bit tag ${hex(result.tag)}.`, 2, "sorted");
}

const module: AlgorithmModule = {
    id: "gmac",
    name: "GMAC Message Authentication (GHASH Core)",
    category: "cryptography-security",
    complexity: { time: "O(L)", space: "O(1)" },
    defaultInput: { key: 43, nonce: 7, aad: [1, 2, 3, 4], ciphertext: [9, 8, 7, 6] },
    visualType: "grid",
    run,
    pseudocode: [
        "H ← E_K(0) as the hash subkey",
        "for each AAD block, ciphertext block, and length block X: Y ← (Y xor X) multiplied by H in GF(2^128)",
        "J0 ← E_K(nonce with counter one)",
        "tag ← Y xor E_K(J0)",
        "transmit the tag with the ciphertext",
        "verifier recomputes the tag from the received data",
        "accept only when the two tags are identical",
    ],
    education: {
        intuition:
            "GMAC authenticates a message by treating the data as coefficients of a polynomial evaluated at a secret point H. A clever receiver cannot change the message without changing the polynomial value, unless it guesses H. The final value is hidden by XORing it with an encrypted counter block.",
        invariants: [
            "GHASH processes exactly one 128-bit block at a time, padding partial blocks with zeros.",
            "After each block, the accumulator is (previous accumulator xor block) multiplied by H in GF(2^128).",
            "The tag is the accumulator XORed with E_K(J0), so only parties with the key can reproduce it.",
        ],
        correctness:
            "Polynomial evaluation is linear over the message blocks: for a fixed H, GHASH of the XOR of two equal-length messages equals the XOR of their GHASH values. An adversary who changes a block must find a nonzero difference polynomial that evaluates to zero at H; for a random H this succeeds with probability at most L/2^128 over L blocks, which is the standard GHASH forgery bound.",
        complexityRationale:
            "Each of the L blocks costs one carry-less 128-bit multiplication, a fixed number of machine operations, so the running time is O(L). Only the accumulator, the subkey, and the tag are kept, giving O(1) auxiliary space.",
        uses: [
            "Authenticated encryption in TLS 1.3 through AES-GCM",
            "IPsec and SSH packet authentication",
            "High-speed network storage integrity checks",
        ],
        references: [
            "NIST Special Publication 800-38D, Galois/Counter Mode, 2007",
            "McGrew and Viega, The Galois/Counter Mode of Operation, 2005",
        ],
        workedExample:
            "With key 43, nonce 7, AAD bytes 01 02 03 04, and ciphertext 09 08 07 06, the tool derives H from the zero block, folds three blocks (AAD, ciphertext, and the length block 00000020 00000020) into the accumulator, then XORs with E_K(J0) to print the final 128-bit tag in hexadecimal.",
    },
};

export default module;
