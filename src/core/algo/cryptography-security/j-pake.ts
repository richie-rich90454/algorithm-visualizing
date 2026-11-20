/**
 * j-pake.ts - J-PAKE Algebraic Core with Schnorr Proofs (Toy Field)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * J-PAKE is a password-authenticated key exchange in which both parties
 * contribute two random secrets. Each publishes g raised to those secrets,
 * together with a zero-knowledge proof that it knows the exponents. Both sides
 * then combine the other party's public values with their own secrets to reach
 * the same shared value g^((x1+x2)(y1+y2)), which is later mixed with the
 * password. The Schnorr proofs stop a party from completing the exchange with
 * values it cannot open. This module uses a small prime field and a toy hash
 * for the challenges, so it is a teaching core, not a secure PAKE.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(log p) per exponentiation, eight exponentiations per exchange
 *   Space: O(1) for the public values and proofs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Rows show the four public values and the resulting shared secret.
 *   - A failed proof is marked in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export const PRIME = 1009;
export const GENERATOR = 2;
export const ORDER = PRIME - 1;

export function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1 % modulus;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

function publicValue(secret: number): number {
    return modPow(GENERATOR, ((secret % ORDER) + ORDER) % ORDER, PRIME);
}

/** Deterministic toy challenge hash binding the label, commitment, and key. */
export function challenge(label: string, commitment: number, key: number): number {
    let value = 2166136261;
    for (const ch of `${label}|${commitment}|${key}`) {
        value = Math.imul(value ^ ch.charCodeAt(0), 16777619) >>> 0;
    }
    return (value % (ORDER - 1)) + 1;
}

export interface SchnorrProof {
    commitment: number;
    challenge: number;
    response: number;
    key: number;
}

/** Prove knowledge of a secret exponent with a Schnorr-style transcript. */
export function schnorrProve(secret: number, label: string, nonce: number): SchnorrProof {
    const key = publicValue(secret);
    const commitment = modPow(GENERATOR, ((nonce % ORDER) + ORDER) % ORDER, PRIME);
    const c = challenge(label, commitment, key);
    return { commitment, challenge: c, response: ((nonce + c * secret) % ORDER + ORDER) % ORDER, key };
}

/** Verify that the response is consistent with the commitment and public key. */
export function schnorrVerify(proof: SchnorrProof, label: string): boolean {
    if (challenge(label, proof.commitment, proof.key) !== proof.challenge) return false;
    const left = modPow(GENERATOR, proof.response, PRIME);
    const right = (proof.commitment * modPow(proof.key, proof.challenge, PRIME)) % PRIME;
    return left === right;
}

export interface JPakeResult {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    aliceSecret: number;
    bobSecret: number;
    proofsValid: boolean;
}

/** Run the algebraic core of J-PAKE for four secret exponents. */
export function jPake(a1: number, a2: number, b1: number, b2: number, nonces: number[] = [3, 5, 7, 11]): JPakeResult {
    const proofs = [
        schnorrProve(a1, "alice-1", nonces[0] ?? 3),
        schnorrProve(a2, "alice-2", nonces[1] ?? 5),
        schnorrProve(b1, "bob-1", nonces[2] ?? 7),
        schnorrProve(b2, "bob-2", nonces[3] ?? 11),
    ];
    const x1 = proofs[0]!.key;
    const x2 = proofs[1]!.key;
    const y1 = proofs[2]!.key;
    const y2 = proofs[3]!.key;
    const proofsValid = proofs.every((proof, i) => schnorrVerify(proof, ["alice-1", "alice-2", "bob-1", "bob-2"][i] ?? ""));
    const aliceSecret = modPow(((y1 * y2) % PRIME), ((a1 + a2) % ORDER + ORDER) % ORDER, PRIME);
    const bobSecret = modPow(((x1 * x2) % PRIME), ((b1 + b2) % ORDER + ORDER) % ORDER, PRIME);
    return { x1, x2, y1, y2, aliceSecret, bobSecret, proofsValid };
}

function bytesOf(value: number): number[] {
    return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff, 0, 0, 0, 0];
}

function rowCells(row: number, value: number, state: EntityState): VisualEntity[] {
    return bytesOf(value).map((v, col) => ({
        id: `byte-${row}-${col}`,
        type: "cell" as const,
        label: v.toString(16).toUpperCase().padStart(2, "0"),
        value: v,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row, col },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { aliceSecrets?: number[]; bobSecrets?: number[]; nonces?: number[] } | null) ?? {};
    const alice = Array.isArray(task.aliceSecrets) && task.aliceSecrets.length >= 2 ? task.aliceSecrets : [13, 29];
    const bob = Array.isArray(task.bobSecrets) && task.bobSecrets.length >= 2 ? task.bobSecrets : [17, 23];
    const nonces = Array.isArray(task.nonces) && task.nonces.length >= 4 ? task.nonces : [3, 5, 7, 11];

    const result = jPake(alice[0] ?? 0, alice[1] ?? 0, bob[0] ?? 0, bob[1] ?? 0, nonces);
    let step = 0;

    const frame = (phase: number, description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: [
            ...rowCells(0, phase >= 1 ? result.x1 : 0, phase >= 1 ? "active" : "unvisited"),
            ...rowCells(1, phase >= 1 ? result.x2 : 0, phase >= 1 ? "active" : "unvisited"),
            ...rowCells(2, phase >= 2 ? result.y1 : 0, phase >= 2 ? "pivot" : "unvisited"),
            ...rowCells(3, phase >= 2 ? result.y2 : 0, phase >= 2 ? "pivot" : "unvisited"),
            ...rowCells(4, phase >= 3 ? result.aliceSecret : 0, phase >= 3 ? (result.aliceSecret === result.bobSecret ? "sorted" : "error") : "unvisited"),
        ],
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows: 5,
            cols: 8,
            prime: PRIME,
            proofsValid: result.proofsValid,
            aliceSecret: result.aliceSecret,
            bobSecret: result.bobSecret,
            agreed: result.proofsValid && result.aliceSecret === result.bobSecret,
        },
    });

    yield frame(0, "Agree on a prime field and generator for the exchange.", 0);
    yield frame(1, "Alice publishes two public values with Schnorr proofs of knowledge.", 1);
    yield frame(2, "Bob publishes two public values with Schnorr proofs of knowledge.", 2);
    yield frame(3, `Both sides combine the values; ${result.aliceSecret === result.bobSecret ? "the shared secret agrees" : "the secrets differ"}.`, 3);
}

const module: AlgorithmModule = {
    id: "j-pake",
    name: "J-PAKE Algebraic Core (Toy Field)",
    category: "cryptography-security",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { aliceSecrets: [13, 29], bobSecrets: [17, 23], nonces: [3, 5, 7, 11] },
    visualType: "grid",
    run,
    pseudocode: [
        "Alice chooses secrets x1 and x2 and publishes g to x1 and g to x2 with proofs",
        "Bob chooses secrets y1 and y2 and publishes g to y1 and g to y2 with proofs",
        "each party verifies the other party's Schnorr proofs",
        "Alice computes (g to y1 times g to y2) raised to x1 plus x2",
        "Bob computes (g to x1 times g to x2) raised to y1 plus y2",
        "both obtain g to (x1+x2)(y1+y2), the shared secret",
        "mix the shared secret with the password to form the session key",
    ],
    education: {
        intuition:
            "J-PAKE gets password authentication without ever sending the password: two parties each contribute two random exponents and prove they know them. The shared value is symmetric, so both sides compute the same group element. The proofs matter because a party that simply copies public values without knowing the exponents must fail verification.",
        invariants: [
            "Each published value g^x carries a Schnorr proof of knowledge of x.",
            "The shared value depends on both parties' secret exponents symmetrically.",
            "A valid proof satisfies g^s = commitment times key raised to the challenge.",
        ],
        correctness:
            "Alice computes (g^{y1} g^{y2})^{x1+x2} = g^{(y1+y2)(x1+x2)}; Bob computes (g^{x1} g^{x2})^{y1+y2} = g^{(x1+x2)(y1+y2)}. Exponents commute, so both values are identical. A modified proof fails the Schnorr equation unless the prover can solve the discrete log, so an adversary without the secrets cannot impersonate a party.",
        complexityRationale:
            "Four proofs and two key derivations need a constant number of modular exponentiations, each O(log p) multiplications, with only public values and proofs stored.",
        uses: [
            "Password-authenticated key exchange in PAKE protocols",
            "Teaching zero-knowledge proofs of knowledge",
            "Secure pairing of devices with a short shared secret",
        ],
        references: [
            "Hao and Ryan, Password Authenticated Key Exchange by Juggling, 2008",
            "RFC 8235, J-PAKE: Password Authenticated Key Exchange by Juggling",
        ],
        workedExample:
            "With Alice secrets 13 and 29 and Bob secrets 17 and 23, each side publishes two public values and a Schnorr proof. Alice computes (g^17 * g^23)^42 and Bob computes (g^13 * g^29)^40; both equal g^(42*40) mod 1009, and the final frame marks the agreement.",
    },
};

export default module;
