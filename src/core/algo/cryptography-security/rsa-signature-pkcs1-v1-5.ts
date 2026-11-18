/**
 * rsa-signature-pkcs1-v1-5.ts - Toy RSA Signature with PKCS#1 v1.5 Encoding
 *
 * TEACHING MODEL, NOT PRODUCTION SECURITY. The modulus is tiny and the encoded
 * message is a five-byte stand-in for a real DigestInfo block. The exact step
 * demonstrated is the RSA signature equation s = m^d mod n and its inverse
 * s^e mod n = m, followed by a structure check on the recovered block.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 10007n;
const Q = 10009n;
const N = P * Q;
const PHI = (P - 1n) * (Q - 1n);

function gcd(a: bigint, b: bigint): bigint {
    let x = a;
    let y = b;
    while (y !== 0n) {
        const r = x % y;
        x = y;
        y = r;
    }
    return x;
}

function modInverse(a: bigint, mod: bigint): bigint {
    let [oldR, r] = [a % mod, mod];
    let [oldS, s] = [1n, 0n];
    while (r !== 0n) {
        const q = oldR / r;
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return ((oldS % mod) + mod) % mod;
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    while (e > 0n) {
        if (e % 2n === 1n) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e /= 2n;
    }
    return result;
}

function key(): { e: bigint; d: bigint } {
    let e = 65537n;
    while (gcd(e, PHI) !== 1n) {
        e -= 2n;
    }
    return { e, d: modInverse(e, PHI) };
}

function encodedMessage(digest: number): number[] {
    return [0x00, 0x01, 0xff, 0x00, digest & 0xff];
}

function toInt(bytes: number[]): bigint {
    let value = 0n;
    for (const byte of bytes) {
        value = (value << 8n) | BigInt(byte);
    }
    return value;
}

function toBytes(value: bigint, count: number): number[] {
    const out = new Array<number>(count).fill(0);
    let v = value;
    for (let i = count - 1; i >= 0; i -= 1) {
        out[i] = Number(v & 0xffn);
        v >>= 8n;
    }
    return out;
}

function checkBlock(bytes: number[], expected: number): boolean {
    return (
        bytes.length === 5 &&
        bytes[0] === 0x00 &&
        bytes[1] === 0x01 &&
        bytes[2] === 0xff &&
        bytes[3] === 0x00 &&
        bytes[4] === (expected & 0xff)
    );
}

function makeCells(em: number[], sig: number[], rec: number[], phase: string): VisualEntity[] {
    const rows = [em, sig, rec];
    const entities: VisualEntity[] = [];
    for (let row = 0; row < rows.length; row += 1) {
        for (let col = 0; col < 5; col += 1) {
            const value = rows[row]?.[col] ?? -1;
            const state: EntityState =
                phase === "verify" && row === 2
                    ? value === em[col]
                        ? "sorted"
                        : "error"
                    : phase === "sign" && row === 1
                      ? "active"
                      : row === 0
                        ? "comparing"
                        : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: value < 0 ? "?" : value.toString(16).padStart(2, "0"),
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
    const task = (input as { message?: string } | null) ?? {};
    const message = String(task.message ?? "HI");
    let digest = 0;
    for (let i = 0; i < message.length; i += 1) {
        digest = (digest * 31 + message.charCodeAt(i)) & 0xff;
    }
    const { e, d } = key();
    const em = encodedMessage(digest);
    const signature = modPow(toInt(em), d, N);
    const recovered = modPow(signature, e, N);
    const recoveredBytes = toBytes(recovered, 5);
    const valid = checkBlock(recoveredBytes, digest);
    const tampered = checkBlock(recoveredBytes, (digest + 1) & 0xff);
    const sigBytes = toBytes(signature, 5);
    const blank = new Array<number>(5).fill(-1);

    yield {
        stepNumber: 0,
        entities: makeCells(em, blank, blank, "encode"),
        edges: [],
        description: `Encoded message block: 00 01 FF 00 ${digest.toString(16).padStart(2, "0")} (toy PKCS#1 v1.5 structure).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols: 5, phase: "encode", digest, valid: false, tamperValid: false, n: N.toString(), e: e.toString() },
    };
    yield {
        stepNumber: 1,
        entities: makeCells(em, sigBytes, blank, "sign"),
        edges: [],
        description: `Signature s = m^d mod n = ${signature.toString()}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: 3, cols: 5, phase: "sign", digest, valid: false, tamperValid: false, n: N.toString(), e: e.toString() },
    };
    yield {
        stepNumber: 2,
        entities: makeCells(em, sigBytes, recoveredBytes, "verify"),
        edges: [],
        description: `Verification recomputes s^e mod n = m and checks the block structure: ${valid ? "accepted" : "rejected"}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 3, cols: 5, phase: "verify", digest, valid, tamperValid: false, n: N.toString(), e: e.toString(), recoveredDigest: recoveredBytes[4] ?? -1 },
    };
    yield {
        stepNumber: 3,
        entities: makeCells(em, sigBytes, recoveredBytes, "verify"),
        edges: [],
        description: `A message with digest ${((digest + 1) & 0xff).toString(16)} fails the same check: ${tampered ? "accepted" : "rejected"}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 3, cols: 5, phase: "tamper", digest, valid, tamperValid: tampered, n: N.toString(), e: e.toString() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A digital signature proves that a message came from the key holder without revealing the private key. RSA signing raises an encoded message to the private exponent; anyone can raise the signature to the public exponent and check that the original encoded block reappears.",
        invariants: [
            "The encoded block starts with 00 01, contains FF padding, then a 00 separator and the digest.",
            "Signing and verifying are inverse exponentiations modulo n.",
            "A valid signature recovers exactly the encoded block that was signed.",
        ],
        correctness:
            "Because e and d are chosen with e*d congruent to one modulo the totient of n, raising m to d and then to e returns m modulo n for any m coprime to n. Verification therefore recovers the exact encoded block, and the check verifies both the fixed PKCS structure and the digest. A different digest cannot pass. This demo uses a tiny modulus and a short block, so it illustrates the equation only and offers no real security.",
        complexityRationale:
            "Modular exponentiation runs in O(log d) multiplications, and the block check is O(1) for the fixed five-byte toy block; real PKCS#1 uses a block as long as the modulus.",
        uses: [
            "Authenticating software releases and package updates",
            "Signing JSON Web Tokens with RS256",
            "Certificate signatures in the public key infrastructure",
        ],
        references: [
            "Rivest, Shamir, and Adleman, A Method for Obtaining Digital Signatures, 1978",
            "RFC 8017, PKCS #1: RSA Cryptography Specifications Version 2.2",
        ],
        workedExample:
            "For the toy message HI with digest byte 38, the encoded block 00 01 FF 00 26 is interpreted as an integer, raised to the private exponent mod n, and the resulting signature raised to the public exponent returns the same five bytes, so verification accepts.",
    },
    id: "rsa-signature-pkcs1-v1-5",
    name: "RSA Signature (PKCS#1 v1.5, Toy)",
    category: "cryptography-security",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { message: "HI" },
    visualType: "grid",
    run,
    pseudocode: [
        "derive a one-byte digest from the message",
        "build the encoded block 00 01 FF 00 followed by the digest",
        "interpret the block as an integer m below the modulus",
        "compute the signature s as m raised to d modulo n",
        "verify by computing s raised to e modulo n",
        "check that the recovered block has the expected structure and digest",
        "done: report whether the signature and a tampered message are accepted",
    ],
};

export default module;
