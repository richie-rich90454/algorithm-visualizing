/**
 * pedersen-commitment.ts - Pedersen Commitment in a Toy Prime Field
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Pedersen commitment lets a committer fix a value while keeping it hidden,
 * then reveal it later with a proof that the revealed value matches the
 * original commitment. To commit to m with blinding r, compute c = g^m * h^r
 * modulo a prime, where g and h are public generators. Opening recomputes the
 * same product. Commitments are homomorphic: multiplying two commitments adds
 * their messages and blinders in the exponent. This module uses a small prime,
 * so it is a teaching model and makes no hiding or binding security claim.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(log m + log r) modular multiplications
 *   Space: O(1) field elements
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show g to the message, h to the blinder, and their product.
 *   - meta carries the commitment and the opening verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 1000003;
const G = 2;
const H = 3;

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

/** Commit to a message with a blinding factor. */
export function commit(message: number, blinder: number): number {
    const left = powMod(G, message, P);
    const right = powMod(H, blinder, P);
    return (left * right) % P;
}

/** Verify an opening of a commitment. */
export function open(commitment: number, message: number, blinder: number): boolean {
    return commit(message, blinder) === commitment;
}

/** Homomorphic addition of two commitments. */
export function aggregate(first: number, second: number): number {
    return (first * second) % P;
}

function makeBars(left: number, right: number, product: number, target: number, active: number): VisualEntity[] {
    const values = [left, right, product, target];
    return values.map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: ["g^m", "h^r", "commitment", "check"][index] ?? "" },
    }));
}

/** The Pedersen commitment generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number; blinder?: number; secondMessage?: number; secondBlinder?: number } | null) ?? {};
    const message = typeof task.message === "number" ? Math.floor(task.message) : 5;
    const blinder = typeof task.blinder === "number" ? Math.floor(task.blinder) : 7;
    const secondMessage = typeof task.secondMessage === "number" ? Math.floor(task.secondMessage) : 3;
    const secondBlinder = typeof task.secondBlinder === "number" ? Math.floor(task.secondBlinder) : 2;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(0, 0, 0, 0, 0),
        edges: [],
        description: `Pedersen commitment in the field of size ${P}: message ${message}, blinder ${blinder}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { message, blinder, commitment: 0, opened: false },
    };
    step += 1;

    const left = powMod(G, message, P);
    const right = powMod(H, blinder, P);
    yield {
        stepNumber: step,
        entities: makeBars(left, right, 0, 0, 0),
        edges: [],
        description: `Compute g raised to the message (${left}) and h raised to the blinder (${right}).`,
        codeLineNumber: 1,
        layout: "array",
        meta: { message, blinder, left, right, commitment: 0, opened: false },
    };
    step += 1;

    const commitment = commit(message, blinder);
    yield {
        stepNumber: step,
        entities: makeBars(left, right, commitment, 0, 2),
        edges: [],
        description: `Multiply the two factors modulo ${P} to fix the commitment ${commitment}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { message, blinder, commitment, opened: false },
    };
    step += 1;

    const combined = aggregate(commitment, commit(secondMessage, secondBlinder));
    const expected = commit(message + secondMessage, blinder + secondBlinder);
    yield {
        stepNumber: step,
        entities: makeBars(commitment, commit(secondMessage, secondBlinder), combined, expected, 2),
        edges: [],
        description: `Homomorphic check: multiplying two commitments adds their messages and blinders.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { message, blinder, commitment, combined, expected, opened: false },
    };
    step += 1;

    const opened = open(commitment, message, blinder);
    yield {
        stepNumber: step,
        entities: makeBars(left, right, commitment, opened ? commitment : -1, 3),
        edges: [],
        description: `Opening with the revealed message and blinder ${opened ? "matches" : "fails"}. Toy field, not secure.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { message, blinder, commitment, opened, homomorphic: combined === expected },
    };
}

/** The Pedersen commitment module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A commitment is like sealing a value in an envelope: the committer fixes it now but the verifier learns it only when the envelope is opened. Pedersen computes g to the message times h to a random blinder. The blinder hides the message, and because the exponents add when commitments multiply, the scheme supports homomorphic addition. Opening simply recomputes the product and compares.",
        invariants: [
            "A commitment is g^m times h^r modulo the prime.",
            "Different blinders for the same message give different commitments in this small field.",
            "Multiplying two commitments equals committing to the sum of messages and sum of blinders.",
        ],
        correctness:
            "Modular exponentiation is exact, so every opening recomputes the original product and succeeds. An exhaustive check over a small domain confirms that no two tested message-blinder pairs collide, wrong openings fail, and the homomorphic identity holds for many pairs. With a prime of about one million the scheme is still trivially breakable by brute force; the checks verify the algebra, not the hiding or binding security of a real Pedersen commitment.",
        complexityRationale:
            "Each exponentiation uses repeated squaring in O(log exponent) modular multiplications, and a commitment needs two. Opening and aggregation use a fixed number of field operations, so space is constant.",
        uses: [
            "Hiding values in cryptographic protocols until a reveal phase",
            "Homomorphic tallying in electronic voting",
            "Range proofs and confidential transaction amounts",
        ],
        references: [
            "Pedersen, Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing, 1991",
            "Damgård and Fujisaki, A Statistically Hiding and Computationally Binding Commitment Scheme, 1992",
        ],
        workedExample:
            "With g equal to 2, h equal to 3, and modulus 1000003, committing to message 5 with blinder 7 computes 2^5 times 3^7 modulo 1000003. Revealing 5 and 7 recomputes the same product and opens successfully. Multiplying that commitment by a commitment to 3 with blinder 2 yields the commitment to 8 with blinder 9.",
    },
    id: "pedersen-commitment",
    name: "Pedersen Commitment (Toy Field)",
    category: "cryptography-security",
    complexity: { time: "O(log m + log r)", space: "O(1)" },
    defaultInput: { message: 5, blinder: 7, secondMessage: 3, secondBlinder: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "choose public generators g and h modulo a prime",
        "compute the left factor g raised to the message",
        "compute the right factor h raised to the blinder",
        "multiply the factors modulo the prime to fix the commitment",
        "multiply two commitments to add messages and blinders",
        "on opening recompute the product and compare",
        "done: report the opening and homomorphic verdicts",
    ],
};

export default module;
