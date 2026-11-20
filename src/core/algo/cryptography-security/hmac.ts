/**
 * hmac.ts - Hash-Based Message Authentication Code (Toy Hash)
 *
 * TEACHING MODEL, NOT PRODUCTION SECURITY. The construction is the real HMAC
 * recipe with ipad/opad and an inner and outer hash, but the hash is a small
 * 32-bit FNV-1a stand-in instead of SHA-256. The exact steps are computed.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const BLOCK = 8;

function hash(bytes: number[]): number {
    let acc = 2166136261;
    for (const byte of bytes) {
        acc = Math.imul(acc ^ byte, 16777619) >>> 0;
    }
    return acc >>> 0;
}

function toBytes(text: string): number[] {
    return [...text].map((char) => char.charCodeAt(0) & 0xff);
}

function fromInt(value: number): number[] {
    return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function hex(bytes: number[]): string {
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hmac(key: string, message: string): { mac: number; inner: number; keyBlock: number[]; ipad: number[]; opad: number[]; msg: number[] } {
    let keyBytes = toBytes(key);
    if (keyBytes.length > BLOCK) {
        keyBytes = fromInt(hash(keyBytes));
    }
    const keyBlock = new Array<number>(BLOCK).fill(0);
    keyBytes.forEach((byte, i) => {
        keyBlock[i] = byte;
    });
    const ipad = keyBlock.map((b) => b ^ 0x36);
    const opad = keyBlock.map((b) => b ^ 0x5c);
    const msg = toBytes(message);
    const inner = hash([...ipad, ...msg]);
    const mac = hash([...opad, ...fromInt(inner)]);
    return { mac, inner, keyBlock, ipad, opad, msg };
}

function makeCells(
    ipad: number[],
    msg: number[],
    innerBytes: number[],
    opad: number[],
    cols: number,
    phase: number,
): VisualEntity[] {
    const rows = [ipad, msg, innerBytes, opad];
    const entities: VisualEntity[] = [];
    for (let row = 0; row < rows.length; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const present = col < (rows[row]?.length ?? 0);
            const value = present ? rows[row]?.[col] ?? 0 : -1;
            const state: EntityState =
                row === phase ? "active" : row < phase ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: value < 0 ? "" : value.toString(16).padStart(2, "0"),
                value,
                state,
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
    const task = (input as { key?: string; message?: string } | null) ?? {};
    const key = String(task.key ?? "secret");
    const message = String(task.message ?? "HELLO");
    const result = hmac(key, message);
    const innerBytes = fromInt(result.inner);
    const cols = Math.max(BLOCK, result.msg.length, innerBytes.length);

    yield {
        stepNumber: 0,
        entities: makeCells(result.ipad, result.msg, innerBytes, result.opad, cols, 0),
        edges: [],
        description: `Pad the key to ${BLOCK} bytes and XOR with ipad 0x36: ${hex(result.ipad)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 4, cols, phase: "ipad", mac: hex(fromInt(result.mac)), keyLen: toBytes(key).length, msgLen: result.msg.length },
    };
    yield {
        stepNumber: 1,
        entities: makeCells(result.ipad, result.msg, innerBytes, result.opad, cols, 1),
        edges: [],
        description: `Append the message and hash it for the inner digest: ${hex(innerBytes)}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: 4, cols, phase: "inner", mac: hex(fromInt(result.mac)), inner: hex(innerBytes), keyLen: toBytes(key).length, msgLen: result.msg.length },
    };
    yield {
        stepNumber: 2,
        entities: makeCells(result.ipad, result.msg, innerBytes, result.opad, cols, 3),
        edges: [],
        description: `XOR the key block with opad 0x5c: ${hex(result.opad)}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: 4, cols, phase: "opad", mac: hex(fromInt(result.mac)), keyLen: toBytes(key).length, msgLen: result.msg.length },
    };
    yield {
        stepNumber: 3,
        entities: makeCells(result.ipad, result.msg, innerBytes, result.opad, cols, 2),
        edges: [],
        description: `Hash opad together with the inner digest to get the MAC: ${hex(fromInt(result.mac))}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 4, cols, phase: "mac", mac: hex(fromInt(result.mac)), inner: hex(innerBytes), keyLen: toBytes(key).length, msgLen: result.msg.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A message authentication code proves that a message has not been changed and came from someone who knows the secret key. HMAC mixes the key with the message in two passes using different padding constants, which protects it against weaknesses in the underlying hash function.",
        invariants: [
            "The key is padded or hashed to exactly one hash block before use.",
            "The inner pass XORs the key with ipad, the outer pass with opad.",
            "The outer hash takes the inner digest as its input.",
        ],
        correctness:
            "HMAC(K, m) = H((K' xor opad) || H((K' xor ipad) || m)), where K' is the key padded to one block. A party that knows K can recompute the same value; an attacker who alters m changes the inner digest and therefore the outer hash. This demo uses a 32-bit FNV-1a stand-in hash to keep every step visible, so it demonstrates the construction and is not secure.",
        complexityRationale:
            "Two hashes over inputs of length block plus the message or digest give O(|key| + |message|) time, and the padded blocks and digests use O(|message|) space.",
        uses: [
            "Authenticated API request signing",
            "Integrity checks in TLS record protocols",
            "Cookie and session token protection",
        ],
        references: [
            "Bellare, Kaneti, and Krawczyk, Cryptographic Message Authentication, 2018",
            "RFC 2104, HMAC: Keyed-Hashing for Message Authentication",
        ],
        workedExample:
            "With key secret and message HELLO, the key is padded to eight bytes, XORed with 0x36 for the inner pass and 0x5c for the outer pass. The inner digest is hashed again with opad to produce the final MAC shown in the last frame.",
    },
    id: "hmac",
    name: "HMAC (Toy Hash Construction)",
    category: "cryptography-security",
    complexity: { time: "O(|key| + |message|)", space: "O(|message|)" },
    defaultInput: { key: "secret", message: "HELLO" },
    visualType: "grid",
    run,
    pseudocode: [
        "pad or hash the key to one block and call it K prime",
        "form the inner pad by XORing K prime with 0x36 bytes",
        "form the outer pad by XORing K prime with 0x5c bytes",
        "hash the inner pad followed by the message",
        "hash the outer pad followed by that inner digest",
        "done: report the final message authentication code",
    ],
};

export default module;
