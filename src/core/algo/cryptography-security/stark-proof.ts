/**
 * stark-proof.ts - FRI Folding Step (STARK Polynomial Commitment Core)
 *
 * TOY/SMALL MODEL - NOT A PRODUCTION PROOF SYSTEM. A full STARK needs an
 * algebraic intermediate representation, Merkle-tree commitments, a random
 * oracle, and a soundness analysis. This implements one exact FRI fold over a
 * small finite field: it commits to a low-degree polynomial's evaluations and
 * folds them with a random challenge into a codeword of half the degree. All
 * arithmetic is exact modular integer math with no security claim.
 *
 * Time:  O(N log N) field operations for a domain of size N
 * Space: O(N)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface StarkInput {
    coefficients?: number[];
    domainSize?: number;
    challenge?: number;
}

const PRIME = 65537;

/** Modular exponentiation by repeated squaring. */
function powMod(base: number, exponent: number, mod: number): number {
    let result = 1;
    let b = ((base % mod) + mod) % mod;
    let e = exponent;
    while (e > 0) {
        if (e & 1) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Smallest primitive root of the prime field. */
function primitiveRoot(): number {
    for (let g = 2; g < 100; g += 1) {
        if (powMod(g, (PRIME - 1) / 2, PRIME) !== 1) {
            return g;
        }
    }
    return 3;
}

/** Evaluate a polynomial with coefficients in ascending order at x. */
function evalPoly(coeffs: number[], x: number, mod: number): number {
    let result = 0;
    for (let i = coeffs.length - 1; i >= 0; i -= 1) {
        result = ((result * x) + ((coeffs[i] ?? 0) % mod) + mod) % mod;
    }
    return result;
}

/** Bar chart of field elements (reduced for display). */
function makeBars(values: number[], revealed: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: value.toString(),
        value: value % 997,
        state: (index < revealed ? "sorted" : "idle") as "sorted" | "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as StarkInput | null) ?? {};
    const N = Math.max(4, Math.min(16, 2 ** Math.round(Math.log2(task.domainSize ?? 8))));
    const degree = N / 2;
    const coefficients = Array.isArray(task.coefficients) && task.coefficients.length === degree
        ? task.coefficients.map((value) => ((Math.trunc(value) % PRIME) + PRIME) % PRIME)
        : [3, 5, 7, 11];
    const challenge = typeof task.challenge === "number"
        ? ((Math.trunc(task.challenge) % PRIME) + PRIME) % PRIME
        : 12345;

    const generator = primitiveRoot();
    const rootOfUnity = powMod(generator, (PRIME - 1) / N, PRIME);
    const inv2 = (PRIME + 1) / 2;
    const evaluations = Array.from({ length: N }, (_v, k) => evalPoly(coefficients, powMod(rootOfUnity, k, PRIME), PRIME));

    // Independently form the folded polynomial from even/odd coefficient halves.
    const even = coefficients.filter((_v, i) => i % 2 === 0);
    const odd = coefficients.filter((_v, i) => i % 2 === 1);
    const gCoeffs = even.map((value, i) => (value + challenge * (odd[i] ?? 0)) % PRIME);

    const folded: number[] = [];
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(evaluations, 0),
        edges: [],
        description: `Committed to evaluations of a degree-${degree - 1} polynomial over a size-${N} domain in F_${PRIME}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            prime: PRIME,
            N,
            degree,
            generator,
            rootOfUnity,
            challenge,
            coefficients,
            evaluations,
            folded: [],
            gCoeffs,
            verified: false,
        },
    };
    step += 1;

    for (let k = 0; k < N / 2; k += 1) {
        const x = powMod(rootOfUnity, k, PRIME);
        const fx = evaluations[k] ?? 0;
        const fmx = evaluations[k + N / 2] ?? 0;
        const evenPart = (((fx + fmx) % PRIME) * inv2) % PRIME;
        const diff = ((fx - fmx) % PRIME + PRIME) % PRIME;
        const oddPart = ((((diff * inv2) % PRIME) * powMod(x, PRIME - 2, PRIME)) % PRIME);
        folded.push((evenPart + challenge * oddPart) % PRIME);

        yield {
            stepNumber: step,
            entities: makeBars(evaluations, k + 1),
            edges: [],
            description: `Fold pair (${k}, ${k + N / 2}): g(w^${2 * k}) = ${folded[folded.length - 1]}, a codeword of the half-degree polynomial.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                prime: PRIME,
                N,
                degree,
                generator,
                rootOfUnity,
                challenge,
                coefficients,
                evaluations,
                folded: [...folded],
                gCoeffs,
                verified: false,
            },
        };
        step += 1;
    }

    const verified = folded.every((value, k) => value === evalPoly(gCoeffs, powMod(rootOfUnity, 2 * k, PRIME), PRIME));
    yield {
        stepNumber: step,
        entities: makeBars(folded, folded.length),
        edges: [],
        description: verified
            ? `Done: folded values match the degree-${gCoeffs.length - 1} polynomial g; FRI fold verified.`
            : "Done: folded values failed the low-degree check.",
        codeLineNumber: 5,
        layout: "array",
        meta: {
            prime: PRIME,
            N,
            degree,
            generator,
            rootOfUnity,
            challenge,
            coefficients,
            evaluations,
            folded,
            gCoeffs,
            verified,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "FRI is the polynomial commitment at the heart of STARK proofs. To prove a function is a low-degree polynomial, the prover supplies its evaluations and then repeatedly folds them: each fold combines pairs of points using a random challenge and produces evaluations of a polynomial with half the degree. If the original function was not low-degree, the folded values stop agreeing with any low-degree polynomial.",
        invariants: [
            "Evaluation points are powers of a root of unity, so x and minus x both lie in the domain.",
            "A fold combines f(x) and f(-x) into one value of g(x squared).",
            "The folded polynomial has degree strictly less than half the original degree bound.",
        ],
        correctness:
            "Writing f(x) = f_even(x^2) + x f_odd(x^2) splits any polynomial into even and odd coefficient parts. The fold computes g(y) = f_even(y) + r f_odd(y), which has degree below half of deg(f). Evaluating g directly from its coefficients reproduces every folded value, which is the brute-force check used in the tests.",
        complexityRationale:
            "One FRI fold processes N/2 pairs, each with a constant number of field multiplications and one modular inverse, so the work is O(N). Storing the evaluation vectors uses O(N) space; a full FRI protocol repeats the fold logarithmically many times for O(N log N) total.",
        uses: [
            "Teaching the FRI low-degree test behind STARKs",
            "Understanding polynomial commitments in transparent zero-knowledge proofs",
            "Demonstrating finite-field fold arithmetic",
        ],
        references: [
            "Ben-Sasson et al., Fast Reed-Solomon Interactive Oracle Proofs of Proximity, 2018",
            "Ben-Sasson et al., Scalable, Transparent, and Post-Quantum Secure Computational Integrity, 2018",
        ],
        workedExample:
            "For f(x) = 3 + 5x + 7x^2 + 11x^3 over a size-8 domain, the even part is 3 + 7y and the odd part is 5 + 11y. With challenge r, the folded polynomial is g(y) = (3 + 5r) + (7 + 11r)y, a degree-one polynomial whose evaluations at x squared equal the computed fold values.",
    },
    id: "stark-proof",
    name: "STARK Proof (FRI Folding Step)",
    category: "cryptography-security",
    complexity: { time: "O(N log N)", space: "O(N)" },
    defaultInput: { coefficients: [3, 5, 7, 11], domainSize: 8, challenge: 12345 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a prime field and a root-of-unity evaluation domain",
        "evaluate the low-degree message polynomial on the domain",
        "draw a random folding challenge",
        "for each pair of opposite domain points",
        "combine evaluations into a value of the folded polynomial",
        "form the folded polynomial from even and odd coefficients",
        "verify folded values against the folded polynomial",
        "done: report the verified fold",
    ],
};

export default module;
