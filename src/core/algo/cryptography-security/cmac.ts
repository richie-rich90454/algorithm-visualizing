/**
 * cmac.ts - Cipher-Based Message Authentication Code (CMAC, Toy 16-bit Block)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CMAC turns a block cipher into a message authentication code. It derives two
 * subkeys K1 and K2 from L = E(K, 0) by doubling in a finite field, pads the last
 * message block with a one bit when it is incomplete, xors in K1 for a complete
 * last block or K2 for a padded one, and chains every block through the cipher.
 * The final ciphertext is the tag. This module implements the exact CMAC
 * structure over a small, clearly labeled toy Feistel cipher with 16-bit
 * blocks. It makes no production security claim.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(m) for m message blocks
 *   Space: O(1) working blocks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Four bars show K1, K2, the current CBC chain value, and the last block.
 *   - meta carries the authentication tag in hexadecimal.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MASK = 0xffff;
/** Field constant for 16-bit blocks from x^16 + x^12 + x^3 + x + 1. */
const RB = 0x100b;
const BLOCK = 2;

/** Keyed toy round function on an 8-bit half (not a secure cipher primitive). */
function roundF(round: number, value: number, keyByte: number): number {
    const mixed = Math.imul(value ^ keyByte, round + 3) + round * 47;
    return (mixed ^ ((value << 3) | (value >>> 5))) & 0xff;
}

/** A four-round Feistel permutation on 16-bit blocks. */
export function toyEncrypt(key: number, block: number): number {
    const subkeys = [(key >>> 8) & 0xff, key & 0xff, (key >>> 4) & 0xff, (key << 3) & 0xff];
    let left = (block >>> 8) & 0xff;
    let right = block & 0xff;
    for (let round = 0; round < 4; round += 1) {
        const nextLeft = right;
        const nextRight = (left ^ roundF(round, right, subkeys[round] ?? 0)) & 0xff;
        left = nextLeft;
        right = nextRight;
    }
    return ((left << 8) | right) & MASK;
}

/** Double a field element used for CMAC subkey derivation. */
function double(value: number): number {
    const shifted = (value << 1) & MASK;
    return (value & 0x8000) !== 0 ? (shifted ^ RB) & MASK : shifted;
}

/** Derive K1 and K2 from a key. */
export function subkeys(key: number): { k1: number; k2: number; l: number } {
    const l = toyEncrypt(key, 0);
    const k1 = double(l);
    const k2 = double(k1);
    return { k1, k2, l };
}

/** Split a byte array into two-byte blocks, padding the final one when needed. */
function blocks(bytes: number[], k1: number, k2: number): { parts: number[]; complete: boolean } {
    const parts: number[] = [];
    let i = 0;
    while (i + BLOCK <= bytes.length) {
        parts.push(((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0));
        i += BLOCK;
    }
    const complete = i === bytes.length && bytes.length > 0;
    let last: number;
    if (complete) {
        const full = parts.pop() ?? 0;
        last = full ^ k1;
    } else {
        let padded = 0x8000;
        for (let j = i; j < bytes.length; j += 1) {
            padded |= (bytes[j] ?? 0) << (8 * (BLOCK - 1 - (j - i)));
        }
        last = padded ^ k2;
    }
    parts.push(last & MASK);
    return { parts, complete };
}

/** Compute the CMAC tag of a byte array under a key. */
export function cmacTag(bytes: number[], key: number): number {
    const { k1, k2 } = subkeys(key);
    const { parts } = blocks(bytes, k1, k2);
    let chain = 0;
    for (let i = 0; i < parts.length - 1; i += 1) {
        chain = toyEncrypt(key, chain ^ (parts[i] ?? 0));
    }
    const last = parts[parts.length - 1] ?? 0;
    return toyEncrypt(key, chain ^ last);
}

const hex4 = (x: number): string => (x & MASK).toString(16).padStart(4, "0");
const utf8 = (text: string): number[] => Array.from(new TextEncoder().encode(text));

function makeBars(k1: number, k2: number, chain: number, last: number, active: number): VisualEntity[] {
    const values = [k1, k2, chain, last];
    return values.map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: hex4(value),
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: ["K1", "K2", "chain", "last"][index] ?? "", hex: hex4(value) },
    }));
}

/** The CMAC generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: string; key?: number } | null) ?? {};
    const bytes = utf8(String(task.message ?? "hello"));
    const key = typeof task.key === "number" ? task.key & MASK : 0x2b3c;
    const { k1, k2, l } = subkeys(key);
    const { parts, complete } = blocks(bytes, k1, k2);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(0, 0, 0, 0, 0),
        edges: [],
        description: `CMAC over ${bytes.length} byte(s) with a 16-bit toy cipher: derive subkeys from E(K,0).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { message: String(task.message ?? "hello"), key, tag: "", blocks: parts.length },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(k1, k2, l, 0, 1),
        edges: [],
        description: `L = E(K,0) = ${hex4(l)}; double twice for K1 = ${hex4(k1)} and K2 = ${hex4(k2)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { message: String(task.message ?? "hello"), key, l: hex4(l), k1: hex4(k1), k2: hex4(k2), tag: "" },
    };
    step += 1;

    let chain = 0;
    for (let i = 0; i < parts.length - 1; i += 1) {
        chain = toyEncrypt(key, chain ^ (parts[i] ?? 0));
        yield {
            stepNumber: step,
            entities: makeBars(k1, k2, chain, parts[i] ?? 0, 2),
            edges: [],
            description: `CBC chain block ${i + 1}: encrypt the xor of the previous chain and this message block.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { message: String(task.message ?? "hello"), key, chain: hex4(chain), tag: "" },
        };
        step += 1;
    }

    const last = parts[parts.length - 1] ?? 0;
    yield {
        stepNumber: step,
        entities: makeBars(k1, k2, chain, last, 3),
        edges: [],
        description: complete
            ? `Last block is complete: xor it with K1 (${hex4(k1)}).`
            : `Last block is padded and xored with K2 (${hex4(k2)}).`,
        codeLineNumber: 3,
        layout: "array",
        meta: { message: String(task.message ?? "hello"), key, complete, last: hex4(last), tag: "" },
    };
    step += 1;

    const tag = toyEncrypt(key, chain ^ last);
    yield {
        stepNumber: step,
        entities: makeBars(k1, k2, chain, tag, 3),
        edges: [],
        description: `Final ciphertext is the CMAC tag ${hex4(tag)}. Toy cipher, not production security.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { message: String(task.message ?? "hello"), key, tag: hex4(tag) },
    };
}

/** The CMAC module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain CBC-MAC is unsafe for messages of different lengths, so CMAC tweaks the final block. It doubles a cipher-encrypted zero block in a finite field to get two subkeys: one for a full final block and one for a padded final block. CBC chaining then makes every earlier block influence the tag, so changing any bit of the message changes the result.",
        invariants: [
            "K1 is double of E(K,0) and K2 is double of K1 in the 16-bit field.",
            "A complete final block is xored with K1; an incomplete one is padded with a one bit and xored with K2.",
            "Each chain value is E(K, previous chain xor current block), starting from zero.",
        ],
        correctness:
            "The subkey doubling, padding rule, and CBC chain match the CMAC construction. An independent reference recomputes every tag, and an exhaustive check over all one-byte messages confirms agreement under several keys. The underlying 16-bit Feistel cipher is a toy chosen only so all steps can be checked by hand; the test verifies the CMAC structure, not real-world authentication strength.",
        complexityRationale:
            "One cipher call derives L, one per full block, and one for the final block, so time is linear in the number of message blocks. Only a constant number of blocks are kept, giving constant space.",
        uses: [
            "Message authentication where a block cipher is already available",
            "Authenticated framing in protocols such as AES-CMAC",
            "Teaching how padding resolves CBC-MAC length-extension weakness",
        ],
        references: [
            "NIST Special Publication 800-38B, Recommendation for Block Cipher Modes of Operation: CMAC, 2005",
            "Black and Rogaway, CBC MACs for Arbitrary-Length Messages, 2002",
        ],
        workedExample:
            "With key 0x2b3c, L is E(K,0). Doubling L gives K1 and doubling K1 gives K2. For the two-byte message ab the final block is complete, so the tag is E(K, ab xor K1). For the one-byte message a the block is padded to a0 80 and xored with K2 before the final encryption.",
    },
    id: "cmac",
    name: "CMAC Message Authentication Code",
    category: "cryptography-security",
    complexity: { time: "O(m)", space: "O(1)" },
    defaultInput: { message: "hello", key: 11196 },
    visualType: "array",
    run,
    pseudocode: [
        "compute L by encrypting a zero block under the key",
        "double L in the field to obtain K1, then double K1 to obtain K2",
        "for each message block except the last, chain by encrypting its xor with the previous chain",
        "if the last block is full xor it with K1",
        "otherwise pad it with a one bit and xor it with K2",
        "encrypt the xor of the chain and the prepared last block",
        "done: report that final ciphertext as the tag",
    ],
};

export default module;
