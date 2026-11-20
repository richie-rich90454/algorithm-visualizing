/**
 * lucas-primality-test.ts - Lucas Primality Test
 *
 * The Lucas test proves primality by exhibiting a witness a whose order
 * modulo n is exactly n-1. It fully factors n-1, then searches for an a with
 * a^(n-1) congruent to 1 modulo n while a^((n-1)/q) is not congruent to 1 for
 * every prime factor q of n-1. Such a witness can only exist when n is prime,
 * and every prime has one.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function powMod(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    let b = base % mod;
    let e = exp;
    while (e > 0n) {
        if (e % 2n === 1n) result = (result * b) % mod;
        b = (b * b) % mod;
        e /= 2n;
    }
    return result;
}

function distinctPrimeFactors(value: number): number[] {
    const factors: number[] = [];
    let rest = value;
    for (let d = 2; d * d <= rest; d += 1) {
        if (rest % d === 0) {
            factors.push(d);
            while (rest % d === 0) rest /= d;
        }
    }
    if (rest > 1) factors.push(rest);
    return factors;
}

function makeCells(
    n: number,
    factors: number[],
    witness: number,
    verdict: string,
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    const values: Array<[string, string]> = [
        ["n", String(n)],
        ["n-1 factors", factors.join(",") || "none"],
        ["witness", witness > 0 ? String(witness) : "-"],
        ["verdict", verdict],
    ];
    return values.map(([label, value], index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: `${label}: ${value}`,
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(index / 2), col: index % 2, index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const n = typeof input === "number" ? Math.max(0, Math.floor(input)) : 101;
    const frames: VisualFrame[] = [];
    const push = (factors: number[], witness: number, verdict: string, line: number, states?: Map<number, EntityState>, prime = verdict === "prime"): void => {
        frames.push({
            stepNumber: frames.length,
            entities: makeCells(n, factors, witness, verdict, states),
            edges: [],
            description: `n=${n}: ${verdict}`,
            codeLineNumber: line,
            layout: "grid",
            meta: { n, factors, witness, isPrime: prime, rows: 2, cols: 2 },
        });
    };

    if (n < 2) {
        push([], 0, "composite", 0, new Map([[3, "error"]]));
    } else if (n === 2) {
        push([], 0, "prime", 1, new Map([[3, "sorted"]]));
    } else {
        const factors = distinctPrimeFactors(n - 1);
        push(factors, 0, `factored n-1 into ${factors.length} prime factor(s)`, 1, new Map([[1, "active"]]));
        const bigN = BigInt(n);
        const bigNm1 = BigInt(n - 1);
        let witness = 0;
        for (let a = 2; a <= n - 1 && witness === 0; a += 1) {
            const bigA = BigInt(a);
            if (powMod(bigA, bigNm1, bigN) !== 1n) continue;
            let passes = true;
            for (const q of factors) {
                if (powMod(bigA, BigInt((n - 1) / q), bigN) === 1n) {
                    passes = false;
                    break;
                }
            }
            if (passes) {
                witness = a;
                push(factors, a, `prime with witness a=${a}`, 3, new Map([[2, "sorted"], [3, "sorted"]]), true);
            }
        }
        if (witness === 0) {
            push(factors, 0, "composite (no witness)", 4, new Map([[3, "error"]]));
        }
    }

    for (const frame of frames) yield frame;
    const last = frames[frames.length - 1]!;
    const isPrime = last.meta.isPrime === true;
    const witness = last.meta.witness as number;
    const factors = last.meta.factors as number[];
    yield {
        stepNumber: frames.length,
        entities: makeCells(n, factors, witness, isPrime ? "prime" : "composite", new Map([[3, isPrime ? "sorted" : "error"]])),
        edges: [],
        description: `Done: ${n} is ${isPrime ? "prime" : "composite"}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { n, isPrime, witness, factors, rows: 2, cols: 2 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A prime number has a generator whose powers run through every residue from 1 to n-1. If we can find such a generator by checking its powers against the prime factors of n-1, we have a certificate that n is prime. No composite number can produce such a certificate.",
        invariants: [
            "The order of any witness divides n-1 by Fermat's little theorem.",
            "A passing witness has order exactly n-1 because no smaller exponent (n-1)/q yields 1.",
            "If a witness is found, n is guaranteed prime.",
        ],
        correctness:
            "If a passes both checks, its order divides n-1 but none of the maximal proper divisors (n-1)/q, so the order equals n-1. A residue modulo n can only have order n-1 if the multiplicative group has n-1 elements, which happens exactly when n is prime. Conversely every prime admits a primitive root, so the search eventually finds one.",
        complexityRationale:
            "Factoring n-1 by trial division costs O(sqrt(n)); each candidate witness needs one modular exponentiation per prime factor, each O(log n) multiplications, so the test is practical for the small teaching inputs used here.",
        uses: [
            "Producing primality certificates that can be checked quickly",
            "Generating safe primes for cryptographic key exchange",
            "Teaching the connection between primitive roots and primality",
        ],
        references: [
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, section on Lucas tests",
            "Riesel, Prime Numbers and Computer Methods for Factorization, chapter on primality proving",
        ],
        workedExample:
            "For n = 7, n-1 = 6 has prime factors 2 and 3. Taking a = 3, 3^6 = 1 mod 7, while 3^3 = 6 and 3^2 = 2 are both different from 1, so 3 is a witness and 7 is prime.",
    },
    id: "lucas-primality-test",
    name: "Lucas Primality Test",
    category: "math",
    complexity: { time: "O(sqrt n + a log^3 n)", space: "O(log n)" },
    defaultInput: 101,
    visualType: "grid",
    run,
    pseudocode: [
        "read the candidate integer n",
        "if n is less than 2, report composite",
        "factor n-1 into its distinct prime factors",
        "for each a from 2 to n-1 test the two Lucas conditions",
        "if a^(n-1) is 1 and every a^((n-1)/q) is not 1, accept n as prime",
        "if no candidate passes, report composite",
    ],
};

export default module;
