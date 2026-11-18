/**
 * schnorr-signature.ts - Schnorr Signature in a Toy Prime Field
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Schnorr signing is the textbook three-step Fiat-Shamir transform. The signer
 * commits to a random nonce by computing R = g^r, binds the commitment to the
 * message with a challenge e = H(R, y, message), and responds with s = r + e*x.
 * A verifier checks g^s = R times y^e. Because both sides equal g^(r + e*x),
 * a correct signature always verifies while changing the message or a signature
 * element breaks the equation. This module performs those exact steps in the
 * multiplicative group modulo 101 with generator 2 of order 100 and a
 * deterministic challenge hash. It is a small teaching model, not a production
 * curve or a cryptographically secure hash.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(log p) per modular exponentiation, constant number of them
 *   Space: O(1) field elements
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the public key, commitment, challenge, response, and the two
 *     sides of the verification equation.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 101;
const Q = 100;
const G = 2;

interface SchnorrInput {
    secret?: number;
    nonce?: number;
    message?: string;
}

/** Fast modular exponentiation by repeated squaring. */
function pow(base: number, exp: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exp;
    while (e > 0) {
        if (e & 1) {
            result = (result * b) % modulus;
        }
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Deterministic challenge: sum of all inputs reduced modulo the group order. */
function challenge(R: number, y: number, message: string): number {
    let sum = R + y;
    for (let i = 0; i < message.length; i += 1) {
        sum += message.charCodeAt(i);
    }
    return ((sum % Q) + Q) % Q;
}

function makeBars(values: Record<string, number>, phase: number, valid: boolean): VisualEntity[] {
    const labels = ["g", "p", "q", "x", "y", "r", "R", "e", "s", "g^s", "R*y^e"];
    return labels.map((label, index) => {
        const state: EntityState =
            phase >= 4 ? (label === "g^s" || label === "R*y^e" ? (valid ? "sorted" : "error") : "visited")
            : phase >= 3 && (label === "s" || label === "g^s" || label === "R*y^e") ? "active"
            : phase >= 2 && (label === "e" || label === "R") ? "comparing"
            : phase >= 1 && (label === "y" || label === "x") ? "path"
            : "idle";
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
            metadata: { index, role: label },
        };
    });
}

/** Produce and verify a toy Schnorr signature. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SchnorrInput | null) ?? {};
    const normalize = (value: number): number => ((((Math.trunc(value) - 1) % (Q - 1)) + Q - 1) % (Q - 1)) + 1;
    const secret = typeof task.secret === "number" ? normalize(task.secret) : 23;
    const nonce = typeof task.nonce === "number" ? normalize(task.nonce) : 17;
    const message = typeof task.message === "string" ? task.message : "hello";

    const y = pow(G, secret, P);
    const R = pow(G, nonce, P);
    const e = challenge(R, y, message);
    const s = (nonce + e * secret) % Q;
    const lhs = pow(G, s, P);
    const rhs = (R * pow(y, e, P)) % P;
    const valid = lhs === rhs;

    const base: Record<string, number> = { g: G, p: P, q: Q, x: secret, y, r: nonce, R, e, s, "g^s": 0, "R*y^e": 0 };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(base, 0, valid),
        edges: [],
        description: `Toy Schnorr in the group modulo ${P} with generator ${G} of order ${Q}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { p: P, q: Q, g: G, message, valid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(base, 1, valid),
        edges: [],
        description: `Key generation: secret ${secret}, public key y = g^x mod p = ${y}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { p: P, q: Q, g: G, message, secret, y, valid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(base, 2, valid),
        edges: [],
        description: `Commitment: nonce ${nonce}, R = g^r mod p = ${R}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { p: P, q: Q, g: G, message, secret, y, nonce, R, valid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(base, 2, valid),
        edges: [],
        description: `Challenge e = H(R, y, message) = ${e}, binding the commitment to the message.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { p: P, q: Q, g: G, message, secret, y, nonce, R, e, valid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(base, 3, valid),
        edges: [],
        description: `Response s = r + e*x mod q = ${s}; the signature is the pair (R, s).`,
        codeLineNumber: 4,
        layout: "array",
        meta: { p: P, q: Q, g: G, message, secret, y, nonce, R, e, s, valid: false },
    };
    step += 1;

    const finalValues = { ...base, "g^s": lhs, "R*y^e": rhs };
    yield {
        stepNumber: step,
        entities: makeBars(finalValues, 4, valid),
        edges: [],
        description: valid
            ? `Verified: g^s = ${lhs} equals R*y^e = ${rhs}; the signature is valid.`
            : `Rejected: g^s = ${lhs} differs from R*y^e = ${rhs}; the signature is invalid.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { p: P, q: Q, g: G, message, secret, y, nonce, R, e, s, lhs, rhs, valid },
    };
}

/** The toy Schnorr module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Schnorr works by committing to a random secret before seeing the challenge, so a signer cannot fake a response without knowing the private key. The commitment R and the public key y are mixed with the message to form a challenge, and the response s combines that challenge with the secret. Verification recomputes the same group element in two ways, which match only for a genuine signature.",
        invariants: [
            "The public key is y = g^x and the commitment is R = g^r in the group of order q.",
            "The challenge depends on R, y, and the whole message.",
            "Both verification sides equal g to the power r plus e times x.",
        ],
        correctness:
            "The left side is g^s = g^(r + e x). The right side is R y^e = g^r (g^x)^e = g^(r + e x), so they are equal whenever the arithmetic is consistent. Because the challenge binds R and the message, an adversary who changes the message must find a new response satisfying the equation, which requires solving for the secret in this model. A wrong challenge or a changed signature element makes the two exponents differ and the check fails.",
        complexityRationale:
            "Signing computes two exponentiations and one multiplication, verification computes two, each in O(log p) modular multiplications by repeated squaring. All stored values are single field elements, so space is constant.",
        uses: [
            "Understanding the Fiat-Shamir transform and sigma protocols",
            "A teaching model for Schnorr and EdDSA-style signatures",
            "Comparing signature equations across discrete-log systems",
        ],
        references: [
            "Schnorr, Efficient Signature Generation by Smart Cards, 1991",
            "Pointcheval and Stern, Security Arguments for Digital Signatures and Blind Signatures, 2000",
        ],
        workedExample:
            "In the group modulo 101 with secret 23 and nonce 17, the public key is 2^23 mod 101 and the commitment is 2^17 mod 101. For message hello the challenge is their sum plus the message bytes reduced modulo 100, and the response is 17 plus e times 23 modulo 100. Raising 2 to that response gives exactly R times y to the challenge, so verification accepts; changing the message changes e and breaks the equality.",
    },
    id: "schnorr-signature",
    name: "Schnorr Signature (Toy Prime Field)",
    category: "cryptography-security",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { secret: 23, nonce: 17, message: "hello" },
    visualType: "array",
    run,
    pseudocode: [
        "fix a prime p, generator g of order q, and a hash function",
        "choose secret x and publish y = g^x mod p",
        "choose nonce r and commit with R = g^r mod p",
        "compute challenge e = H(R, y, message) mod q",
        "compute response s = r + e*x mod q",
        "verify that g^s equals R * y^e mod p",
        "accept when the two sides match",
    ],
};

export default module;
