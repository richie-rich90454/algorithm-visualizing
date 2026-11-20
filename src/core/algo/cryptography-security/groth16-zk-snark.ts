/**
 * groth16-zk-snark.ts - Groth16 Pairing Check in a Toy Field
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Groth16 is a zero-knowledge proof system whose verifier checks one pairing
 * equation: e(A, B) = e(alpha, beta) * e(L, gamma) * e(C, delta). This module
 * reproduces that exact algebraic step in the additive field modulo 97, where
 * the pairing is ordinary modular multiplication and is bilinear. A witness
 * satisfies two multiplication constraints if and only if the check passes, so
 * the verification arithmetic is exact. This is a small teaching model of the
 * verifier equation only: it has no elliptic curves, no trusted setup ceremony,
 * no zero knowledge, and provides no production security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(1) field operations for the fixed two-constraint example
 *   Space: O(1) field elements
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Ten bars show the witness, the proof elements, and the final verdict.
 *   - The proof elements are yellow while built and green when accepted.
 *   - The pairing products and acceptance flag are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 97;
const R1 = 3;
const R2 = 7;
const TAU = 11;
const ALPHA = 5;
const BETA = 9;
const GAMMA = 13;
const DELTA = 17;
const RAND_R = 3;
const RAND_S = 4;

function mod(value: number): number {
    return ((value % P) + P) % P;
}

/** Modular inverse by the extended Euclidean algorithm. */
function inverse(value: number): number {
    let a = mod(value);
    let b = P;
    let x0 = 1;
    let x1 = 0;
    while (b !== 0) {
        const quotient = Math.floor(a / b);
        const remainder = a - quotient * b;
        a = b;
        b = remainder;
        const next = x0 - quotient * x1;
        x0 = x1;
        x1 = next;
    }
    return a === 1 ? mod(x0) : 0;
}

/** Build the fixed set of ten value bars. */
function makeBars(
    values: Record<string, number>,
    proofState: EntityState,
    verdict: number,
): VisualEntity[] {
    const labels = ["u", "v", "w", "x", "y", "A", "B", "C", "L", "check"];
    return labels.map((label, index) => {
        const proof = ["A", "B", "C", "L"].includes(label);
        return {
            id: `bar-${label}`,
            type: "bar" as const,
            label: `${label}=${values[label] ?? 0}`,
            value: values[label] ?? 0,
            state: label === "check" ? (verdict > 0 ? "sorted" : "error") : proof ? proofState : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, role: label },
        };
    });
}

/** The toy Groth16 verifier generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { u?: number; v?: number; w?: number; x?: number; y?: number; r?: number; s?: number } | null
    ) ?? {};
    const u = mod(typeof task.u === "number" ? Math.floor(task.u) : 2);
    const v = mod(typeof task.v === "number" ? Math.floor(task.v) : 3);
    const w = mod(typeof task.w === "number" ? Math.floor(task.w) : u * v);
    const x = mod(typeof task.x === "number" ? Math.floor(task.x) : 5);
    const y = mod(typeof task.y === "number" ? Math.floor(task.y) : w * x);
    const randR = typeof task.r === "number" ? mod(Math.floor(task.r)) : RAND_R;
    const randS = typeof task.s === "number" ? mod(Math.floor(task.s)) : RAND_S;

    const d1 = mod((TAU - R2) * inverse(R1 - R2));
    const d2 = mod((TAU - R1) * inverse(R2 - R1));
    const aHat = mod(u * d1 + w * d2);
    const bHat = mod(v * d1 + x * d2);
    const cHat = mod(w * d1 + y * d2);
    const zTau = mod((TAU - R1) * (TAU - R2));
    const invDelta = inverse(DELTA);
    const invGamma = inverse(GAMMA);
    const h = mod(-mod(u * x + w * v - u * v - w * x) * inverse(mod((R1 - R2) * (R1 - R2))));

    const a = mod(ALPHA + aHat + randR * DELTA);
    const b = mod(BETA + bHat + randS * DELTA);
    const l = mod(mod(BETA * aHat + ALPHA * bHat + cHat) * invGamma);
    const c = mod(mod(h * zTau) * invDelta + randS * a + randR * b - randR * randS * DELTA);
    const left = mod(a * b);
    const right = mod(ALPHA * BETA + l * GAMMA + c * DELTA);
    const accept = left === right;
    const constraintsMet = mod(u * v) === w && mod(w * x) === y;

    const values: Record<string, number> = { u, v, w, x, y, A: 0, B: 0, C: 0, L: 0, check: 0 };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(values, "unvisited", 0),
        edges: [],
        description: `Toy Groth16 verifier in the field modulo ${P}: check e(A,B) against e(alpha,beta) times e(L,gamma) times e(C,delta).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { p: P, accept: false, constraintsMet, left: 0, right: 0, proof: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(values, "unvisited", 0),
        edges: [],
        description: `The public witness is u=${u}, v=${v}, w=${w}, x=${x}, y=${y}; the constraints are u*v=w and w*x=y.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { p: P, accept: false, constraintsMet, left: 0, right: 0, proof: false },
    };
    step += 1;

    values["A"] = aHat;
    values["B"] = bHat;
    values["C"] = cHat;
    yield {
        stepNumber: step,
        entities: makeBars(values, "comparing", 0),
        edges: [],
        description: `QAP evaluations at the secret point give A-hat=${aHat}, B-hat=${bHat}, C-hat=${cHat}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { p: P, accept: false, constraintsMet, left: 0, right: 0, proof: false, aHat, bHat, cHat, d1, d2 },
    };
    step += 1;

    values["A"] = a;
    values["B"] = b;
    values["C"] = c;
    values["L"] = l;
    yield {
        stepNumber: step,
        entities: makeBars(values, "comparing", 0),
        edges: [],
        description: `The proof is A=${a}, B=${b}, C=${c}; the public-input combination gives L=${l}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { p: P, accept: false, constraintsMet, left: 0, right: 0, proof: true, aHat, bHat, cHat, h, zTau, A: a, B: b, C: c, L: l },
    };
    step += 1;

    values["check"] = accept ? 1 : 0;
    yield {
        stepNumber: step,
        entities: makeBars(values, "sorted", accept ? 1 : 0),
        edges: [],
        description: accept
            ? `e(A,B)=${left} equals e(alpha,beta)e(L,gamma)e(C,delta)=${right}; the proof is accepted.`
            : `e(A,B)=${left} differs from e(alpha,beta)e(L,gamma)e(C,delta)=${right}; the proof is rejected.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { p: P, accept, constraintsMet, left, right, proof: true, A: a, B: b, C: c, L: l, h },
    };
}

/** The toy Groth16 module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Groth16 turns a statement about polynomials into three group elements called A, B, and C. The verifier never sees the witness; it only combines those elements with the public inputs and checks one pairing equation. A bilinear pairing lets products in the exponent become pairings, so the verifier can compare the two sides without knowing the secret setup values. This demo replaces the pairings with multiplication modulo a small prime so the arithmetic is easy to inspect.",
        invariants: [
            "The pairing is bilinear: e(a+c, b) equals e(a, b) plus e(c, b) modulo the field.",
            "The proof elements are built from the witness and fixed setup values in the field.",
            "The check passes exactly when the two multiplication constraints hold modulo the field.",
        ],
        correctness:
            "Expanding A times B and using the QAP identity A-hat times B-hat minus C-hat equals h times Z shows that A times B minus alpha times beta minus L times gamma minus C times delta equals the polynomial remainder evaluated at the secret point. For a valid witness the remainder is zero, so the check passes; for an invalid witness the remainder is a nonzero linear polynomial and the check fails at the chosen secret point. Multiplying modulo a prime is a valid bilinear map over the additive group of the field, making the check exact.",
        complexityRationale:
            "The toy verifier does a fixed number of field multiplications and one modular inverse, so time and space are constant. A real Groth16 verifier instead performs a constant number of expensive bilinear pairings on an elliptic curve and stores a common reference string proportional to the circuit size.",
        uses: [
            "Understanding the verification equation behind succinct blockchain proofs",
            "A teaching model for bilinear pairings and polynomial commitments",
            "Comparing proof systems such as Groth16, PLONK, and STARKs",
        ],
        references: [
            "Groth, On the Size of Pairing-based Non-interactive Arguments, 2016",
            "Ben-Sasson et al., Zerocash: Decentralized Anonymous Payments, 2014",
        ],
        workedExample:
            "In the field modulo 97 with witness u=2, v=3, w=6, x=5, y=30 both constraints hold. The proof gives A=66, B=84, C=79, and L=66. The left pairing product is 15 and the right product is also 15, so the verifier accepts. Changing w to 7 makes the products 86 and 57, so it rejects.",
    },
    id: "groth16-zk-snark",
    name: "Groth16 zk-SNARK (Toy Pairing Check)",
    category: "cryptography-security",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { u: 2, v: 3, w: 6, x: 5, y: 30 },
    visualType: "array",
    run,
    pseudocode: [
        "fix a prime field and the verification key alpha, beta, gamma, delta",
        "read the public witness and state the two multiplication constraints",
        "evaluate the QAP polynomials at the hidden point",
        "compute the quotient polynomial from the witness",
        "build proof elements A, B, C and the public combination L",
        "compute the left pairing product e(A, B)",
        "compute the right product e(alpha, beta) e(L, gamma) e(C, delta)",
        "accept only when the two products are equal",
    ],
};

export default module;
