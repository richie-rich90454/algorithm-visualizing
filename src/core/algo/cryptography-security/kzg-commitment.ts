/**
 * kzg-commitment.ts - KZG Polynomial Commitment (Toy Field)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A polynomial commitment lets a prover fix a polynomial with one short value
 * and later convince a verifier of its value at a chosen point. KZG publishes
 * powers of a hidden setup secret s, commits to f as a group element encoding
 * f(s), and opens at z with a quotient witness encoding q(s) where
 * f(x) - f(z) = (x - z) q(x). The pairing check is replaced here by an exact
 * exponent equality over a small field, so the toy is fully verifiable but not
 * cryptographically secure.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d^2) polynomial division and evaluation for degree d
 *   Space: O(d) for the setup powers and quotient coefficients
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero holds polynomial coefficients; row one holds setup powers.
 *   - The opening frame shows the quotient coefficients and the verify check.
 *   - meta carries the claimed value, the witness, and both verdicts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface KzgInput {
    coefficients?: number[];
    z?: number;
    p?: number;
    s?: number;
}

function cell(id: string, row: number, col: number, label: string, value: string | number, state: EntityState): VisualEntity {
    return { id, type: "cell", label, value, state, x: 0, y: 0, width: 0, height: 0, metadata: { row, col } };
}

/** Evaluate a polynomial with integer coefficients at a point. */
function evalPoly(coefficients: number[], x: number): number {
    let result = 0;
    for (let i = coefficients.length - 1; i >= 0; i -= 1) result = result * x + (coefficients[i] as number);
    return result;
}

/** Synthetic division of f(x) - f(z) by (x - z), returning quotient coefficients. */
function quotient(coefficients: number[], z: number): number[] {
    const remainder = [...coefficients];
    remainder[0] = (remainder[0] as number) - evalPoly(coefficients, z);
    const result = new Array<number>(remainder.length - 1).fill(0);
    let carry = 0;
    for (let i = remainder.length - 1; i >= 1; i -= 1) {
        const coefficient = (remainder[i] as number) + carry;
        result[i - 1] = coefficient;
        carry = coefficient * z;
    }
    return result;
}

function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as KzgInput | null) ?? {};
    const coefficients = Array.isArray(task.coefficients) && task.coefficients.length > 1 ? task.coefficients.map(Number) : [4, 3, 2];
    const z = Math.floor(task.z ?? 5);
    const p = Math.max(11, Math.floor(task.p ?? 97));
    const s = Math.floor(task.s ?? 13);
    const order = p - 1;
    const g = 2;
    const fAtS = evalPoly(coefficients, s);
    const fAtZ = evalPoly(coefficients, z);
    const q = quotient(coefficients, z);
    const qAtS = evalPoly(q, s);
    const commitment = modPow(g, ((fAtS % order) + order) % order, p);
    const witness = modPow(g, ((qAtS % order) + order) % order, p);
    const lhs = ((((s - z) * qAtS) % order) + order) % order;
    const rhs = (((fAtS - fAtZ) % order) + order) % order;
    const valid = lhs === rhs;
    const fakeValue = fAtZ + 1;
    const fakeRhs = (((fAtS - fakeValue) % order) + order) % order;
    const tamperedValid = lhs === fakeRhs;
    let step = 0;
    const cols = Math.max(coefficients.length, q.length, 4);
    const emit = (entities: VisualEntity[], description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step++,
        entities,
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: 3, cols, p, z, s, ...meta },
    });

    yield emit(
        coefficients.map((c, i) => cell(`coef-${i}`, 0, i, String(c), c, "idle")),
        `Commit to a degree-${coefficients.length - 1} polynomial with ${coefficients.length} coefficients.`,
        0,
        { stage: "setup", coefficients: [...coefficients], generator: g },
    );

    const powers = coefficients.map((_, i) => modPow(g, modPow(s, i, order), p));
    yield emit(
        powers.map((power, i) => cell(`pow-${i}`, 1, i, `g^s^${i}=${power}`, power, "visited")),
        `Trusted setup publishes g raised to each power of the hidden secret s.`,
        1,
        { stage: "setup-powers", powers },
    );
    yield emit(
        [cell("commit", 2, 0, `C=${commitment}`, commitment, "sorted")],
        `Commitment C = g^f(s) mod p = ${commitment}; the polynomial is now fixed.`,
        2,
        { stage: "commit", commitment, fAtS },
    );
    yield emit(
        q.map((coefficient, i) => cell(`q-${i}`, 0, i, String(coefficient), coefficient, "active")),
        `Opening at z=${z}: divide f(x) - f(${fAtZ}) by (x - z) to get the quotient.`,
        3,
        { stage: "quotient", quotient: [...q], fAtZ },
    );
    yield emit(
        [cell("witness", 2, 1, `W=${witness}`, witness, "active")],
        `Witness W = g^q(s) mod p = ${witness}; send it with the claimed value ${fAtZ}.`,
        4,
        { stage: "witness", witness, qAtS },
    );
    yield emit(
        [cell("lhs", 1, 0, `lhs=${lhs}`, lhs, valid ? "sorted" : "error"), cell("rhs", 1, 1, `rhs=${rhs}`, rhs, valid ? "sorted" : "error")],
        `Verify exponent equality (s-z)q(s) = f(s)-f(z): ${lhs} = ${rhs}, ${valid ? "accepted" : "rejected"}.`,
        5,
        { stage: "verify", lhs, rhs, valid },
    );
    yield emit(
        [cell("fake", 1, 2, `fake=${fakeValue}`, fakeValue, "error"), cell("verdict", 2, 2, tamperedValid ? "accepted" : "rejected", tamperedValid ? "accepted" : "rejected", tamperedValid ? "error" : "sorted")],
        `Done: the honest claim verifies; changing the value to ${fakeValue} is ${tamperedValid ? "accepted" : "rejected"}.`,
        6,
        { stage: "done", value: fAtZ, fAtZ, fakeValue, valid, tamperedValid, commitment, witness, quotient: [...q] },
    );
}

/** The KZG polynomial commitment module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A commitment is like sealing a polynomial in an envelope and later revealing one evaluated value with a proof that it agrees with what was sealed. KZG seals the polynomial as one group element derived from a hidden setup secret. To open at a point it supplies a quotient witness; a bilinear pairing check confirms that the difference of values is divisible by the difference of inputs, exactly as for ordinary polynomials.",
        invariants: [
            "The commitment encodes f(s) for the hidden setup secret s.",
            "The quotient satisfies f(x) - f(z) = (x - z) q(x) as polynomials.",
            "The verify equation holds precisely when the claimed value matches the committed polynomial.",
        ],
        correctness:
            "Because f(x) - f(z) is zero at x = z, it factors as (x - z) q(x) for a polynomial q. Evaluating at the secret gives f(s) - f(z) = (s - z) q(s). The proof transmits encodings of f(s) and q(s); the verifier checks the multiplicative form of that identity with pairings, so a false claimed value would require breaking the factor relation. This toy replaces pairings with small-field exponent arithmetic and reveals s in metadata for teaching, so it offers no real security.",
        complexityRationale:
            "Computing the quotient by synthetic division costs O(d) per coefficient, or O(d^2) overall, and evaluating it at s is O(d). Storing the setup powers, commitment, and witness uses O(d) space.",
        uses: [
            "Succinct blockchain rollups and data availability proofs",
            "Verifiable computation and polynomial identity checks",
            "Zero-knowledge proof systems such as PLONK and Marlin",
        ],
        references: [
            "Kate, Zaverucha, and Goldberg, Constant-Size Commitments to Polynomials, 2010",
            "Boneh and Shoup, A Graduate Course in Applied Cryptography, chapter on polynomial commitments",
        ],
        workedExample:
            "For f(x) = 4 + 3x + 2x^2, z = 5 gives f(5) = 69. Dividing f(x) - 69 by (x - 5) yields quotient 2x + 13. The witness encodes q(s) and the verifier checks (s - 5) q(s) equals f(s) - 69; changing the claimed value breaks that equality.",
    },
    id: "kzg-commitment",
    name: "KZG Polynomial Commitment (Toy Field)",
    category: "cryptography-security",
    complexity: { time: "O(d^2)", space: "O(d)" },
    defaultInput: { coefficients: [4, 3, 2], z: 5, p: 97, s: 13 },
    visualType: "grid",
    run,
    pseudocode: [
        "publish group powers of a hidden setup secret s",
        "encode f of s as a short commitment value",
        "evaluate the polynomial at the challenge point z",
        "divide f of x minus f of z by x minus z",
        "encode the quotient at s as an opening witness",
        "verify the pairing-style exponent equality",
        "done: accept honest claims and reject altered values",
    ],
};

export default module;
