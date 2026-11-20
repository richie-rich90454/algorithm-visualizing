/**
 * ed25519-signature.ts - EdDSA-Style Schnorr Signature (Toy Field)
 *
 * Demonstrates the discrete-log signature equation that also underlies
 * Ed25519: a signer commits with R = g^r, derives a challenge from R, the
 * public key, and the message, and releases s = r + challenge * secret.
 * Verification checks g^s against R * A^challenge. A small prime field and a
 * toy challenge hash keep every step exact; this is not a full Ed25519
 * implementation (no twisted Edwards curve, SHA-512, or cofactored equation).
 *
 * Time:  O(log p) for the modular powers  Space: O(1)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface EdDSAInput {
    p?: number;
    g?: number;
    secret?: number;
    nonce?: number;
    message?: string;
}

function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let k = exponent;
    while (k > 0) {
        if (k % 2 === 1) {
            result = (result * b) % modulus;
        }
        b = (b * b) % modulus;
        k = Math.trunc(k / 2);
    }
    return result;
}

/** Deterministic toy challenge: a small sum reduced modulo the group order. */
function challenge(R: number, A: number, message: string, order: number): number {
    let sum = R + A;
    for (let i = 0; i < message.length; i += 1) {
        sum += message.charCodeAt(i);
    }
    return ((sum % order) + order) % order;
}

function makeCells(rows: Array<[string, number | string]>, highlight: number): VisualEntity[] {
    return rows.map(([label, value], col) => ({
        id: `cell-0-${col}`,
        type: "cell",
        label: `${label}=${value}`,
        value: typeof value === "number" ? value : value,
        state: (col === highlight ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as EdDSAInput | null) ?? {};
    const p = typeof task.p === "number" && task.p > 2 ? Math.trunc(task.p) : 101;
    const g = typeof task.g === "number" ? Math.trunc(task.g) : 2;
    const secret = typeof task.secret === "number" ? ((Math.trunc(task.secret) % (p - 1)) + p - 1) % (p - 1) : 23;
    const nonce = typeof task.nonce === "number" ? ((Math.trunc(task.nonce) % (p - 1)) + p - 1) % (p - 1) : 17;
    const message = typeof task.message === "string" ? task.message : "hello";
    const order = p - 1;
    const A = modPow(g, secret, p);
    const R = modPow(g, nonce, p);
    const h = challenge(R, A, message, order);
    const s = (nonce + h * secret) % order;
    const lhs = modPow(g, s, p);
    const rhs = (R * modPow(A, h, p)) % p;
    const valid = lhs === rhs;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(
            [
                ["p", p],
                ["g", g],
                ["a", secret],
                ["A", A],
            ],
            3,
        ),
        edges: [],
        description: `Toy EdDSA in the field modulo ${p}: public key A = g^a = ${A}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: 4, p, g, secret, A, message, R, h, s, lhs, rhs, valid },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(
            [
                ["r", nonce],
                ["R", R],
                ["h", h],
                ["s", s],
            ],
            3,
        ),
        edges: [],
        description: `Commit R = g^r = ${R}; challenge h = ${h}; signature s = r + h*a mod ${order} = ${s}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: 1, cols: 4, nonce, R, h, s, order },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(
            [
                ["g^s", lhs],
                ["R", R],
                ["A^h", modPow(A, h, p)],
                ["R*A^h", rhs],
            ],
            3,
        ),
        edges: [],
        description: `Verify: g^s = ${lhs} and R*A^h = ${rhs}; signature ${valid ? "valid" : "INVALID"}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 1, cols: 4, lhs, rhs, R, A, h, s, p, valid },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Schnorr-style signature proves knowledge of a secret without revealing it. The signer first publishes a random commitment R, then folds R, the public key, and the message into a challenge h. The response s combines the secret with that challenge, and anyone can check the linear relation g^s = R times A to the h. Ed25519 uses the same idea on an elliptic curve.",
        invariants: [
            "The public key is A = g^a and the commitment is R = g^r in the field modulo p.",
            "The challenge h is a deterministic function of R, A, and the message.",
            "Verification succeeds exactly when g^s equals R times A^h modulo p.",
        ],
        correctness:
            "The response is s = r + h*a modulo the group order, so g^s = g^(r+h*a) = g^r * (g^a)^h = R * A^h. Anyone with the public key and message can recompute h and check this equality. The toy challenge is a simple sum rather than a cryptographic hash, so it demonstrates the exact equation but provides no real security.",
        complexityRationale:
            "Signing and verifying each use a constant number of square-and-multiply exponentiations costing O(log p) multiplications, with O(1) scalar storage.",
        uses: [
            "Teaching the structure of Schnorr and EdDSA signatures",
            "A model for signature verification equations",
            "Explaining why binding the message to the challenge prevents replay",
        ],
        references: [
            "Schnorr, Efficient Identification and Signatures for Smart Cards, 1991",
            "Bernstein et al., Ed25519: High-Speed High-Security Signatures, 2011",
        ],
        workedExample:
            "With p=101, g=2, secret a=23 and nonce r=17, the public key is A=2^23 mod 101 and the commitment is R=2^17 mod 101. The challenge h combines R, A, and 'hello'; the signer returns s=(17+h*23) mod 100. A verifier checks 2^s against R times A^h, which match because the exponents are equal modulo the group order.",
    },
    id: "ed25519-signature",
    name: "Ed25519 Signature (Toy Schnorr Model)",
    category: "cryptography-security",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { p: 101, g: 2, secret: 23, nonce: 17, message: "hello" },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a small prime field and generator",
        "derive the public key A from the secret a",
        "pick a nonce r and publish the commitment R",
        "hash R, A, and the message into a challenge h",
        "compute the response s = r plus h times a modulo the order",
        "verify that g to the s equals R times A to the h",
        "done: report whether the signature is valid",
    ],
};

export default module;
