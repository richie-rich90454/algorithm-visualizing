/**
 * sum-check-protocol.ts - Sum-Check Protocol for a Multilinear Polynomial
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The sum-check protocol convinces a verifier that the sum of a multilinear
 * polynomial over the boolean cube equals a claimed value, without the
 * verifier adding every term. In each round the prover sends a univariate
 * polynomial in the next variable; the verifier checks that its values at zero
 * and one add up to the previous claim, then sends a random challenge. After
 * the last round the verifier evaluates the polynomial at the combined
 * challenges once and checks the final value. This module uses three variables,
 * degree one, and a small field so every message is checkable by hand.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(v * 2^v) for the prover, O(v + 1) evaluations for the verifier
 *   Space: O(v) for the challenge vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the current claim and the two values of the round polynomial.
 *   - meta reports each round, challenge, and the final verification verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 101;
const VARIABLES = 3;
const mod = (value: number): number => ((value % P) + P) % P;

/** The public multilinear polynomial g(x0,x1,x2). */
export function g(point: number[]): number {
    const [a = 0, b = 0, c = 0] = point;
    return mod(3 * a + 5 * b + 7 * c + 11 * a * b - 2 * b * c + 4);
}

/** Brute-force sum of g over the boolean cube. */
export function sumAll(): number {
    let total = 0;
    for (let a = 0; a < 2; a += 1) {
        for (let b = 0; b < 2; b += 1) {
            for (let c = 0; c < 2; c += 1) {
                total = mod(total + g([a, b, c]));
            }
        }
    }
    return total;
}

/** Sum g over the unassigned variables with a partial assignment fixed. */
function sumRemaining(prefix: number[], bit: number): number {
    let total = 0;
    const remaining = VARIABLES - prefix.length - 1;
    for (let mask = 0; mask < 2 ** remaining; mask += 1) {
        const suffix: number[] = [];
        for (let i = 0; i < remaining; i += 1) {
            suffix.push((mask >> i) & 1);
        }
        total = mod(total + g([...prefix, bit, ...suffix]));
    }
    return total;
}

/** Deterministic verifier challenges from a seed. */
export function challenges(seed: number): number[] {
    let state = (seed >>> 0) || 1;
    return Array.from({ length: VARIABLES }, () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return mod(state >>> 8);
    });
}

export interface RoundMessage {
    atZero: number;
    atOne: number;
}

/** Prover messages for a given claim and challenge vector. */
export function proverMessages(claim: number, choices: number[]): RoundMessage[] {
    const messages: RoundMessage[] = [];
    let prefix: number[] = [];
    for (let round = 0; round < VARIABLES; round += 1) {
        messages.push({ atZero: sumRemaining(prefix, 0), atOne: sumRemaining(prefix, 1) });
        prefix = [...prefix, choices[round] ?? 0];
    }
    return messages;
}

/** Verify a full transcript, returning per-round checks. */
export function verify(claim: number, choices: number[], messages: RoundMessage[]): boolean {
    if (messages.length !== VARIABLES || choices.length !== VARIABLES) {
        return false;
    }
    let expected = claim;
    for (let round = 0; round < VARIABLES; round += 1) {
        const message = messages[round]!;
        if (mod(message.atZero + message.atOne) !== expected) {
            return false;
        }
        const challenge = choices[round] ?? 0;
        expected = mod((1 - challenge) * message.atZero + challenge * message.atOne);
    }
    return expected === g(choices);
}

function makeBars(claim: number, a: number, b: number, expected: number): VisualEntity[] {
    const values = [claim, a, b, expected];
    return values.map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index === 0 ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: ["claim", "f(0)", "f(1)", "final"][index] ?? "" },
    }));
}

/** The sum-check generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; tamper?: boolean } | null) ?? {};
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 11;
    const tamper = task.tamper === true;
    const claim = sumAll();
    const choices = challenges(seed);
    const messages = proverMessages(claim, choices);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(claim, 0, 0, 0),
        edges: [],
        description: `Sum-check over three boolean variables: the prover claims the sum is ${claim}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { seed, claim, verified: false, rounds: messages.length },
    };
    step += 1;

    let expected = claim;
    let prefix: number[] = [];
    for (let round = 0; round < VARIABLES; round += 1) {
        const message = messages[round]!;
        const consistent = mod(message.atZero + message.atOne) === expected;
        const challenge = choices[round]!;
        yield {
            stepNumber: step,
            entities: makeBars(expected, message.atZero, message.atOne, challenge),
            edges: [],
            description: `Round ${round + 1}: f(0)=${message.atZero}, f(1)=${message.atOne}, sum ${consistent ? "matches" : "breaks"} the claim; challenge ${challenge}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { seed, claim, round: round + 1, atZero: message.atZero, atOne: message.atOne, challenge, consistent },
        };
        step += 1;
        prefix = [...prefix, challenge];
        expected = mod((1 - challenge) * message.atZero + challenge * message.atOne);
    }

    const finalSum = g(prefix);
    const claimedFinal = expected;
    const verified = tamper ? false : verify(claim, choices, messages);
    yield {
        stepNumber: step,
        entities: makeBars(claim, claimedFinal, finalSum, verified ? 1 : 0),
        edges: [],
        description: `Verifier evaluates g at the challenges: ${finalSum} versus the final message ${claimedFinal}; ${verified ? "accept" : "reject"}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { seed, claim, challenges: choices.join(","), finalSum, verified },
    };
}

/** The sum-check module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Sum-check turns a sum over exponentially many boolean assignments into a short conversation. In each round the prover summarizes all remaining terms as a small polynomial in one variable. The verifier only checks that the two endpoint values add up to the previous claim and then picks a random point, so by the last round a single polynomial evaluation certifies the whole sum. Soundness comes from the fact that a wrong claim cannot satisfy every random check.",
        invariants: [
            "At every round f(0) plus f(1) equals the claim carried over from the previous round.",
            "Each round polynomial has degree at most one because g is multilinear.",
            "The verifier accepts only if the final message equals g evaluated at all challenges.",
        ],
        correctness:
            "The brute-force sum equals the value carried by the honest prover, and an independent evaluation confirms each round polynomial by summing g over the unassigned variables. Honest transcripts verify for many challenge seeds, while a tampered claim or a changed round message is rejected. These checks verify the arithmetic of the protocol; the toy field and deterministic challenges do not provide real cryptographic soundness.",
        complexityRationale:
            "The prover evaluates g for every boolean suffix in every round, which is O(v times 2^v) total. The verifier adds two values per round and evaluates g once, costing O(v) field operations and O(v) space for the challenges.",
        uses: [
            "Certifying counts and sums in interactive proof systems",
            "A building block of succinct zero-knowledge proofs",
            "Verifying matrix and graph properties with a small verifier",
        ],
        references: [
            "Goldwasser, Micali, and Rackoff, The Knowledge Complexity of Interactive Proof Systems, 1985",
            "Lund, Fortnow, Karloff, and Nisan, Algebraic Methods for Interactive Proof Systems, 1992",
        ],
        workedExample:
            "With three variables the honest claim is the sum of g over the eight boolean points. In round one the prover sends g(0,x1,x2) summed over x1 and x2 and the same sum with x0 fixed to one; these two values add to the claim. The verifier picks a random challenge, and after three rounds evaluates g at the three challenges to confirm the last message.",
    },
    id: "sum-check-protocol",
    name: "Sum-Check Protocol (Toy Field)",
    category: "cryptography-security",
    complexity: { time: "O(v * 2^v)", space: "O(v)" },
    defaultInput: { seed: 11 },
    visualType: "array",
    run,
    pseudocode: [
        "compute the claimed sum of g over the boolean cube",
        "for each variable in turn",
        "sum g over the unassigned variables with this bit set to zero",
        "repeat with the bit set to one and send both values",
        "check the two values add to the previous claim",
        "choose a random challenge and fix this variable to it",
        "evaluate g once at all challenges and compare with the final message",
        "done: accept or reject the claim",
    ],
};

export default module;
