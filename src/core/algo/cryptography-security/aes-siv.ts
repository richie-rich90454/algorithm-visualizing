/**
 * aes-siv.ts - SIV-Style Deterministic Authenticated Encryption (Toy Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AES-SIV is deterministic authenticated encryption: the same plaintext and
 * associated data always give the same ciphertext, which makes it useful for
 * key wrapping and for deduplicating encrypted records. It first derives a
 * synthetic initialization vector by applying a CMAC-style construction to
 * the vector of associated data followed by the plaintext, then uses that IV
 * as a counter-mode nonce. Decryption recovers the plaintext, recomputes the
 * IV, and accepts only an exact match. This module keeps the S2V and CTR
 * structure but replaces AES with an invertible toy permutation, so it is a
 * teaching model and provides no real security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(L) block operations in the message and associated data
 *   Space: O(L) for the ciphertext buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Rows show the synthetic IV, the plaintext block, and the ciphertext.
 *   - The synthetic IV is highlighted when the associated data is bound to it.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MASK = (1n << 128n) - 1n;
const MUL = 0x9e3779b97f4a7c15n;
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

export function toyEncrypt(block: bigint, key: number): bigint {
    let z = (block ^ roundKey(key)) & MASK;
    z = rotl(z, 9 + (key & 7));
    z = (z * MUL) & MASK;
    return (z ^ 0x6a09e667f3bcc909n) & MASK;
}

export function toyDecrypt(block: bigint, key: number): bigint {
    let z = (block ^ 0x6a09e667f3bcc909n) & MASK;
    z = (z * oddInverse(MUL)) & MASK;
    z = rotr(z, 9 + (key & 7));
    return (z ^ roundKey(key)) & MASK;
}

/** Double a 128-bit block in the toy field. */
export function gfDouble(value: bigint): bigint {
    const high = (value >> 127n) & 1n;
    return ((((value & MASK) << 1n) & MASK) ^ (high ? REDUCE : 0n)) & MASK;
}

function bytesToBlock(bytes: number[]): bigint {
    let value = 0n;
    for (let i = 0; i < 16; i += 1) {
        value = (value << 8n) | BigInt(bytes[i] ?? 0 & 0xff);
    }
    return value & MASK;
}

function blockToBytes(block: bigint): number[] {
    const out: number[] = [];
    for (let i = 15; i >= 0; i -= 1) {
        out.push(Number((block >> BigInt(8 * i)) & 0xffn));
    }
    return out;
}

/** CMAC-style authentication of one byte string. */
export function vectorMac(data: number[], key: number): bigint {
    const l = toyEncrypt(0n, key);
    const k1 = gfDouble(l);
    const k2 = gfDouble(k1);
    const padded = [...data];
    let complete = padded.length > 0 && padded.length % 16 === 0;
    if (padded.length === 0 || padded.length % 16 !== 0) {
        padded.push(0x80);
        while (padded.length % 16 !== 0) {
            padded.push(0);
        }
        complete = false;
    }
    let x = 0n;
    for (let i = 0; i < padded.length; i += 16) {
        const block = bytesToBlock(padded.slice(i, i + 16));
        const last = i + 16 === padded.length;
        x = toyEncrypt(x ^ block ^ (last ? (complete ? k1 : k2) : 0n), key);
    }
    return x;
}

/** S2V-style synthetic IV binding all associated data and the plaintext. */
export function syntheticIv(associatedData: number[][], plaintext: number[], key: number): bigint {
    let d = toyEncrypt(0n, key);
    for (const field of associatedData) {
        d = gfDouble(d) ^ vectorMac(field, key);
    }
    const last = vectorMac(plaintext, key);
    return (gfDouble(d) ^ last) & MASK;
}

function ctrCrypt(data: number[], iv: bigint, key: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < data.length; i += 16) {
        const stream = blockToBytes(toyEncrypt((iv + BigInt(i / 16 + 1)) & MASK, key));
        for (let j = 0; j < 16 && i + j < data.length; j += 1) {
            out.push((data[i + j] ?? 0) ^ (stream[j] ?? 0));
        }
    }
    return out;
}

export interface SivResult {
    iv: bigint;
    ciphertext: number[];
}

export function sivEncrypt(plaintext: number[], associatedData: number[][], key: number): SivResult {
    const iv = syntheticIv(associatedData, plaintext, key);
    return { iv, ciphertext: ctrCrypt(plaintext, iv, key) };
}

export function sivDecrypt(ciphertext: number[], associatedData: number[][], key: number, iv: bigint): { plaintext: number[]; authentic: boolean } {
    const plaintext = ctrCrypt(ciphertext, iv, key);
    const recomputed = syntheticIv(associatedData, plaintext, key);
    return { plaintext, authentic: recomputed === iv };
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
    const task = (input as { plaintext?: number[]; associatedData?: number[][]; key?: number } | null) ?? {};
    const plaintext = Array.isArray(task.plaintext) ? task.plaintext : [72, 105, 33, 42];
    const associatedData = Array.isArray(task.associatedData) ? task.associatedData : [[1, 2, 3], [9, 8]];
    const key = typeof task.key === "number" ? task.key & 0xff : 61;

    const result = sivEncrypt(plaintext, associatedData, key);
    const check = sivDecrypt(result.ciphertext, associatedData, key, result.iv);
    let step = 0;

    const frame = (phase: number, description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: [
            ...rowCells(0, blockToBytes(result.iv), phase === 0 ? "active" : "pivot"),
            ...rowCells(1, phase >= 1 ? plaintext : [], phase >= 1 ? "unvisited" : "idle"),
            ...rowCells(2, phase >= 1 ? result.ciphertext : [], phase >= 1 ? "sorted" : "unvisited"),
        ],
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows: 3,
            cols: 16,
            key,
            adFields: associatedData.length,
            iv: result.iv.toString(16).toUpperCase().padStart(32, "0"),
            ciphertext: result.ciphertext.map((b) => b.toString(16).padStart(2, "0")).join(""),
            authentic: check.authentic,
        },
    });

    yield frame(0, "Bind every associated-data field and the plaintext into the synthetic IV.", 0);
    yield frame(1, "Encrypt the plaintext in counter mode using the synthetic IV as the nonce.", 1);
    yield frame(2, `Decrypt and recompute the IV: ${check.authentic ? "the tag matches, accepting" : "the tag differs, rejecting"}.`, 2);
}

const module: AlgorithmModule = {
    id: "aes-siv",
    name: "SIV Deterministic Encryption (Toy Core)",
    category: "cryptography-security",
    complexity: { time: "O(L)", space: "O(L)" },
    defaultInput: { plaintext: [72, 105, 33, 42], associatedData: [[1, 2, 3], [9, 8]], key: 61 },
    visualType: "grid",
    run,
    pseudocode: [
        "D ← encrypt the zero block with the key",
        "for each associated-data field: D ← double(D) xor CMAC(field)",
        "synthetic IV ← double(D) xor CMAC(plaintext)",
        "ciphertext ← plaintext xor the counter-mode keystream from the synthetic IV",
        "decryption recovers the plaintext from the same keystream",
        "recompute the synthetic IV and accept only an exact match",
        "done: output the synthetic IV and ciphertext",
    ],
    education: {
        intuition:
            "Most authenticated encryption schemes use a random nonce, but some applications need the same input to produce the same output so that duplicates can be detected. SIV solves this by deriving the nonce from the message itself. The derived IV is a fingerprint of the plaintext and all associated data, so changing either one changes the ciphertext and makes tampering detectable.",
        invariants: [
            "The synthetic IV is a deterministic function of the key, associated data, and plaintext.",
            "The counter-mode keystream depends only on the synthetic IV and the key.",
            "A valid decryption reproduces exactly the IV stored with the ciphertext.",
        ],
        correctness:
            "CTR decryption inverts CTR encryption because XOR with the same keystream twice is the identity. The recomputed IV equals the transmitted IV whenever the plaintext and every associated-data field are unchanged; a modification to any of them changes a CMAC output, which changes the IV with overwhelming probability, so the authenticity check rejects forgeries.",
        complexityRationale:
            "Computing the IV scans the associated data and plaintext once with CMAC, and CTR encryption scans the plaintext once, so both directions take O(L) block operations and O(L) output space.",
        uses: [
            "Deterministic key wrapping where duplicates must be visible",
            "Encrypted database records that need deterministic lookup",
            "Teaching nonce misuse resistance and deterministic AE",
        ],
        references: [
            "RFC 5297, Synthetic Initialization Vector (SIV) Authenticated Encryption",
            "Rogaway and Shrimpton, Deterministic Authenticated-Encryption, EUROCRYPT 2006",
        ],
        workedExample:
            "With plaintext Hi!*, associated-data fields 010203 and 0908, and key 61, the tool folds each field into the chain D, XORs the plaintext CMAC to get a 128-bit synthetic IV, encrypts four bytes with the counter keystream, then decrypts and confirms the recomputed IV matches.",
    },
};

export default module;
