/**
 * jordan-totient.ts - Jordan's Totient Function J_k(n).
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Jordan's totient J_k(n) counts the k-tuples of integers between 1 and n
 * whose greatest common divisor with n is one. It generalizes Euler's
 * totient, which is the case k = 1, and is given by the product over the
 * distinct primes dividing n of (p^(e*k) - p^((e-1)*k)).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sqrt(n)) for factoring
 *   Space: O(number of distinct prime factors)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid row shows a prime-power factor and its multiplicative term.
 *   - The active row is highlighted while the product is updated.
 *   - The final frame reports J_k(n) and the k = 1 comparison with phi(n).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface JordanInput {
    n?: number;
    k?: number;
}

function factor(n: number): Array<[number, number]> {
    const factors: Array<[number, number]> = [];
    let remaining = n;
    for (let p = 2; p * p <= remaining; p += 1) {
        if (remaining % p === 0) {
            let exponent = 0;
            while (remaining % p === 0) {
                remaining /= p;
                exponent += 1;
            }
            factors.push([p, exponent]);
        }
    }
    if (remaining > 1) {
        factors.push([remaining, 1]);
    }
    return factors;
}

function primeTerm(p: number, exponent: number, k: number): number {
    return p ** (exponent * k) - p ** ((exponent - 1) * k);
}

function table(
    n: number,
    k: number,
    factors: Array<[number, number]>,
    upto: number,
    product: number,
    active: boolean,
    done: boolean,
): VisualEntity[] {
    const rows: Array<{ field: string; value: number | string }> = [
        { field: "n", value: n },
        { field: "k", value: k },
        { field: "product so far", value: product },
    ];
    factors.forEach(([p, exponent], index) => {
        rows.push({
            field: `prime ${index + 1}`,
            value: `${p}^${exponent} -> ${primeTerm(p, exponent, k)}`,
        });
    });
    return rows.map((row, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: `${row.field}: ${row.value}`,
        value: row.value,
        state: (done ? "sorted" : active && i === 2 ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: i, col: 0, field: row.field },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as JordanInput | null) ?? {};
    const n = typeof task.n === "number" && task.n >= 1 ? Math.trunc(task.n) : 12;
    const k = typeof task.k === "number" && task.k >= 1 ? Math.trunc(task.k) : 2;
    const factors = factor(n);
    let step = 0;

    yield {
        stepNumber: step,
        entities: table(n, k, factors, 0, 1, false, false),
        edges: [],
        description: `Compute J_${k}(${n}), the number of ${k}-tuples coprime with ${n}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3 + factors.length, cols: 1, n, k, factorCount: factors.length },
    };
    step += 1;

    let product = 1;
    for (let index = 0; index < factors.length; index += 1) {
        const [p, exponent] = factors[index] ?? [2, 1];
        const term = primeTerm(p, exponent, k);
        product *= term;
        yield {
            stepNumber: step,
            entities: table(n, k, factors, index + 1, product, true, false),
            edges: [],
            description: `Prime ${p}^${exponent} contributes ${p}^(${exponent}*${k}) - ${p}^(${exponent - 1}*${k}) = ${term}; product ${product}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 3 + factors.length, cols: 1, n, k, prime: p, exponent, term, product },
        };
        step += 1;
    }

    let phi = n;
    for (const [p] of factors) {
        phi = (phi / p) * (p - 1);
    }
    phi = Math.trunc(phi);
    yield {
        stepNumber: step,
        entities: table(n, k, factors, factors.length, product, false, true),
        edges: [],
        description: `Done: J_${k}(${n}) = ${product}; for comparison Euler phi(${n}) = ${phi}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: 3 + factors.length, cols: 1, n, k, result: product, phi },
    };
}

const module: AlgorithmModule = {
    id: "jordan-totient",
    name: "Jordan Totient Function",
    category: "math",
    complexity: { time: "O(sqrt(n))", space: "O(k)" },
    defaultInput: { n: 12, k: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "factor n into distinct prime powers p^e",
        "set the product to one",
        "for each prime p multiply by p^(e*k) - p^((e-1)*k)",
        "the product is J_k(n), counted as coprime k-tuples",
        "the case k = 1 equals Euler's totient phi(n)",
        "return the product",
    ],
    education: {
        intuition:
            "Euler's totient counts single numbers coprime to n. Jordan's function asks the same question for a whole tuple: how many k-tuples have no prime factor in common with n? Because conditions factor across primes, the answer is a product of simple local terms, one for each prime dividing n.",
        invariants: [
            "J_1(n) always equals Euler's totient phi(n).",
            "Each prime factor contributes a term independent of the other primes.",
            "J_k(n) is divisible by phi(n) for every k at least one.",
        ],
        correctness:
            "A k-tuple is coprime to n exactly when none of its entries is divisible by any prime p dividing n. For a fixed p^e in n, the number of k-tuples modulo p^e not all divisible by p is p^(e k) minus p^((e-1) k). The Chinese remainder theorem makes these local conditions independent across distinct primes, so multiplying them counts exactly the tuples coprime to n.",
        complexityRationale:
            "Trial division examines divisors up to the square root of n, so factoring costs O(sqrt(n)). The product runs over the few distinct prime factors, requiring O(k) space for the factor list.",
        uses: [
            "Counting invertible matrices and tuples in modular arithmetic",
            "Generalizing Euler's theorem in number theory",
            "Enumerating group elements in cryptographic constructions",
        ],
        references: [
            "Jordan, On certain arithmetical functions, 1865",
            "Apostol, Introduction to Analytic Number Theory, multiplicative functions",
        ],
        workedExample:
            "For n = 12 = 2^2 x 3 and k = 2, the prime 2 contributes 2^4 - 2^2 = 12 and the prime 3 contributes 3^2 - 3^0 = 8, so J_2(12) = 96. This is the number of ordered pairs between 1 and 12 whose gcd with 12 is one.",
    },
};

export default module;
