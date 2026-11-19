/**
 * pollard-strassen.ts - Pollard-Strassen Factorization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Pollard-Strassen finds a factor of N by building the polynomial whose roots
 * are the first m integers, then evaluating it at multiples of m. If a prime
 * p divides N, then p lies in one of the blocks scanned by the evaluation
 * points, so the corresponding polynomial value is divisible by p and a gcd
 * with N reveals the factor. Using fast polynomial arithmetic the method runs
 * in subexponential time; this visualization uses direct Horner evaluation,
 * keeping the same mathematical core with simpler code. It is distinct from
 * Pollard rho, Pollard p-minus-one, and the quadratic sieve.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N^(1/2) log N) with direct evaluation (fast variants O(N^(1/4)))
 *   Space: O(N^(1/4)) for the polynomial and evaluation points
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** BigInt modular exponent-free multiplication helper (a*b mod m). */
function mulMod(a: bigint, b: bigint, m: bigint): bigint {
    return (a * b) % m;
}

/** Extended gcd on BigInt, returning the positive gcd. */
function gcdBig(a: bigint, b: bigint): bigint {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

/** Multiply the current polynomial by (x - root) modulo mod. */
function multiplyByRoot(poly: bigint[], root: bigint, mod: bigint): bigint[] {
    const result = new Array<bigint>(poly.length + 1).fill(0n);
    for (let i = 0; i < poly.length; i += 1) {
        const coeff = poly[i] as bigint;
        result[i] = (result[i] as bigint) + mulMod(coeff, -root, mod);
        result[i + 1] = (result[i + 1] as bigint) + coeff;
    }
    return result.map((c) => ((c % mod) + mod) % mod);
}

/** Horner evaluation of a polynomial modulo mod. */
function evaluate(poly: bigint[], x: bigint, mod: bigint): bigint {
    let value = 0n;
    for (let i = poly.length - 1; i >= 0; i -= 1) {
        value = mulMod(value, x, mod) + (poly[i] as bigint);
        value %= mod;
    }
    return value;
}

/** Build bar entities from integer values, highlighting one index. */
function makeBars(values: number[], highlight: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index === highlight ? "active" : index === values.length - 1 ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** Find a factor, returning the polynomial coefficients and evaluation values. */
function factor(n: bigint): { factor: bigint; m: number; coefficients: number[]; values: number[]; hit: number } | null {
    if (n % 2n === 0n) {
        return { factor: 2n, m: 0, coefficients: [], values: [], hit: -1 };
    }
    const approximate = Math.sqrt(Number(n));
    if (Number.isFinite(approximate) && Number.isSafeInteger(Math.trunc(approximate)) && BigInt(Math.trunc(approximate)) ** 2n === n) {
        return { factor: BigInt(Math.trunc(approximate)), m: 0, coefficients: [], values: [], hit: -1 };
    }
    const m = Math.max(2, Math.ceil(Math.pow(Number(n), 0.25)) + 1);
    let poly: bigint[] = [1n];
    for (let i = 0; i < m; i += 1) {
        poly = multiplyByRoot(poly, BigInt(i), n);
    }
    const coefficients = poly.map((c) => Number(c % 1000000n));
    const values: number[] = [];
    const pointCount = Math.ceil(Math.sqrt(Number(n)) / m) + 2;
    for (let j = 1; j <= pointCount; j += 1) {
        const x = BigInt(j) * BigInt(m);
        const value = evaluate(poly, x, n);
        values.push(Number(value % 1000000n));
        let g = gcdBig(value, n);
        if (g === n) {
            // Both prime factors fell in the same block; isolate one by
            // checking the individual terms of the product.
            for (let i = 0; i < m; i += 1) {
                const term = ((x - BigInt(i)) % n + n) % n;
                const candidate = gcdBig(term, n);
                if (candidate > 1n && candidate < n) {
                    g = candidate;
                    break;
                }
            }
        }
        if (g > 1n && g < n) {
            return { factor: g, m, coefficients, values, hit: j - 1 };
        }
    }
    return null;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.trunc(task.n) : 10001;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([n], 0),
        edges: [],
        description: `Factoring ${n} with Pollard-Strassen polynomial evaluation.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, phase: "start" },
    };
    step += 1;

    if (!(n > 1) || !Number.isSafeInteger(n)) {
        yield {
            stepNumber: step,
            entities: makeBars([], -1),
            edges: [],
            description: "Input must be an integer greater than one.",
            codeLineNumber: 0,
            layout: "array",
            meta: { n, error: true },
        };
        return;
    }

    const result = factor(BigInt(n));
    if (!result) {
        yield {
            stepNumber: step,
            entities: makeBars([], -1),
            edges: [],
            description: `No factor was found for ${n}.`,
            codeLineNumber: 7,
            layout: "array",
            meta: { n, factor: 0, complete: true },
        };
        return;
    }

    yield {
        stepNumber: step,
        entities: makeBars(result.coefficients, -1),
        edges: [],
        description: `Built the degree-${result.m} polynomial with roots 0 through ${result.m - 1} modulo ${n}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { n, m: result.m, coefficients: result.coefficients.slice() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(result.values, result.hit),
        edges: [],
        description: result.hit >= 0
            ? `At evaluation point ${result.hit + 1}, the polynomial value shares a factor with ${n}.`
            : `Evaluated the polynomial at ${result.values.length} multiples of ${result.m}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, m: result.m, values: result.values.slice(), hit: result.hit },
    };
    step += 1;

    const factorNumber = Number(result.factor);
    const other = n / factorNumber;
    yield {
        stepNumber: step,
        entities: makeBars(result.values, result.hit),
        edges: [],
        description: `The gcd exposes factor ${factorNumber}, so ${n} = ${factorNumber} times ${other}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { n, factor: factorNumber, other, product: factorNumber * other, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Build a polynomial whose roots are the small integers starting at zero. Evaluating it at a multiple of m asks whether any of the last m integers before that multiple divides n: if a prime factor p sits in that block, one factor of the product is p, so the whole value is divisible by p. Try successive blocks until a gcd with n is nontrivial. This replaces trial division one candidate at a time with a batch of m candidates at once.",
        invariants: [
            "The polynomial is the product over i from zero to m minus one of x minus i, reduced modulo n.",
            "Each evaluation point is a different multiple of m, so consecutive blocks are disjoint.",
            "A zero polynomial value modulo a prime factor p means that block contains a multiple of p.",
        ],
        correctness:
            "Let p be the smallest prime factor of n, so p is at most the square root of n. Write p as j times m plus r with r between one and m. The evaluation point (j+1) times m has among its polynomial factors the term (j+1)m minus (m minus r), which equals p. Hence the polynomial value at that point is divisible by p, and its gcd with n is at least p and less than n. Trying all needed blocks therefore finds a proper factor.",
        complexityRationale:
            "The product polynomial has degree m about n to the one fourth, and direct Horner evaluation at about the square root of n over m points costs O(m times that count), roughly O(square root of n) modular operations. Fast multipoint evaluation and multiplication reduce this to O(n to the one fourth) up to logarithms. Space is dominated by the degree m polynomial, O(n to the one fourth).",
        uses: [
            "Factoring integers where trial division is too slow but general sieves are overkill",
            "A pedagogical bridge between elementary factoring and subexponential methods",
            "A building block for fast gcd-based factorization libraries",
        ],
        references: [
            "Pollard and Strassen, An Algorithm by Factoring, 1987",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Chapter 6",
        ],
        workedExample:
            "For n = 10001 the fourth root is about 10, so m = 12. The polynomial is the product of x minus i for i from 0 to 11. The prime factor 73 equals 6 times 12 plus 1, so at the evaluation point 7 times 12 = 84 the term 84 minus 11 equals 73. The polynomial value is then divisible by 73, and the gcd with 10001 returns 73.",
    },
    id: "pollard-strassen",
    name: "Pollard-Strassen Factorization",
    category: "math",
    complexity: { time: "O(sqrt(n) log n)", space: "O(n^(1/4))" },
    defaultInput: { n: 10001 },
    visualType: "array",
    run,
    pseudocode: [
        "if n is even or a square, return that easy factor",
        "set m to the fourth root of n rounded up",
        "build the product of x minus i for i from zero to m minus one",
        "reduce every coefficient modulo n",
        "for each multiple of m up to the square root of n",
        "evaluate the product polynomial at that point modulo n",
        "compute the gcd of the value with n",
        "if the gcd is proper, report the factorization",
    ],
};

export default module;
