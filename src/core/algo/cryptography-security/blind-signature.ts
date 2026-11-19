/**
 * blind-signature.ts - Chaum Blind Signature (Toy RSA)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A blind signature lets a signer sign a message without learning its content.
 * The message owner multiplies the message by a random blinding factor raised
 * to the public exponent, the signer signs the blinded value with its private
 * exponent, and the owner removes the blinding factor to obtain a valid
 * signature on the original message. This module uses the classic textbook
 * RSA parameters with a 3233-bit-scale modulus, so it is a teaching model and
 * makes no security claim.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(log e + log d) modular multiplications
 *   Space: O(1) field elements
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the message, blinded message, blinded signature, and unblinded signature.
 *   - The final frame highlights whether the unblinded signature verifies.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 61;
const Q = 53;
const N = P * Q;
const PHI = (P - 1) * (Q - 1);
const E = 17;

/** Exact modular exponentiation by repeated squaring. */
export function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let e = Math.floor(exponent);
    while (e > 0) {
        if (e % 2 === 1) {
            result = (result * b) % modulus;
        }
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Modular inverse by the extended Euclidean algorithm; returns zero if none. */
export function modInverse(value: number, modulus: number): number {
    let [oldR, r] = [((value % modulus) + modulus) % modulus, modulus];
    let [oldS, s] = [1, 0];
    while (r !== 0) {
        const quotient = Math.floor(oldR / r);
        [oldR, r] = [r, oldR - quotient * r];
        [oldS, s] = [s, oldS - quotient * s];
    }
    if (oldR !== 1) {
        return 0;
    }
    return ((oldS % modulus) + modulus) % modulus;
}

const D = modInverse(E, PHI);

/** Multiply a message by the blinding factor raised to the public exponent. */
export function blind(message: number, factor: number): number {
    const rE = powMod(factor, E, N);
    return (message * rE) % N;
}

/** The signer signs the blinded digest without seeing the original message. */
export function signBlind(blinded: number): number {
    return powMod(blinded, D, N);
}

/** Remove the blinding factor from the signer's response. */
export function unblind(signed: number, factor: number): number {
    const inverse = modInverse(factor, N);
    return (signed * inverse) % N;
}

/** Verify a signature by raising it to the public exponent. */
export function verifySignature(signature: number, message: number): boolean {
    return powMod(signature, E, N) === message % N;
}

function makeBars(values: number[], active: number): VisualEntity[] {
    const roles = ["message", "blinded message", "blinded signature", "unblinded signature"];
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { role: roles[index] ?? "" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number; factor?: number } | null) ?? {};
    const message = typeof task.message === "number" ? ((task.message % N) + N) % N : 42;
    const factor = typeof task.factor === "number" && modInverse(task.factor, N) !== 0 ? task.factor : 7;
    const blinded = blind(message, factor);
    const signedBlind = signBlind(blinded);
    const signature = unblind(signedBlind, factor);
    const accepted = verifySignature(signature, message);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([message, 0, 0, 0], 0),
        edges: [],
        description: `Chaum blind signature with toy RSA modulus ${N}, public exponent ${E}, and message ${message}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { modulus: N, message, factor, accepted: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([message, blinded, 0, 0], 1),
        edges: [],
        description: `Owner blinds the message with factor ${factor}, producing ${blinded} for the signer.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { message, factor, blinded, hidden: blinded !== message, accepted: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([message, blinded, signedBlind, 0], 2),
        edges: [],
        description: `Signer raises the blinded value to the private exponent, returning ${signedBlind}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { blinded, signedBlind, accepted: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([message, blinded, signedBlind, signature], 3),
        edges: [],
        description: `Owner removes the blinding factor to obtain signature ${signature} on the original message.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { signedBlind, signature, accepted: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([message, blinded, signedBlind, signature], 3),
        edges: [],
        description: accepted
            ? `Verification succeeds: the signature raised to the public exponent equals the message. Toy RSA, not secure.`
            : `Verification fails: the signature does not match the message.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { message, signature, accepted, modulus: N },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Blinding is like putting a letter inside a carbon-paper envelope before asking an official to sign it. The signature passes through the paper onto the letter, but the official never reads the address. The owner peels off the envelope and holds a valid signed letter. The algebraic trick is that raising a message times a random factor to the RSA exponent commutes, so removing the factor later leaves a genuine signature.",
        invariants: [
            "The signer only ever sees the blinded value, not the original message.",
            "Blinding multiplies the message by a factor raised to the public exponent.",
            "Unblinding with the inverse factor yields a signature valid on the original message.",
        ],
        correctness:
            "For RSA with exponent e and private exponent d, the blinded value is m times r to the e. Raising it to d gives m to the d times r because r to the e to the d is r modulo n. Multiplying by the inverse of r leaves m to the d, which is a valid signature since raising it to e recovers m. Exhaustive tests over many messages and invertible blinding factors confirm the unblinded signature verifies and that using the wrong factor fails. The tiny modulus makes this a teaching model, not secure RSA.",
        complexityRationale:
            "Blinding, signing, and unblinding each use one modular exponentiation plus a multiplication, costing O(log exponent) multiplications. The extended Euclidean inverse also runs in logarithmic time. All values are single field elements, so space is constant.",
        uses: [
            "Untraceable digital cash and privacy-preserving tokens",
            "Blind certification in anonymous credential systems",
            "E-voting protocols that separate voter identity from a valid ballot",
        ],
        references: [
            "Chaum, Blind Signatures for Untraceable Payments, 1983",
            "Chaum, Fiat and Naor, Untraceable Electronic Cash, 1990",
        ],
        workedExample:
            "With modulus 3233, public exponent 17, message 42, and blinding factor 7, the owner sends 42 times 7 to the 17 modulo 3233 to the signer. The signer returns that value to the private exponent. Multiplying by the inverse of 7 modulo 3233 yields a signature that, raised to 17, gives back 42.",
    },
    id: "blind-signature",
    name: "Blind Signature (Toy RSA)",
    category: "cryptography-security",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { message: 42, factor: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a small RSA modulus with public and private exponents",
        "pick a blinding factor invertible modulo the modulus",
        "blind the message by multiplying by factor to the public exponent",
        "have the signer raise the blinded value to the private exponent",
        "unblind by multiplying by the inverse of the factor",
        "verify by raising the signature to the public exponent",
        "done: report the acceptance verdict",
    ],
};

export default module;
