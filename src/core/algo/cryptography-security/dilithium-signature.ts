/**
 * dilithium-signature.ts - Toy Lattice Signature With the Fiat-Shamir Shape
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a small teaching model of a lattice signature in the style of
 * Dilithium, not the real scheme. A signer hides a short secret vector s behind
 * a public value t = a times s, commits with a masking value y, derives a small
 * challenge c from the commitment and message, and answers with z = y plus c
 * times s. Verification checks that a times z equals the commitment plus c
 * times t modulo q, which holds by substitution. Only one scalar coordinate is
 * shown, so the arithmetic is exact but the result is not secure.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) modular operations for this one-coordinate toy
 *   Space: O(1) values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars reveal the public value, commitment, challenge, response, and check.
 *   - The final frame reports whether the verification equation holds.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface DilithiumInput {
    q?: number;
    a?: number;
    s?: number;
    y?: number;
    message?: string;
}

/** Deterministic small challenge derived from the commitment and message. */
function challenge(commitment: number, message: string): number {
    let sum = 0;
    for (let i = 0; i < message.length; i += 1) {
        sum += message.charCodeAt(i);
    }
    return ((commitment + sum + message.length) % 3) + 1;
}

function mod(value: number, q: number): number {
    return ((value % q) + q) % q;
}

function bars(values: Array<{ label: string; value: number; revealed: boolean }>): VisualEntity[] {
    return values.map((item, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: item.revealed ? `${item.label}=${item.value}` : `${item.label}=?`,
        value: item.revealed ? item.value : 0,
        state: item.revealed ? ("sorted" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: item.label },
    }));
}

/** Run the toy sign-and-verify flow. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DilithiumInput | null) ?? {};
    const q = typeof task.q === "number" && task.q > 3 ? task.q : 97;
    const a = typeof task.a === "number" ? mod(task.a, q) : 13;
    const s = typeof task.s === "number" ? mod(task.s, q) : 7;
    const y = typeof task.y === "number" ? mod(task.y, q) : 3;
    const message = typeof task.message === "string" ? task.message : "hi";
    const bound = Math.floor(q / 3);

    const t = mod(a * s, q);
    const commitment = mod(a * y, q);
    const c = challenge(commitment, message);
    const z = mod(y + c * s, q);
    const left = mod(a * z, q);
    const right = mod(commitment + c * t, q);
    const withinBound = z <= bound;
    const verified = left === right && withinBound;

    const all = [
        { label: "t", value: t, revealed: false },
        { label: "w", value: commitment, revealed: false },
        { label: "c", value: c, revealed: false },
        { label: "z", value: z, revealed: false },
        { label: "lhs", value: left, revealed: false },
        { label: "rhs", value: right, revealed: false },
    ];
    const reveal = (count: number) => all.map((item, index) => ({ ...item, revealed: index < count }));

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(all),
        edges: [],
        description: `Toy lattice signature modulo ${q}: build a public value, commit, and answer a challenge.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { q, t: -1, w: -1, c: -1, z: -1, lhs: -1, rhs: -1, verified: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(reveal(1)),
        edges: [],
        description: `Public value t = a times s mod q = ${t}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { q, t, w: -1, c: -1, z: -1, lhs: -1, rhs: -1, verified: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(reveal(3)),
        edges: [],
        description: `Commitment w = a times y mod q = ${commitment}; message challenge c = ${c}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { q, t, w: commitment, c, z: -1, lhs: -1, rhs: -1, verified: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(reveal(4)),
        edges: [],
        description: `Response z = y plus c times s mod q = ${z}${withinBound ? " (within bound)" : " (too large)"}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { q, t, w: commitment, c, z, lhs: -1, rhs: -1, verified: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(reveal(6)),
        edges: [],
        description:
            `Verify a*z = ${left} and w + c*t = ${right} modulo ${q}; ` +
            (verified ? "the signature verifies." : "the signature is rejected."),
        codeLineNumber: 6,
        layout: "array",
        meta: { q, t, w: commitment, c, z, lhs: left, rhs: right, verified },
    };
}

/** The toy Dilithium signature module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Lattice signatures hide a short secret in a public linear relation, then prove knowledge of it without revealing it. The signer masks the secret with a random value, derives a small challenge from the commitment and the message, and returns a short combination. A verifier checks a linear equation that holds because the public value was built from the same secret.",
        invariants: [
            "The public value satisfies t = a times s modulo q.",
            "The commitment is w = a times y modulo q using a masking value y.",
            "The response z is y plus the challenge c times the secret s.",
        ],
        correctness:
            "Multiplying the response by a gives a times z = a times y plus c times a times s, which equals w plus c times t modulo q by the definitions of w and t. The verifier recomputes both sides and accepts only when they match and the response is short, which is the Fiat-Shamir with aborts pattern. This one-coordinate toy demonstrates the identity but not the hardness or security of real Dilithium.",
        complexityRationale:
            "Each step is a constant number of modular additions and multiplications, so this toy runs in O(1) time and space. Real Dilithium operates on polynomial vectors and costs time proportional to the dimension, but rests on the same verification identity.",
        uses: [
            "Post-quantum digital signatures resistant to Shor's algorithm",
            "Code signing and firmware authentication in a quantum era",
            "A teaching model for rejection sampling and Fiat-Shamir signatures",
        ],
        references: [
            "Ducas et al., CRYSTALS-Dilithium: A Lattice-Based Digital Signature Scheme, 2018",
            "Fiat and Shamir, How to Prove Yourself Practical Solutions, 1986",
        ],
        workedExample:
            "With q=97, a=13, s=7, y=3, and message hi, the public value is t=91 and the commitment is w=39. The challenge is c=2 and the response is z=17. Verification checks a times z = 27 against w plus c times t = 221 modulo 97, also 27, so the toy signature is accepted.",
    },
    id: "dilithium-signature",
    name: "Dilithium Signature (Toy Lattice Model)",
    category: "cryptography-security",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { q: 97, a: 13, s: 7, y: 3, message: "hi" },
    visualType: "array",
    run,
    pseudocode: [
        "choose a modulus, public a, short secret s, and mask y",
        "set public value t to a times s modulo q",
        "set commitment w to a times y modulo q",
        "derive a small challenge c from w and the message",
        "set response z to y plus c times s modulo q",
        "check a times z against w plus c times t modulo q",
        "done: report whether the signature verifies",
    ],
};

export default module;
