/**
 * elgamal-signature.ts - ElGamal Signature (Toy Prime Field)
 *
 * ElGamal signing commits to a random nonce with r = g^k, then solves the
 * verification equation g^H = y^r * r^s for the response s using the private
 * key x. A verifier only needs the public key and the two signature values.
 * This module performs the exact arithmetic in a small prime field with a
 * deterministic message hash. It is a teaching model, not a production
 * signature scheme or a secure random source.
 *
 * Time:  O(log p) per modular exponentiation, O(log q) for the inverse
 * Space: O(1) field elements
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface ElGamalSignature {
    y: number;
    hash: number;
    r: number;
    s: number;
    lhs: number;
    rhs: number;
    valid: boolean;
}

/** Modular exponentiation by repeated squaring with exact integers. */
export function egPow(base: number, exponent: number, modulus: number): number {
    const mod = BigInt(modulus);
    let result = 1n;
    let b = ((BigInt(base) % mod) + mod) % mod;
    let e = BigInt(exponent);
    while (e > 0n) {
        if (e & 1n) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e >>= 1n;
    }
    return Number(result);
}

/** Modular inverse via the extended Euclidean algorithm, or null if none exists. */
export function egInverse(value: number, modulus: number): number | null {
    let oldR = BigInt(modulus);
    let r = ((BigInt(value) % oldR) + oldR) % oldR;
    let oldS = 0n;
    let s = 1n;
    while (r !== 0n) {
        const quotient = oldR / r;
        [oldR, r] = [r, oldR - quotient * r];
        [oldS, s] = [s, oldS - quotient * s];
    }
    if (oldR !== 1n) {
        return null;
    }
    return Number(((oldS % BigInt(modulus)) + BigInt(modulus)) % BigInt(modulus));
}

/** Deterministic message hash reduced modulo the group order. */
export function egHash(message: string, order: number): number {
    let sum = 0;
    for (let i = 0; i < message.length; i += 1) {
        sum = (sum + message.charCodeAt(i)) % order;
    }
    return sum;
}

/** Verify a signature pair against a message hash and public key. */
export function elgamalVerify(
    prime: number,
    generator: number,
    y: number,
    hash: number,
    r: number,
    s: number,
): boolean {
    const p = Math.max(5, Math.trunc(prime));
    const lhs = egPow(generator, hash, p);
    const rhs = (egPow(y, r, p) * egPow(r, s, p)) % p;
    return lhs === rhs;
}

/** Sign and verify a message in the toy ElGamal field. */
export function elgamalSign(
    prime: number,
    generator: number,
    secret: number,
    nonce: number,
    message: string,
): ElGamalSignature {
    const p = Math.max(5, Math.trunc(prime));
    const g = Math.trunc(generator);
    const q = p - 1;
    const x = ((Math.trunc(secret) % q) + q) % q;
    const k = ((Math.trunc(nonce) % q) + q) % q;
    const y = egPow(g, x, p);
    const hash = egHash(message, q);
    const r = egPow(g, k, p);
    const inverse = egInverse(k, q);
    const s = inverse === null ? 0 : Number((BigInt(inverse) * (((BigInt(hash) - BigInt(x) * BigInt(r)) % BigInt(q) + BigInt(q)) % BigInt(q))) % BigInt(q));
    const lhs = egPow(g, hash, p);
    const rhs = (egPow(y, r, p) * egPow(r, s, p)) % p;
    return { y, hash, r, s, lhs, rhs, valid: inverse !== null && elgamalVerify(p, g, y, hash, r, s) };
}

function makeBars(values: Record<string, number>, phase: number, valid: boolean): VisualEntity[] {
    const labels = ["p", "g", "x", "y", "H", "k", "r", "s", "g^H", "y^r*r^s"];
    return labels.map((label, index) => {
        let state: EntityState = "idle";
        if (phase >= 4) {
            state = label === "g^H" || label === "y^r*r^s" ? (valid ? "sorted" : "error") : "visited";
        } else if (phase >= 3 && (label === "s" || label === "g^H" || label === "y^r*r^s")) {
            state = "active";
        } else if (phase >= 2 && (label === "H" || label === "r")) {
            state = "comparing";
        } else if (phase >= 1 && (label === "x" || label === "y")) {
            state = "path";
        }
        const value = values[label] ?? 0;
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${label}=${value}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, role: label, value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { prime?: number; generator?: number; secret?: number; nonce?: number; message?: string } | null
    ) ?? {};
    const prime = typeof task.prime === "number" ? Math.max(5, Math.trunc(task.prime)) : 1000003;
    const generator = typeof task.generator === "number" ? Math.trunc(task.generator) : 2;
    const secret = typeof task.secret === "number" ? Math.trunc(task.secret) : 123;
    const nonce = typeof task.nonce === "number" ? Math.trunc(task.nonce) : 5;
    const message = typeof task.message === "string" ? task.message : "hi";
    const result = elgamalSign(prime, generator, secret, nonce, message);
    const base: Record<string, number> = {
        p: prime,
        g: generator,
        x: secret,
        y: result.y,
        H: result.hash,
        k: nonce,
        r: result.r,
        s: result.s,
        "g^H": 0,
        "y^r*r^s": 0,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(base, 0, result.valid),
        edges: [],
        description: `ElGamal in the field modulo ${prime} with generator ${generator} and message "${message}".`,
        codeLineNumber: 0,
        layout: "array",
        meta: { prime, generator, message, phase: "init", valid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(base, 1, result.valid),
        edges: [],
        description: `Key generation: secret ${secret}, public key y = g^x mod p = ${result.y}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { prime, generator, message, secret, y: result.y, phase: "keygen", valid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(base, 2, result.valid),
        edges: [],
        description: `Message hash H = ${result.hash}; commitment r = g^k mod p = ${result.r}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { prime, generator, message, hash: result.hash, r: result.r, phase: "commit", valid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(base, 3, result.valid),
        edges: [],
        description: `Response s = k inverse times (H minus x*r) modulo p minus one = ${result.s}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { prime, generator, message, r: result.r, s: result.s, phase: "respond", valid: false },
    };
    step += 1;

    const finalValues = { ...base, "g^H": result.lhs, "y^r*r^s": result.rhs };
    yield {
        stepNumber: step,
        entities: makeBars(finalValues, 4, result.valid),
        edges: [],
        description: result.valid
            ? `Verified: g^H = ${result.lhs} equals y^r times r^s = ${result.rhs}.`
            : `Rejected: g^H = ${result.lhs} differs from y^r times r^s = ${result.rhs}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            prime,
            generator,
            message,
            y: result.y,
            hash: result.hash,
            r: result.r,
            s: result.s,
            lhs: result.lhs,
            rhs: result.rhs,
            valid: result.valid,
            phase: "done",
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "ElGamal signing hides the private key inside an equation that anyone can check. The signer commits with r, mixes the message and secret into a response s using the inverse of a random nonce, and publishes the pair. Verification recomputes the same group element in two different ways; they match only when the signer knew the secret that binds the public key to the message.",
        invariants: [
            "The public key is y = g^x and the commitment is r = g^k in the field modulo p.",
            "The response solves k times s is congruent to H minus x*r modulo p minus one.",
            "Verification compares g to the H power with y to the r power times r to the s power.",
        ],
        correctness:
            "Rewrite s as k inverse times H minus x*r, so k times s plus x*r equals H modulo p minus one. Raising g to that exponent gives g^H. The right side is y^r times r^s, which is g to x*r plus k*s, the same exponent, so the two sides match for a genuine signature. A changed message changes H and a changed r or s changes the exponent, so the equality fails unless the forger can solve the discrete logarithm for x.",
        complexityRationale:
            "Signing uses two exponentiations and one modular inverse found by the extended Euclidean algorithm, while verification uses three exponentiations. Repeated squaring makes each exponentiation O(log p) and the inverse O(log p), with only constant field elements stored.",
        uses: [
            "Teaching discrete-logarithm signature equations",
            "Comparing ElGamal with Schnorr and DSA signatures",
            "Understanding the role of a fresh nonce in signature schemes",
        ],
        references: [
            "ElGamal, A Public Key Cryptosystem and a Signature Scheme Based on Discrete Logarithms, 1985",
            "NIST FIPS 186-5, Digital Signature Standard, 2023",
        ],
        workedExample:
            "In the field modulo one million and three with generator two, secret one hundred twenty three and nonce five, the public key is two to the one hundred twenty third power. For the message hi, the hash and commitment are computed, the inverse of five modulo one million and two gives the response, and verification checks that raising the generator to the hash equals raising the public key to r times r to the response.",
    },
    id: "elgamal-signature",
    name: "ElGamal Signature (Toy Prime Field)",
    category: "cryptography-security",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { prime: 1000003, generator: 2, secret: 123, nonce: 5, message: "hi" },
    visualType: "array",
    run,
    pseudocode: [
        "fix a prime p, a generator g, and a message hash",
        "choose secret x and publish y = g^x mod p",
        "hash the message to H modulo p minus one",
        "choose nonce k coprime to p minus one and set r = g^k mod p",
        "compute s = k inverse times (H minus x*r) modulo p minus one",
        "publish the signature pair r and s",
        "verify that y^r equals g^H times r^s modulo p",
        "accept only when the two sides are equal",
    ],
};

export default module;
