/**
 * ephemeral-diffie-hellman.ts - Ephemeral Diffie-Hellman in a Tiny Prime Field
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Diffie-Hellman lets two parties agree on a shared secret over a public
 * channel. Each picks a private exponent, publishes a generator raised to that
 * exponent modulo a prime, and raises the other party's public value to their
 * own private exponent. Both arrive at the same number because exponentiation
 * commutes in the group. This demo uses a tiny prime for visibility; it is a
 * faithful model of the arithmetic but offers no real security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log exponent) per modular exponentiation with repeated squaring
 *   Space: O(1) beyond the replayed frames
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars reveal Alice's public value, Bob's public value, and the two shared secrets.
 *   - The final frame confirms both shared secrets match.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface DHInput {
    p?: number;
    g?: number;
    a?: number;
    b?: number;
}

/** Modular exponentiation by repeated squaring. */
function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let current = ((base % modulus) + modulus) % modulus;
    let power = exponent;
    while (power > 0) {
        if (power % 2 === 1) {
            result = (result * current) % modulus;
        }
        current = (current * current) % modulus;
        power = Math.floor(power / 2);
    }
    return result;
}

/** A bar per revealed value; unknown values show as zero slivers. */
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

/** Run an ephemeral Diffie-Hellman exchange. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DHInput | null) ?? {};
    const p = typeof task.p === "number" && task.p > 2 ? task.p : 23;
    const g = typeof task.g === "number" ? task.g : 5;
    const a = typeof task.a === "number" ? task.a : 6;
    const b = typeof task.b === "number" ? task.b : 15;

    const A = modPow(g, a, p);
    const B = modPow(g, b, p);
    const secretAlice = modPow(B, a, p);
    const secretBob = modPow(A, b, p);
    const shared = secretAlice === secretBob;

    const all = [
        { label: "A", value: A, revealed: false },
        { label: "B", value: B, revealed: false },
        { label: "sA", value: secretAlice, revealed: false },
        { label: "sB", value: secretBob, revealed: false },
    ];
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(all),
        edges: [],
        description: `Tiny Diffie-Hellman in the field modulo ${p} with generator ${g}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { p, g, A: -1, B: -1, secretAlice: -1, secretBob: -1, shared: false },
    };
    step += 1;

    const revealA = all.map((item, index) => ({ ...item, revealed: index === 0 }));
    yield {
        stepNumber: step,
        entities: bars(revealA),
        edges: [],
        description: `Alice publishes A = ${g}^${a} mod ${p} = ${A}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { p, g, A, B: -1, secretAlice: -1, secretBob: -1, shared: false },
    };
    step += 1;

    const revealAB = all.map((item, index) => ({ ...item, revealed: index <= 1 }));
    yield {
        stepNumber: step,
        entities: bars(revealAB),
        edges: [],
        description: `Bob publishes B = ${g}^${b} mod ${p} = ${B}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { p, g, A, B, secretAlice: -1, secretBob: -1, shared: false },
    };
    step += 1;

    const revealAll = all.map((item) => ({ ...item, revealed: true }));
    yield {
        stepNumber: step,
        entities: bars(revealAll),
        edges: [],
        description:
            `Alice computes B^${a} = ${secretAlice}; Bob computes A^${b} = ${secretBob}. ` +
            (shared ? "The shared secrets match." : "The secrets differ; check the parameters."),
        codeLineNumber: 5,
        layout: "array",
        meta: { p, g, A, B, secretAlice, secretBob, shared },
    };
}

/** The ephemeral Diffie-Hellman module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Two parties can build the same secret from information anyone can see. Each chooses a private exponent and publishes a generator raised to that exponent modulo a prime. Raising the other side's public value to your own exponent gives the same result for both, because powers compose, while recovering the private exponent from the public value is hard for a large prime.",
        invariants: [
            "A public value is generator raised to a private exponent modulo the prime.",
            "Alice's secret is B raised to a modulo p; Bob's secret is A raised to b modulo p.",
            "Both secrets equal generator raised to a times b modulo p.",
        ],
        correctness:
            "Modular exponentiation satisfies (g^b)^a = g^(ab) = (g^a)^b, so Alice and Bob compute the same residue. Repeated squaring computes each power exactly by reducing modulo p after every multiply. With a tiny prime this arithmetic is exact but trivially breakable; real security needs a large group.",
        complexityRationale:
            "Repeated squaring halves the exponent each loop, so each exponentiation takes O(log exponent) modular multiplications. Four exponentiations give the same order in time and only a constant number of integers in space.",
        uses: [
            "Establishing session keys in TLS ephemeral handshakes",
            "Perfect forward secrecy in messaging protocols",
            "A teaching model for public-key agreement",
        ],
        references: [
            "Diffie and Hellman, New Directions in Cryptography, 1976",
            "RFC 8446, The Transport Layer Security Protocol Version 1.3, 2018",
        ],
        workedExample:
            "With p = 23, g = 5, Alice's a = 6 and Bob's b = 15, Alice publishes A = 8 and Bob publishes B = 19. Alice computes 19^6 mod 23 = 2 and Bob computes 8^15 mod 23 = 2, so both hold the shared secret 2.",
    },
    id: "ephemeral-diffie-hellman",
    name: "Ephemeral Diffie-Hellman (Tiny Field)",
    category: "cryptography-security",
    complexity: { time: "O(log exponent)", space: "O(1)" },
    defaultInput: { p: 23, g: 5, a: 6, b: 15 },
    visualType: "array",
    run,
    pseudocode: [
        "agree publicly on prime p and generator g",
        "Alice picks secret a and publishes g to the power a mod p",
        "Bob picks secret b and publishes g to the power b mod p",
        "Alice raises Bob's public value to a modulo p",
        "Bob raises Alice's public value to b modulo p",
        "compare the two shared secrets",
        "done: report the shared secret when they match",
    ],
};

export default module;
