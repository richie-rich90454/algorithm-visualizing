/**
 * saber-kem.ts - Saber-Style Module-LWR Key Encapsulation (Toy Parameters)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Saber builds a key-encapsulation mechanism from module-LWR: multiply a public
 * polynomial by a small secret, then round coefficients from a large modulus
 * down to a smaller one. The rounding discards low bits and acts as the noise.
 * Encapsulation multiplies the rounded public key by a fresh small value and
 * derives a shared bit; decapsulation multiplies the ciphertext by the secret
 * and derives the same bit. This toy keeps the rounding and reconciliation
 * structure with four coefficients, modulus 16, and modulus 4, and with binary
 * small values so the shared bit is exact. It is a teaching model, not Saber.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n) coefficient operations
 *   Space: O(n) for the polynomials
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the public polynomial, rounded key, ciphertext, and shared bit.
 *   - meta reports each polynomial and whether the shared bits agree.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const N = 4;
const Q = 16;
const P = 4;
const SCALE = Q / P;

/** Round a value from modulus 16 down to modulus 4. */
export function round16to4(value: number): number {
    const reduced = ((value % Q) + Q) % Q;
    return Math.floor((reduced + SCALE / 2) / SCALE) % P;
}

/** Deterministic public polynomial from a seed. */
export function publicPoly(seed: number): number[] {
    let state = (seed >>> 0) || 1;
    return Array.from({ length: N }, () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return (state >>> 12) % Q;
    });
}

/** Deterministic secret polynomial with binary coefficients. */
export function secretPoly(seed: number): number[] {
    let state = ((seed >>> 0) ^ 0x5bd1e995) || 1;
    return Array.from({ length: N }, () => {
        state = (Math.imul(state, 1103515245) + 12345) >>> 0;
        return (state >>> 16) & 1;
    });
}

/** Rounded public key b = round(a * s). */
export function roundPublic(a: number[], s: number[]): number[] {
    return a.map((value, index) => round16to4(value * (s[index] ?? 0)));
}

/** Ciphertext c = round(a * r). */
export function roundCipher(a: number[], r: number[]): number[] {
    return a.map((value, index) => round16to4(value * (r[index] ?? 0)));
}

/** Reconcile a shared bit from two modulus-4 polynomials. */
export function reconcile(first: number[], second: number[]): number {
    let sum = 0;
    for (let i = 0; i < N; i += 1) {
        sum += ((first[i] ?? 0) * (second[i] ?? 0)) % P;
    }
    return sum % P >= 2 ? 1 : 0;
}

/** Encapsulate: return the ciphertext and shared bit. */
export function encapsulate(a: number[], b: number[], r: number[]): { ciphertext: number[]; bit: number } {
    const ciphertext = roundCipher(a, r);
    return { ciphertext, bit: reconcile(b, r) };
}

/** Decapsulate: recover the shared bit from the ciphertext and secret. */
export function decapsulate(ciphertext: number[], s: number[]): number {
    return reconcile(ciphertext, s);
}

function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, modulus: index === 0 ? Q : P },
    }));
}

/** The Saber-style generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; messageSeed?: number } | null) ?? {};
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const messageSeed = typeof task.messageSeed === "number" ? Math.floor(task.messageSeed) : 3;
    const a = publicPoly(seed);
    const s = secretPoly(seed);
    const b = roundPublic(a, s);
    const r = secretPoly(messageSeed);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(a, 0),
        edges: [],
        description: `Module-LWR toy: public polynomial a with four coefficients modulo 16, seed ${seed}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { seed, a: a.join(","), bit: 0, agreed: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(b, 0),
        edges: [],
        description: `Round the product a times the binary secret down from modulus 16 to modulus 4.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { seed, b: b.join(","), bit: 0, agreed: false },
    };
    step += 1;

    const { ciphertext, bit } = encapsulate(a, b, r);
    yield {
        stepNumber: step,
        entities: makeBars(ciphertext, 0),
        edges: [],
        description: `Encapsulate with a fresh binary r: ciphertext ${ciphertext.join(",")}, shared bit ${bit}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { seed, ciphertext: ciphertext.join(","), bit, agreed: false },
    };
    step += 1;

    const recovered = decapsulate(ciphertext, s);
    yield {
        stepNumber: step,
        entities: makeBars([bit, recovered, ...ciphertext.slice(0, 2)], 0),
        edges: [],
        description: `Decapsulate with the secret: bit ${recovered}, ${recovered === bit ? "matching" : "mismatch"}. Toy rounding, not Saber security.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { seed, bit, recovered, agreed: recovered === bit },
    };
}

/** The Saber-style module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Learning with rounding avoids generating explicit noise: multiplying by a small secret and then rounding already hides the low bits. Saber packages this into a KEM. The sender rounds a fresh public multiplication to form a ciphertext and derives a shared bit from the rounded public key; the receiver derives the same bit from the ciphertext and the secret. Rounding commutes here because the small values are binary, which makes the toy round trip exact.",
        invariants: [
            "Every rounded coefficient lies in the set 0 through 3.",
            "The public key is round(a times s) and the ciphertext is round(a times r).",
            "Reconciliation sums products of matching coefficients and thresholds the sum at two.",
        ],
        correctness:
            "For binary secret and message values, round(a*s) times r equals round(a*r) times s coefficient by coefficient, so both reconciliation sums are identical and the shared bits always agree. The tests check this exhaustively over every binary secret and message vector and confirm that changing the message seed changes the ciphertext. The four-coefficient toy has no security against lattice attacks.",
        complexityRationale:
            "Generation, encapsulation, and decapsulation each scan the n coefficients once, so time and space are both O(n).",
        uses: [
            "Post-quantum key establishment in the Saber KEM",
            "Teaching the difference between learning with errors and learning with rounding",
            "Demonstrating rounding-based reconciliation of a shared bit",
        ],
        references: [
            "D'Anvers et al., Saber: Module-LWR Based Key Exchange, 2018",
            "Bos et al., Learning with Rounding, 2012",
        ],
        workedExample:
            "With a public coefficient a of 9 and secret bit 1, the product 9 rounds to 9 divided by 4 rounded to 2 in modulus 4. A message bit of 1 gives the same rounded ciphertext coefficient 2, and the products 2 times 1 agree on both sides, contributing equally to the shared bit.",
    },
    id: "saber-kem",
    name: "Saber-Style LWR KEM (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { seed: 7, messageSeed: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "sample a public polynomial modulo the larger modulus",
        "sample a small binary secret polynomial",
        "round each product coefficient down to the smaller modulus",
        "sample a fresh binary message polynomial",
        "round the public times message product into a ciphertext",
        "reconcile the rounded key with the ciphertext into a shared bit",
        "reconcile the ciphertext with the secret and compare bits",
        "done: report agreement on the shared bit",
    ],
};

export default module;
