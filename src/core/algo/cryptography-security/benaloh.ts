/**
 * benaloh.ts - Benaloh Probabilistic Homomorphic Encryption (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Benaloh encryption hides a small message by multiplying a public generator
 * raised to the message by a public residue raised to a random blinder. Only a
 * holder of the residue root can test r-th residuosity and recover the message.
 * Multiplication of ciphertexts adds the underlying messages modulo r, which
 * makes the scheme additively homomorphic. This module uses an eleven-element
 * field, so it is a faithful toy model and makes no security claim.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(r log p) for decryption by exhaustive residuosity testing
 *   Space: O(1) field elements
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the message, blinder, ciphertext, and recovered message.
 *   - The verified bar is highlighted; meta records decryption and homomorphism.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Public parameters of a small Benaloh instance. */
export interface BenalohKey {
    p: number;
    r: number;
    g: number;
    y: number;
    base: number;
    factor: number;
}

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

/** Derive the public key from a prime p, small prime r, generator, and secret root. */
export function makeKey(p: number, r: number, g: number, root: number): BenalohKey {
    const factor = (p - 1) / r;
    return {
        p,
        r,
        g,
        y: powMod(root, r, p),
        base: powMod(g, factor, p),
        factor,
    };
}

/** Encrypt a message from Z_r with a random blinder from Z_r. */
export function encrypt(message: number, randomness: number, key: BenalohKey): number {
    return (powMod(key.g, message, key.p) * powMod(key.y, randomness, key.p)) % key.p;
}

/** Recover the message by finding which generator power matches the residue test. */
export function decrypt(ciphertext: number, key: BenalohKey): number {
    const residue = powMod(ciphertext, key.factor, key.p);
    for (let message = 0; message < key.r; message += 1) {
        if (powMod(key.base, message, key.p) === residue) {
            return message;
        }
    }
    return -1;
}

/** Homomorphic addition of two ciphertexts. */
export function add(first: number, second: number, p: number): number {
    return (first * second) % p;
}

/** Build bars for the current stage of the toy encryption. */
function makeBars(values: number[], labels: string[], active: number): VisualEntity[] {
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

/** The Benaloh generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number; randomness?: number; otherMessage?: number; otherRandomness?: number } | null) ?? {};
    const key = makeKey(11, 5, 2, 2);
    const message = ((Math.floor(task.message ?? 3) % key.r) + key.r) % key.r;
    const randomness = ((Math.floor(task.randomness ?? 2) % key.r) + key.r) % key.r;
    const otherMessage = ((Math.floor(task.otherMessage ?? 1) % key.r) + key.r) % key.r;
    const otherRandomness = ((Math.floor(task.otherRandomness ?? 4) % key.r) + key.r) % key.r;
    const ciphertext = encrypt(message, randomness, key);
    const recovered = decrypt(ciphertext, key);
    const second = encrypt(otherMessage, otherRandomness, key);
    const combined = add(ciphertext, second, key.p);
    const homomorphic = decrypt(combined, key) === (message + otherMessage) % key.r;
    const baseMeta = { p: key.p, r: key.r, message, randomness, ciphertext: 0, recovered: -1, homomorphic: false, toy: true };

    yield {
        stepNumber: 0,
        entities: makeBars([message, randomness, 0, 0], ["message", "blinder", "ciphertext", "recovered"], 0),
        edges: [],
        description: `Benaloh toy encryption in the field of size ${key.p} with message space ${key.r}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...baseMeta, ciphertext: 0 },
    };

    yield {
        stepNumber: 1,
        entities: makeBars([key.y, key.base, key.factor, 0], ["public y", "test base", "residue exponent", "unused"], 0),
        edges: [],
        description: `Publish y = ${key.y} and the residuosity test base ${key.base}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...baseMeta, y: key.y, base: key.base, factor: key.factor },
    };

    yield {
        stepNumber: 2,
        entities: makeBars([message, randomness, ciphertext, 0], ["message", "blinder", "ciphertext", "recovered"], 2),
        edges: [],
        description: `Ciphertext = g^message times y^blinder modulo ${key.p} equals ${ciphertext}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...baseMeta, ciphertext },
    };

    yield {
        stepNumber: 3,
        entities: makeBars([ciphertext, powMod(ciphertext, key.factor, key.p), recovered, message], ["ciphertext", "residue", "recovered", "expected"], 2),
        edges: [],
        description: `Test r-th residuosity and recover message ${recovered}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...baseMeta, ciphertext, recovered },
    };

    yield {
        stepNumber: 4,
        entities: makeBars([ciphertext, second, combined, (message + otherMessage) % key.r], ["cipher 1", "cipher 2", "product", "message sum"], 2),
        edges: [],
        description: `Multiplying ciphertexts adds messages modulo ${key.r}: ${homomorphic ? "confirmed" : "failed"}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...baseMeta, ciphertext, recovered, second, combined, homomorphic, done: true },
    };
}

/** The Benaloh toy module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The receiver publishes a generator and a random-looking residue. To encrypt a small message you raise the generator to the message, multiply by the residue raised to a random blinder, and send the product. The random blinder means the same message gives different ciphertexts each time. Multiplying two ciphertexts adds their messages, and only someone who knows the residue root can undo the masking.",
        invariants: [
            "A ciphertext is g to the message times y to the blinder modulo p.",
            "The public residue y is an r-th power, so its contribution vanishes under the residuosity test.",
            "Decryption returns the unique message whose generator power matches the ciphertext residue.",
        ],
        correctness:
            "Raising the ciphertext to the exponent (p-1)/r gives the test base raised to the message because the blinded factor is an r-th power and contributes one. The test base has order exactly r, so scanning all r candidate messages finds exactly one match, which is the original message. Multiplying two ciphertexts multiplies generator powers, so the exponent becomes the sum of the messages modulo r, giving the homomorphic property. Exhaustive checks over the full message and blinder space confirm both facts for this small instance.",
        complexityRationale:
            "Key setup and encryption each use two exponentiations with repeated squaring, costing O(log p). Decryption tries up to r candidates, each an exponentiation, so O(r log p). All state is a constant number of field elements.",
        uses: [
            "Teaching additive homomorphic encryption and residuosity assumptions",
            "Conceptual model for electronic voting tallying",
            "Building block for threshold and distributed decryption protocols",
        ],
        references: [
            "Benaloh, Dense Probabilistic Encryption, 1994",
            "Goldwasser and Micali, Probabilistic Encryption, 1984",
        ],
        workedExample:
            "With p = 11, r = 5, generator 2, and secret root 2, the public residue is 2^5 mod 11 = 10 and the test base is 2^2 = 4. Encrypting message 3 with blinder 2 gives 2^3 times 10^2 mod 11 = 8. Raising 8 to the power 2 gives 9, and 4^3 mod 11 is 9, so the message recovers as 3.",
    },
    id: "benaloh",
    name: "Benaloh Encryption (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(r log p)", space: "O(1)" },
    defaultInput: { message: 3, randomness: 2, otherMessage: 1, otherRandomness: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a prime p and small prime r dividing p minus one",
        "choose a generator whose residue test has order r",
        "derive the public residue from a secret root",
        "encrypt by multiplying generator and residue powers",
        "decrypt by testing r-th residuosity for each message",
        "multiply two ciphertexts to add their messages",
        "done: report decryption and homomorphic verdicts",
    ],
};

export default module;
