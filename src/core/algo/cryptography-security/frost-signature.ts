/**
 * frost-signature.ts - FROST-Style Threshold Schnorr Signature (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * FROST lets any threshold of signers produce one Schnorr signature while no
 * smaller group can. A secret is shared with Shamir polynomials, each signer
 * contributes a nonce commitment, and partial signatures are combined with
 * Lagrange coefficients so their exponents add up to a single valid signature.
 * This module uses an eleven-element exponent group, so it faithfully shows the
 * algebra but makes no security claim.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(t squared) Lagrange work and O(t) modular exponentiations
 *   Space: O(t) for the partial signatures
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show each signer's partial signature and the final aggregate.
 *   - meta carries the nonce aggregate, challenge, signature, and verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 23;
const Q = 11;
const G = 2;

/** Exact modular exponentiation by repeated squaring. */
export function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let current = ((base % modulus) + modulus) % modulus;
    let power = Math.floor(exponent);
    while (power > 0) {
        if (power % 2 === 1) {
            result = (result * current) % modulus;
        }
        current = (current * current) % modulus;
        power = Math.floor(power / 2);
    }
    return result;
}

function inverse(value: number, modulus: number): number {
    return powMod(((value % modulus) + modulus) % modulus, modulus - 2, modulus);
}

/** Evaluate a secret-sharing polynomial modulo Q. */
function evaluate(coefficients: number[], x: number): number {
    let result = 0;
    let power = 1;
    for (const coefficient of coefficients) {
        result = (result + coefficient * power) % Q;
        power = (power * x) % Q;
    }
    return ((result % Q) + Q) % Q;
}

/** Lagrange coefficient at zero for one signer in the signing subset. */
export function lagrange(points: number[], index: number): number {
    let value = 1;
    for (let j = 0; j < points.length; j += 1) {
        if (j === index) {
            continue;
        }
        const xi = points[index] ?? 0;
        const xj = points[j] ?? 0;
        value = value * ((-xj % Q) + Q) % Q * inverse(((xi - xj) % Q + Q) % Q, Q) % Q;
    }
    return value;
}

/** Result of a toy FROST signing session. */
export interface FrostSignature {
    y: number;
    aggregateR: number;
    challenge: number;
    partials: number[];
    signature: number;
    verified: boolean;
}

/** Run a threshold signing session over a chosen subset of signers. */
export function sign(
    coefficients: number[],
    signerIds: number[],
    nonces: number[],
    message: number,
): FrostSignature {
    const secret = evaluate(coefficients, 0);
    const y = powMod(G, secret, P);
    let aggregateR = 1;
    for (const nonce of nonces) {
        aggregateR = aggregateR * powMod(G, nonce, P) % P;
    }
    const challenge = (aggregateR + message) % Q;
    const partials = signerIds.map((id, position) => {
        const share = evaluate(coefficients, id);
        const coefficient = lagrange(signerIds, position);
        return (nonces[position]! + challenge * coefficient * share) % Q;
    });
    const signature = partials.reduce((sum, value) => sum + value, 0) % Q;
    const verified = powMod(G, signature, P) === aggregateR * powMod(y, challenge, P) % P;
    return { y, aggregateR, challenge, partials, signature, verified };
}

/** Verify a threshold Schnorr signature in the toy group. */
export function verify(result: FrostSignature): boolean {
    return powMod(G, result.signature, P) === result.aggregateR * powMod(result.y, result.challenge, P) % P;
}

/** Build bars for the signer partials plus the final aggregate. */
function makeBars(partials: number[], extras: number[], labels: string[], active: number): VisualEntity[] {
    const values = [...partials, ...extras];
    return values.map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: labels[index] ?? `${value}`,
        value,
        state: (index === active ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: labels[index] ?? "" },
    }));
}

/** The FROST toy generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number; signers?: number[]; coefficients?: number[] } | null) ?? {};
    const coefficients = Array.isArray(task.coefficients) && task.coefficients.length >= 2
        ? task.coefficients.map((value) => ((Math.floor(value) % Q) + Q) % Q)
        : [6, 2, 2];
    const message = ((Math.floor(task.message ?? 4) % Q) + Q) % Q;
    const allSigners = [1, 2, 3, 4, 5];
    const signers = Array.isArray(task.signers) && task.signers.length >= 2
        ? task.signers.map((value) => ((Math.floor(value) - 1) % 5) + 1)
        : allSigners.slice(0, 3);
    const nonceBySigner = new Map<number, number>([
        [1, 3],
        [2, 5],
        [3, 7],
        [4, 2],
        [5, 9],
    ]);
    const nonces = signers.map((id) => nonceBySigner.get(id) ?? 1);
    const result = sign(coefficients, signers, nonces, message);
    const baseMeta = {
        toy: true,
        threshold: signers.length,
        signers,
        y: result.y,
        aggregateR: 0,
        challenge: 0,
        signature: 0,
        verified: false,
    };

    yield {
        stepNumber: 0,
        entities: makeBars([], [coefficients[0] ?? 0], ["secret"], 0),
        edges: [],
        description: `FROST-style threshold signing with ${signers.length} of 5 signers.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...baseMeta },
    };

    yield {
        stepNumber: 1,
        entities: makeBars([], [result.y], ["public key y"], 0),
        edges: [],
        description: `The shared public key is g raised to the secret, giving ${result.y}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...baseMeta },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(nonces, nonces.map((nonce) => powMod(G, nonce, P)), nonces.map((_, i) => `R${i}`), 0),
        edges: [],
        description: `Commit nonces whose product is ${result.aggregateR}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...baseMeta, aggregateR: result.aggregateR },
    };

    yield {
        stepNumber: 3,
        entities: makeBars([], [result.aggregateR, result.challenge], ["aggregate R", "challenge"], 1),
        edges: [],
        description: `Bind the message to the nonce aggregate with challenge ${result.challenge}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...baseMeta, aggregateR: result.aggregateR, challenge: result.challenge },
    };

    yield {
        stepNumber: 4,
        entities: makeBars(result.partials, [], result.partials.map((_, i) => `z${i}`), result.partials.length - 1),
        edges: [],
        description: `Each signer contributes a Lagrange-weighted partial signature.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...baseMeta, aggregateR: result.aggregateR, challenge: result.challenge },
    };

    yield {
        stepNumber: 5,
        entities: makeBars([], [result.signature, result.y, result.verified ? 1 : 0], ["signature", "public key", "verified"], 0),
        edges: [],
        description: `Aggregate equals ${result.signature}; verification ${result.verified ? "succeeds" : "fails"}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            ...baseMeta,
            aggregateR: result.aggregateR,
            challenge: result.challenge,
            signature: result.signature,
            verified: result.verified,
            done: true,
        },
    };
}

/** The FROST toy module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A group of signers shares one secret key so that a threshold of them can sign but a smaller group cannot. Each signer first commits to a random nonce; the commitments are combined, and the message plus that combined nonce fixes a shared challenge. Every signer returns a partial response weighted by its Lagrange coefficient, and adding the partials yields an ordinary Schnorr signature under the shared public key.",
        invariants: [
            "The Lagrange coefficients of any threshold subset sum to one at the secret.",
            "Every signer uses a nonce commitment derived from its own nonce.",
            "The aggregate signature equals the sum of the weighted partial responses.",
        ],
        correctness:
            "Lagrange interpolation states that the weighted sum of the shares equals the shared secret, so the weighted partial responses sum to the sum of nonces plus the challenge times the secret. Raising the generator to that sum gives the nonce aggregate times the public key to the challenge, which is exactly the Schnorr verification equation. Any smaller group lacks enough shares to determine the secret, so it cannot forge a signature in this model.",
        complexityRationale:
            "Constructing each partial needs a Lagrange coefficient with one modular inversion, costing O(t squared) for t signers, plus O(t) exponentiations for the nonce commitments. The partial signatures and signer list use O(t) space.",
        uses: [
            "Threshold signing for distributed validators and custodians",
            "Robust signing where no single device holds the whole key",
            "Teaching the link between secret sharing and Schnorr signatures",
        ],
        references: [
            "Komlo and Goldberg, FROST: Flexible Round-Optimized Schnorr Threshold Signatures, 2020",
            "Schnorr, Efficient Signature Generation by Smart Cards, 1991",
        ],
        workedExample:
            "With secret 6 and signers 1, 2, and 3 holding shares 10, 7, and 8, the Lagrange weights recombine those shares to 6. If their nonces sum to a combined commitment R, the challenge is R plus the message, and the summed partials form a signature z that satisfies g to the z equals R times the public key to the challenge.",
    },
    id: "frost-signature",
    name: "FROST Threshold Signature (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(t^2)", space: "O(t)" },
    defaultInput: { message: 4, signers: [1, 2, 3] },
    visualType: "array",
    run,
    pseudocode: [
        "share the secret key with a random polynomial",
        "publish the shared public key",
        "each signer commits to a random nonce",
        "combine nonce commitments into a single value",
        "derive a challenge from the message and nonce aggregate",
        "each signer returns a Lagrange-weighted partial response",
        "sum the partials and verify the Schnorr equation",
        "done: report the signature and verification verdict",
    ],
};

export default module;
