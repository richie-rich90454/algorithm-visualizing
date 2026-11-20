/**
 * nyberg-rueppel-signature.ts - Nyberg-Rueppel Signature with Message Recovery (Toy)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Nyberg-Rueppel scheme hides the message inside the first signature value:
 * r is the message multiplied by a generator raised to a random nonce. The
 * second value binds r to the signer's secret key with a hash. Verification
 * multiplies r by the inverse of the nonce-derived part and recovers the
 * message directly, so the message need not be sent separately. The tiny
 * discrete-log group here illustrates the algebra only and is not secure.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(log q) modular exponentiations for signing and verification
 *   Space: O(1) for the two signature values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the nonce, the masked value r, the response s, and recovery.
 *   - A recovered message matching the original is green; a mismatch is red.
 *   - meta carries r, s, the recovered message, and the verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 23;
const Q = 11;
const G = 2;

/** Modular exponentiation with exponents reduced modulo the group order. */
export function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let current = ((base % modulus) + modulus) % modulus;
    let power = ((exponent % Q) + Q) % Q;
    while (power > 0) {
        if (power % 2 === 1) result = (result * current) % modulus;
        current = (current * current) % modulus;
        power = Math.floor(power / 2);
    }
    return result;
}

export interface NybergRueppelSignature {
    r: number;
    s: number;
}

/** Hash used by the toy scheme. */
export function challenge(seed: number): number {
    return ((seed % Q) + Q) % Q;
}

/** Sign a message, embedding it in the first signature component. */
export function sign(message: number, secret: number, nonce: number): NybergRueppelSignature {
    const m = ((message % P) + P) % P;
    const k = ((nonce % (Q - 1)) + (Q - 1)) % (Q - 1) + 1;
    const r = (m * powMod(G, k, P)) % P;
    const s = (k + secret * challenge(r)) % Q;
    return { r, s };
}

/** Recover the message from a signature and a public key. */
export function recover(signature: NybergRueppelSignature, publicKey: number): number | null {
    if (signature.r <= 0 || signature.r >= P) return null;
    const factor = powMod(G, -signature.s, P) * powMod(publicKey, challenge(signature.r), P) % P;
    return (signature.r * factor) % P;
}

function makeBars(values: number[], labels: string[], active: number, state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: labels[index] ?? `${value}`,
        value,
        state: index === active ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: labels[index] ?? "", value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number; secret?: number; nonce?: number; tamper?: boolean } | null) ?? {};
    const secret = ((Math.floor(Number(task.secret ?? 6)) % (Q - 1)) + (Q - 1)) % (Q - 1) + 1;
    const publicKey = powMod(G, secret, P);
    const message = ((Math.floor(Number(task.message ?? 9)) % (P - 1)) + (P - 1)) % (P - 1) + 1;
    const nonce = Math.floor(Number(task.nonce ?? 3)) || 3;
    const signature = sign(message, secret, nonce);
    const delivered: NybergRueppelSignature = task.tamper
        ? { r: signature.r, s: (signature.s + 1) % Q }
        : signature;
    const recovered = recover(delivered, publicKey);
    const verified = recovered === message;
    let stepNumber = 0;

    yield {
        stepNumber: stepNumber,
        entities: makeBars([secret, publicKey], ["secret", "public"], 1, "idle"),
        edges: [],
        description: `Nyberg-Rueppel toy setup with secret ${secret} and public key ${publicKey}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { toy: true, message, r: 0, s: 0, recovered: -1, verified: false },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars([nonce, powMod(G, nonce, P)], ["nonce", "g^k"], 1, "visited"),
        edges: [],
        description: `Choose nonce ${nonce}; the generator to that power is ${powMod(G, nonce, P)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { toy: true, message, r: 0, s: 0, recovered: -1, verified: false },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars([signature.r, signature.s], ["r", "s"], 1, "active"),
        edges: [],
        description: `Mask the message into r = ${signature.r} and bind it with response s = ${signature.s}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { toy: true, message, r: signature.r, s: signature.s, recovered: -1, verified: false },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars([recovered ?? -1], ["recovered"], 0, verified ? "sorted" : "error"),
        edges: [],
        description: verified
            ? `The verifier recovers message ${recovered}, which matches the original.`
            : `The verifier recovers ${recovered ?? "nothing"}, which does not match message ${message}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            toy: true,
            message,
            r: delivered.r,
            s: delivered.s,
            recovered: recovered ?? -1,
            verified: verified ? 1 : 0,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of sending the message beside its signature, multiply the message by a random group element and send that product. The second signature value ties the product to the signer's secret. The verifier cancels the signer's contribution and divides it out, recovering the message from the signature alone, which is useful when bandwidth is scarce.",
        invariants: [
            "The public key is the generator raised to the secret key.",
            "The response equals the nonce plus the secret times a hash of the masked value.",
            "Verification recovers the message when the signature was produced with the matching secret.",
        ],
        correctness:
            "Substituting the response into the verification expression gives the generator to minus k times the public key to the hash, which cancels the secret contribution and leaves the generator to minus k. Multiplying by r, which was the message times the generator to k, returns exactly the original message in the group. Any alteration to r or s breaks this cancellation and recovers a different value.",
        complexityRationale:
            "Signing and verification each perform two modular exponentiations with exponents of at most log q bits, so both take logarithmic time. Only the two signature values and a few intermediate group elements are stored, giving constant space.",
        uses: [
            "Message recovery signatures for short messages",
            "Bandwidth-constrained authentication protocols",
            "Teaching signatures related to Schnorr and ElGamal",
        ],
        references: [
            "Nyberg and Rueppel, Message Recovery for Signature Schemes, EUROCRYPT 1994",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Chapter 11",
        ],
        workedExample:
            "With generator 2 in the group modulo 23, secret 6 and nonce 3, the public key is 8 and the nonce factor is 8. A message of 9 is masked to r = 72 mod 23 = 3, and the response binds that value to the secret. Verification multiplies r by the inverse of the generator to the nonce, recovering 9.",
    },
    id: "nyberg-rueppel-signature",
    name: "Nyberg-Rueppel Signature (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(log q)", space: "O(1)" },
    defaultInput: { message: 9, secret: 6, nonce: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "publish the public key derived from the secret",
        "choose a random nonce in the group order",
        "multiply the message by the generator to the nonce to form r",
        "set the response to the nonce plus the secret times the hash of r",
        "send the pair r and s as the signature",
        "on receipt cancel the signer contribution using the public key",
        "divide out the nonce factor to recover the message",
        "accept when the recovered message carries valid redundancy",
        "done: report the recovered message and verdict",
    ],
};

export default module;
