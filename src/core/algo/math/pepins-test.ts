/**
 * pepins-test.ts - Pepin's Primality Test for Fermat Numbers
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Fermat numbers are F_m = 2^(2^m) + 1. Pepin's test states that for m at
 * least one, F_m is prime if and only if 3 raised to (F_m - 1)/2 is congruent
 * to -1 modulo F_m. This is a deterministic primality test: one modular
 * exponentiation decides the question, with no probabilistic error. The module
 * works with BigInts so it can reach the first few composite Fermat numbers.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(log F_m) modular multiplications on O(log F_m)-bit integers
 *   Space: O(log F_m) bits
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Array bars show the exponent's bit length, the residue, and the verdict.
 *   - meta carries the Fermat number, the residue, and the primality decision.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Exact modular exponentiation with BigInt. */
export function powMod(base: bigint, exponent: bigint, modulus: bigint): bigint {
    let result = 1n;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0n) {
        if (e % 2n === 1n) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e /= 2n;
    }
    return result;
}

/** The m-th Fermat number as a BigInt. */
export function fermatNumber(m: number): bigint {
    return (1n << (1n << BigInt(m))) + 1n;
}

export interface PepinResult {
    index: number;
    fermat: bigint;
    exponent: bigint;
    residue: bigint;
    prime: boolean;
    applicable: boolean;
}

/** Run Pepin's test on the m-th Fermat number. */
export function pepinTest(m: number): PepinResult {
    const F = fermatNumber(m);
    if (m < 1) {
        return { index: m, fermat: F, exponent: 0n, residue: 0n, prime: m === 0 ? F === 3n : false, applicable: false };
    }
    const exponent = (F - 1n) / 2n;
    const residue = powMod(3n, exponent, F);
    return { index: m, fermat: F, exponent, residue, prime: residue === F - 1n, applicable: true };
}

function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: (index === active ? "active" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { m?: number } | null) ?? {};
    const m = Math.max(1, Math.min(8, Math.floor(task.m ?? 5)));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([m, 2], -1),
        edges: [],
        description: `Pepin's test on Fermat number F_${m} using base three.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { m },
    };
    step += 1;

    const result = pepinTest(m);
    const exponentBits = result.exponent.toString(2).length;
    yield {
        stepNumber: step,
        entities: makeBars([m, exponentBits], 1),
        edges: [],
        description: `F_${m} has exponent (F-1)/2 with ${exponentBits} binary digits.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { m, fermat: result.fermat.toString(), exponent: result.exponent.toString() },
    };
    step += 1;

    const residueSample = Number(result.residue % 1000000n);
    yield {
        stepNumber: step,
        entities: makeBars([residueSample, m], 0),
        edges: [],
        description: `3 to the (F-1)/2 leaves residue ${result.residue.toString()} modulo F_${m}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { m, residue: result.residue.toString(), target: result.fermat.toString() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([result.prime ? 1 : 0, m], 0),
        edges: [],
        description: `Done: F_${m} is ${result.prime ? "prime" : "composite"} by Pepin's criterion.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { m, prime: result.prime, residue: result.residue.toString() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Fermat numbers grow fast, but primality can still be decided with a single exponentiation. Pepin observed that for a Fermat number F, the number 3 has a special order property: if the multiplicative order of 3 modulo F is exactly the full group size then F must be prime. Raising 3 to half of F minus one tests exactly that, because the result is minus one only when the order is maximal.",
        invariants: [
            "Every Fermat number is odd, so the exponent (F-1)/2 is an integer.",
            "The residue of a correct prime case is F-1, the representative of minus one.",
            "The exponent has one fewer binary digit than the Fermat number itself.",
        ],
        correctness:
            "If F is prime, Euler's criterion gives 3^((F-1)/2) congruent to the Legendre symbol of 3, which is minus one for Fermat numbers because they are congruent to one modulo twelve for m at least two. Conversely, if the residue is minus one, the order of 3 modulo F is 2^m+1 times a power of two and equals F-1; the multiplicative group modulo F then has at least F-1 elements, which forces every factor to be F itself, so F is prime. Thus the test is both necessary and sufficient.",
        complexityRationale:
            "The exponent has about 2^m bits, so repeated squaring needs O(2^m) modular multiplications on numbers of O(2^m) bits. Only a handful of BigInts are stored, so space is proportional to the number size.",
        uses: [
            "Deciding primality of Fermat numbers",
            "Searching for Fermat and generalized Fermat primes",
            "A deterministic primality test with a single exponentiation",
        ],
        references: [
            "Pepin, Formules relatives aux nombres de Fermat, 1877",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Section 4.5",
        ],
        workedExample:
            "For m equal to 5, F_5 is 2^32 + 1, which equals 4294967297. Raising 3 to (F_5 - 1)/2 modulo F_5 does not give minus one, so Pepin's test declares F_5 composite; indeed it factors as 641 times 6700417. For m equal to 4 the residue is minus one and F_4 is prime.",
    },
    id: "pepins-test",
    name: "Pepin's Test",
    category: "math",
    complexity: { time: "O(log F * M(log F))", space: "O(log F)" },
    defaultInput: { m: 5 },
    visualType: "array",
    run,
    pseudocode: [
        "build the Fermat number F as 2 to the 2^m plus one",
        "set the exponent to (F-1) divided by two",
        "raise three to the exponent modulo F",
        "compare the residue with F minus one",
        "declare prime when the residue equals minus one",
        "otherwise declare composite",
        "done: report the residue and the verdict",
    ],
};

export default module;
