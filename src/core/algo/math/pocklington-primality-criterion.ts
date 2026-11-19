/**
 * pocklington-primality-criterion.ts - Pocklington Primality Criterion
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Pocklington's criterion certifies primality when a large part F of n-1 can
 * be factored, with F larger than the square root of n. For every prime q
 * dividing F one finds a witness a with a^(n-1) equal to 1 modulo n and with
 * gcd(a^((n-1)/q) - 1, n) equal to 1. If such witnesses exist, n must be
 * prime; if a candidate fails for some q, n is composite. This module factors
 * only small prime powers, so it proves primality for smooth n-1.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(factorLimit + witnesses * log^3 n) modular operations
 *   Space: O(number of small prime factors)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Array bars compare the factored part F with the square root of n.
 *   - meta carries the witness verdicts and the final primality decision.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Exact modular exponentiation with BigInt. */
export function powModBig(base: bigint, exponent: bigint, modulus: bigint): bigint {
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

/** Greatest common divisor with BigInt. */
export function gcdBig(a: bigint, b: bigint): bigint {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

/** Factor a number using only trial primes up to a limit. */
export function smallFactorization(value: bigint, limit: number): Array<[bigint, number]> {
    const factors: Array<[bigint, number]> = [];
    let remaining = value;
    for (let candidate = 2; candidate <= limit; candidate += 1) {
        const p = BigInt(candidate);
        if (remaining % p !== 0n) continue;
        let exponent = 0;
        while (remaining % p === 0n) {
            remaining /= p;
            exponent += 1;
        }
        factors.push([p, exponent]);
    }
    return factors;
}

export interface PocklingtonResult {
    proved: boolean;
    prime: boolean;
    factoredPart: bigint;
    primes: bigint[];
    witnesses: Array<{ q: bigint; a: bigint; ok: boolean }>;
}

/** Apply Pocklington's criterion using only prime factors up to a limit. */
export function pocklington(n: number, limit = 200): PocklingtonResult {
    const N = BigInt(n);
    const empty: PocklingtonResult = { proved: false, prime: false, factoredPart: 1n, primes: [], witnesses: [] };
    if (n < 2) return empty;
    if (n === 2 || n === 3) {
        return { proved: true, prime: true, factoredPart: BigInt(n - 1), primes: [], witnesses: [] };
    }
    if (N % 2n === 0n) return { proved: true, prime: false, factoredPart: N - 1n, primes: [], witnesses: [] };

    const factors = smallFactorization(N - 1n, limit);
    let F = 1n;
    for (const [prime, exponent] of factors) {
        for (let i = 0; i < exponent; i += 1) F *= prime;
    }
    if (F * F <= N) return { proved: false, prime: false, factoredPart: F, primes: [], witnesses: [] };

    const witnesses: PocklingtonResult["witnesses"] = [];
    for (const [q] of factors) {
        let found = false;
        for (let a = 2; a <= n - 2 && !found; a += 1) {
            const A = BigInt(a);
            if (powModBig(A, N - 1n, N) !== 1n) continue;
            const power = powModBig(A, (N - 1n) / q, N);
            if (gcdBig(power - 1n, N) === 1n) {
                witnesses.push({ q, a: A, ok: true });
                found = true;
            }
        }
        if (!found) {
            witnesses.push({ q, a: 0n, ok: false });
            return { proved: true, prime: false, factoredPart: F, primes: factors.map(([p]) => p), witnesses };
        }
    }
    return { proved: true, prime: true, factoredPart: F, primes: factors.map(([p]) => p), witnesses };
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
    const task = (input as { n?: number; limit?: number } | null) ?? {};
    const n = Math.max(2, Math.floor(task.n ?? 101));
    const limit = Math.max(2, Math.floor(task.limit ?? 200));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([n, n - 1], -1),
        edges: [],
        description: `Pocklington's criterion for n = ${n} with small-prime bound ${limit}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, limit },
    };
    step += 1;

    const result = pocklington(n, limit);
    const factored = Number(result.factoredPart > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : result.factoredPart);
    yield {
        stepNumber: step,
        entities: makeBars([n, factored], 1),
        edges: [],
        description: `Factored part F = ${result.factoredPart.toString()} of n-1; it must exceed the square root of n.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { n, factoredPart: result.factoredPart.toString() },
    };
    step += 1;

    for (const witness of result.witnesses) {
        yield {
            stepNumber: step,
            entities: makeBars([Number(witness.q), Number(witness.a % 1000000n)], 1),
            edges: [],
            description: `Prime q = ${witness.q}: witness a = ${witness.a.toString()} ${witness.ok ? "passes" : "fails"}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, q: witness.q.toString(), a: witness.a.toString(), ok: witness.ok },
        };
        step += 1;
    }

    const decision = !result.proved ? "inconclusive" : result.prime ? "prime" : "composite";
    yield {
        stepNumber: step,
        entities: makeBars([n, result.proved ? 1 : 0], -1),
        edges: [],
        description: `Done: the criterion reports ${decision} for ${n}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { n, proved: result.proved, prime: result.prime, decision },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A primality certificate is easier to check than a factorization. Pocklington uses the fact that any prime divisor of n has a multiplicative group of order n-1 when n itself is prime. If you already know a large factored chunk of n-1, one exponentiation per known prime factor either produces a witness proving n prime or proves n composite. Knowing more than the square root of n of the factorization is enough.",
        invariants: [
            "Every factored prime divides n-1, so F always divides n-1.",
            "A valid witness has order divisible by q in the group modulo n.",
            "Finding all required witnesses proves n prime; one failure proves n composite.",
        ],
        correctness:
            "If a is a witness for q, then a^(n-1) is 1 modulo n while a^((n-1)/q) is not 1 modulo any prime divisor of n. Hence every prime divisor r of n satisfies q dividing r-1. Performing this for every q in F forces each prime divisor r of n to satisfy F dividing r-1, so r exceeds F. Since F exceeds the square root of n and F divides n-1, n has only one prime factor and is prime. A failing witness contradicts primality, proving compositeness.",
        complexityRationale:
            "Factoring n-1 by trial division costs O(factorLimit) and each witness search uses modular exponentiations costing O(log n) multiplications on O(log n)-bit integers. The stored data is the list of small prime factors, which is small.",
        uses: [
            "Generating short primality certificates",
            "Verifying primes in cryptographic key generation",
            "Proving primality of numbers with smooth n-1",
        ],
        references: [
            "Pocklington, The determination of the prime or composite nature of large numbers by Fermat's theorem, 1914",
            "Brillhart, Lehmer, and Selfridge, New Primality Criteria and Factorizations, 1975",
        ],
        workedExample:
            "For n equal to 101, n-1 is 100, which factors completely as 2 squared times 5 squared, so F is 100 and exceeds the square root of 101. For q equal to 2, the witness a equal to 2 has 2^100 congruent to 1 modulo 101 and gcd(2^50 - 1, 101) equal to 1; the same check for q equal to 5 succeeds, certifying that 101 is prime.",
    },
    id: "pocklington-primality-criterion",
    name: "Pocklington Primality Criterion",
    category: "math",
    complexity: { time: "O(factorLimit + log^3 n)", space: "O(number of small factors)" },
    defaultInput: { n: 101, limit: 200 },
    visualType: "array",
    run,
    pseudocode: [
        "factor a part F of n minus one using small primes",
        "stop the proof if F does not exceed the square root of n",
        "for each prime q in the factorization of F",
        "find a with a to the n minus one congruent to one modulo n",
        "require gcd of a to the (n-1)/q minus one and n to be one",
        "declare composite if any prime q has no such witness",
        "done: declare prime when every witness is found",
    ],
};

export default module;
