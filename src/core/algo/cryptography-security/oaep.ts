/**
 * oaep.ts - RSA-OAEP Padding Scheme (Teaching Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * OAEP (Optimal Asymmetric Encryption Padding) turns a short message into a
 * full-length randomized block before RSA encrypts it. The message is masked
 * by a mask generated from a random seed, and the seed is masked by a mask
 * generated from the masked message. Decoding reverses both steps and rejects
 * any block whose label hash or separator does not check out. This module
 * implements the EME-OAEP padding with a tiny FNV hash and a simplified mask
 * function; it is a structural toy, not a cryptographically secure scheme.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for an encoded block of k bytes
 *   Space: O(k) for the data block and its masks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the data block, the two masks and the final encoded block.
 *   - The active phase is highlighted.
 *   - meta carries the encoded bytes, validity flag and recovered message.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const H_LEN = 4;

/** FNV-1a 32-bit hash returned as four big-endian bytes (toy hash). */
export function fnvHash(bytes: number[]): number[] {
    let hash = 0x811c9dc5;
    for (const byte of bytes) {
        hash ^= byte & 0xff;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return [(hash >>> 24) & 0xff, (hash >>> 16) & 0xff, (hash >>> 8) & 0xff, hash & 0xff];
}

/** Simplified MGF1: hash(seed plus a four-byte counter) until length bytes. */
export function mgf1(seed: number[], length: number): number[] {
    const out: number[] = [];
    let counter = 0;
    while (out.length < length) {
        const c = [ (counter >>> 24) & 0xff, (counter >>> 16) & 0xff, (counter >>> 8) & 0xff, counter & 0xff ];
        out.push(...fnvHash([...seed, ...c]));
        counter += 1;
    }
    return out.slice(0, length);
}

function xor(a: number[], b: number[]): number[] {
    return a.map((value, i) => (value ^ (b[i] ?? 0)) & 0xff);
}

/** EME-OAEP encode returning the data block, masks and encoded block. */
export function oaepEncode(message: number[], k: number, seed: number[]): {
    db: number[]; dbMask: number[]; seedMask: number[]; em: number[];
} {
    const lHash = fnvHash([]);
    const psLength = k - message.length - 2 * H_LEN - 2;
    if (psLength < 0) throw new Error("message too long for the encoded block");
    const ps = new Array<number>(psLength).fill(0);
    const db = [...lHash, ...ps, 0x01, ...message];
    const dbMask = mgf1(seed, k - H_LEN - 1);
    const maskedDb = xor(db, dbMask);
    const seedMask = mgf1(maskedDb, H_LEN);
    const maskedSeed = xor(seed, seedMask);
    return { db, dbMask, seedMask, em: [0x00, ...maskedSeed, ...maskedDb] };
}

/** EME-OAEP decode: returns validity and the recovered message bytes. */
export function oaepDecode(em: number[], k: number): { valid: boolean; message: number[] } {
    if (em.length !== k || em[0] !== 0x00) return { valid: false, message: [] };
    const maskedSeed = em.slice(1, 1 + H_LEN);
    const maskedDb = em.slice(1 + H_LEN);
    const seed = xor(maskedSeed, mgf1(maskedDb, H_LEN));
    const db = xor(maskedDb, mgf1(seed, k - H_LEN - 1));
    const lHash = fnvHash([]);
    for (let i = 0; i < H_LEN; i += 1) {
        if (db[i] !== lHash[i]) return { valid: false, message: [] };
    }
    let index = H_LEN;
    while (index < db.length && db[index] === 0) index += 1;
    if (index >= db.length || db[index] !== 0x01) return { valid: false, message: [] };
    return { valid: true, message: db.slice(index + 1) };
}

function hex(bytes: number[]): string {
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function stateBars(bytes: number[], active: number, done: boolean): VisualEntity[] {
    return bytes.map((byte, index) => ({
        id: `byte-${index}`,
        type: "bar" as const,
        label: `b${index}=${byte.toString(16).padStart(2, "0")}`,
        value: byte,
        state: (done ? "sorted" : index === active ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, byte },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: string; k?: number; seed?: number } | null) ?? {};
    const message = String(task.message ?? "hi");
    const bytes = Array.from(new TextEncoder().encode(message));
    const k = Math.max(2 * H_LEN + 2 + bytes.length, Math.min(64, Math.floor(Number(task.k ?? 24)) || 24));
    const seedValue = Math.max(0, Math.floor(Number(task.seed ?? 12345)) || 0);
    const seed = [0, 1, 2, 3].map((i) => (seedValue >>> (8 * i)) & 0xff);

    const encoded = oaepEncode(bytes, k, seed);
    const decoded = oaepDecode(encoded.em, k);
    const recovered = new TextDecoder().decode(new Uint8Array(decoded.message));

    let step = 0;
    yield {
        stepNumber: step,
        entities: stateBars(encoded.db, 0, false),
        edges: [],
        description: `OAEP toy: build the data block from a four-byte label hash, zero padding, a separator and ${bytes.length} message byte(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { k, hLen: H_LEN, message, encoded: "", valid: false, recovered: "" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: stateBars(encoded.dbMask, 1, false),
        edges: [],
        description: `Mask the data block with MGF of the seed to obtain the masked data block.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { k, hLen: H_LEN, message, encoded: "", valid: false, recovered: "" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: stateBars(encoded.seedMask, 2, false),
        edges: [],
        description: `Mask the seed with MGF of the masked data block.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { k, hLen: H_LEN, message, encoded: "", valid: false, recovered: "" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: stateBars(encoded.em, 3, false),
        edges: [],
        description: `Encoded block EM of ${encoded.em.length} bytes: a leading zero, the masked seed, then the masked data block.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { k, hLen: H_LEN, message, encoded: hex(encoded.em), valid: false, recovered: "" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: stateBars(decoded.message.length > 0 ? decoded.message : encoded.em, 4, true),
        edges: [],
        description: `Decode recovered "${recovered}" with validity ${decoded.valid}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { k, hLen: H_LEN, message, encoded: hex(encoded.em), valid: decoded.valid, recovered },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "First hide the message behind a mask derived from a random seed. Then hide the seed behind a mask derived from the hidden message, so neither can be read without the other. The receiver undoes one mask to reveal the seed, uses it to undo the other, and checks a label hash to detect tampering.",
        invariants: [
            "The encoded block always has exactly k bytes and begins with a zero byte.",
            "The data block combines a label hash, zero padding, a single 0x01 byte and the message.",
            "Decoding succeeds only when both masks reverse cleanly and the label hash matches.",
        ],
        correctness:
            "Mask generation is deterministic, so xoring the same mask twice restores the original bytes. Decoding recomputes the seed mask from the masked data block, recovers the seed, then recomputes the data mask and checks the stored label hash and separator. Any changed byte breaks one of those checks, so tampering is detected with overwhelming probability in the real scheme.",
        complexityRationale:
            "The data block, both masks and the encoded block each have length proportional to k, so encoding and decoding are linear in k. All work is in place over byte arrays, giving linear space.",
        uses: [
            "A teaching model of RSA encryption padding",
            "Understanding chosen-ciphertext security and tamper detection",
            "A stepping stone to real OAEP with SHA and RSA",
        ],
        references: [
            "Bellare and Rogaway, Optimal Asymmetric Encryption, 1995",
            "RFC 8017, PKCS #1, Section 7.1 (RSAES-OAEP)",
        ],
        workedExample:
            "With k=24 and message hi, the data block is a four-byte label hash, ten zero bytes, the separator 0x01 and the two bytes hi. Masking it with MGF(seed) and masking the seed with MGF(masked data) yields a 24-byte block starting with zero. Decoding reverses both masks and recovers hi.",
    },
    id: "oaep",
    name: "OAEP Padding (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { message: "hi", k: 24, seed: 12345 },
    visualType: "array",
    run,
    pseudocode: [
        "build the data block from label hash, zeros, a separator and the message",
        "generate a data mask from the random seed",
        "xor the data block with the data mask",
        "generate a seed mask from the masked data block",
        "xor the seed with the seed mask",
        "prepend a zero byte to form the encoded block",
        "on decode reverse both masks and verify the label hash and separator",
        "report the recovered message and whether decoding succeeded",
    ],
};

export default module;
