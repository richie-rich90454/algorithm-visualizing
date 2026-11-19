/**
 * toom-cook-multiplication.ts - Toom-3 Integer Multiplication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Toom-Cook splits each integer into k limbs in a chosen base, treats each
 * operand as a polynomial evaluated at that base, multiplies the two small
 * polynomials from k*2-1 point values, and interpolates the product
 * coefficients before recombining them. Toom-3 uses three limbs and five
 * evaluation points, reducing the four recursive products of Karatsuba to five
 * point products on smaller operands. This module interpolates with exact
 * rational arithmetic so the recombined integer is exact.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n^1.465) for the three-way split asymptotically
 *   Space: O(n) for the working coefficients
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Array bars show the limbs, the five point products, and result digits.
 *   - meta carries the base and the exact product as a string.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Fraction = { n: bigint; d: bigint };

function absBig(x: bigint): bigint {
    return x < 0n ? -x : x;
}

function gcdBig(a: bigint, b: bigint): bigint {
    let x = absBig(a);
    let y = absBig(b);
    while (y !== 0n) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

function frac(n: bigint, d: bigint = 1n): Fraction {
    if (d === 0n) return { n: 0n, d: 1n };
    let numerator = n;
    let denominator = d;
    if (denominator < 0n) {
        numerator = -numerator;
        denominator = -denominator;
    }
    const g = gcdBig(numerator, denominator) || 1n;
    return { n: numerator / g, d: denominator / g };
}

function addFrac(a: Fraction, b: Fraction): Fraction {
    return frac(a.n * b.d + b.n * a.d, a.d * b.d);
}

/** Evaluate a polynomial with integer coefficients at an integer point. */
export function evaluate(poly: bigint[], x: bigint): bigint {
    let result = 0n;
    let power = 1n;
    for (const coefficient of poly) {
        result += coefficient * power;
        power *= x;
    }
    return result;
}

/** Split a nonnegative integer into three base-B limbs. */
export function splitLimbs(value: bigint, base: bigint): bigint[] {
    const limbs = [0n, 0n, 0n];
    let remaining = value;
    for (let i = 0; i < 3; i += 1) {
        limbs[i] = remaining % base;
        remaining /= base;
    }
    return limbs;
}

/** A base large enough that both operands fit in three limbs. */
export function sufficientBase(a: bigint, b: bigint): bigint {
    const largest = a > b ? a : b;
    return BigInt(Math.ceil(Math.cbrt(Number(largest))) + 2);
}

/** Toom-3 product of two nonnegative integers, exact via rational interpolation. */
export function toomCookProduct(a: bigint, b: bigint, base?: bigint): bigint {
    if (a === 0n || b === 0n) return 0n;
    const chosenBase = base ?? sufficientBase(a, b);
    if (a >= chosenBase ** 3n || b >= chosenBase ** 3n) {
        return toomCookProduct(a, b, sufficientBase(a, b));
    }
    return toomCookSingleLevel(a, b, chosenBase);
}

function toomCookSingleLevel(a: bigint, b: bigint, base: bigint): bigint {
    const fa = splitLimbs(a, base);
    const fb = splitLimbs(b, base);
    const points = [-2n, -1n, 0n, 1n, 2n];
    const products = points.map((x) => evaluate(fa, x) * evaluate(fb, x));

    const coefficients: Fraction[] = [
        frac(0n),
        frac(0n),
        frac(0n),
        frac(0n),
        frac(0n),
    ];

    for (let j = 0; j < points.length; j += 1) {
        const xj = points[j] ?? 0n;
        let basis: bigint[] = [1n, 0n, 0n, 0n, 0n];
        let denominator = 1n;
        for (let k = 0; k < points.length; k += 1) {
            if (k === j) continue;
            const xk = points[k] ?? 0n;
            const next = [0n, 0n, 0n, 0n, 0n];
            for (let i = 0; i < 5; i += 1) {
                next[i] = (i > 0 ? (basis[i - 1] ?? 0n) : 0n) - xk * (basis[i] ?? 0n);
            }
            basis = next;
            denominator *= xj - xk;
        }
        const scale = frac(products[j] ?? 0n, denominator);
        for (let i = 0; i < 5; i += 1) {
            coefficients[i] = addFrac(coefficients[i] ?? frac(0n), frac(scale.n * (basis[i] ?? 0n), scale.d));
        }
    }

    let result = 0n;
    let power = 1n;
    for (let i = 0; i < 5; i += 1) {
        const c = coefficients[i] ?? frac(0n);
        const quotient = c.n / c.d;
        result += quotient * power;
        power *= base;
    }
    return result;
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
    const task = (input as { a?: number; b?: number; base?: number } | null) ?? {};
    const a = BigInt(Math.max(0, Math.floor(task.a ?? 12345678)));
    const b = BigInt(Math.max(0, Math.floor(task.b ?? 87654321)));
    const requested = BigInt(Math.max(2, Math.floor(task.base ?? 100)));
    const base = a >= requested ** 3n || b >= requested ** 3n ? sufficientBase(a, b) : requested;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([Number(a % 1000000n), Number(b % 1000000n)], -1),
        edges: [],
        description: `Toom-3 multiplication of two integers in base ${base}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { a: a.toString(), b: b.toString(), base: base.toString() },
    };
    step += 1;

    const fa = splitLimbs(a, base);
    const fb = splitLimbs(b, base);
    yield {
        stepNumber: step,
        entities: makeBars([...fa, ...fb].map((limb) => Number(limb)), -1),
        edges: [],
        description: "Both operands are split into three limbs in the chosen base.",
        codeLineNumber: 1,
        layout: "array",
        meta: { limbsA: fa.map(String), limbsB: fb.map(String) },
    };
    step += 1;

    const points = [-2n, -1n, 0n, 1n, 2n];
    const products = points.map((x) => evaluate(fa, x) * evaluate(fb, x));
    yield {
        stepNumber: step,
        entities: makeBars(products.map((p) => Number(p % 1000000n)), -1),
        edges: [],
        description: "Evaluate both limb polynomials at five points and multiply pointwise.",
        codeLineNumber: 2,
        layout: "array",
        meta: { points: points.map(String), products: products.map(String) },
    };
    step += 1;

    const product = toomCookProduct(a, b, base);
    const digits: number[] = [];
    let remaining = product;
    const displayBase = 1000n;
    for (let i = 0; i < 5; i += 1) {
        digits.push(Number(remaining % displayBase));
        remaining /= displayBase;
    }
    yield {
        stepNumber: step,
        entities: makeBars(digits, -1),
        edges: [],
        description: `Done: interpolation and recombination give the exact product ${product}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { product: product.toString(), base: base.toString() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An integer written in base B is a polynomial evaluated at B. Multiplying two such polynomials can be done by sampling both at a few points, multiplying the samples, and reconstructing the product polynomial. Toom-3 needs three limbs and five sample points because a degree-two times a degree-two polynomial has degree four. Exact fractions avoid rounding errors during reconstruction.",
        invariants: [
            "Evaluating a limb polynomial at the base reproduces the original integer.",
            "The product polynomial has degree at most four for two degree-two inputs.",
            "Interpolating from five distinct points recovers every product coefficient uniquely.",
        ],
        correctness:
            "A polynomial of degree d is uniquely determined by d+1 distinct evaluations. Evaluating both operands at the same five points and multiplying gives five evaluations of their product polynomial, which has degree four. Lagrange interpolation rebuilds each coefficient exactly, and evaluating the reconstructed polynomial at the base recombines the limbs into the true integer product.",
        complexityRationale:
            "Three limbs and five point products form a constant-size instance for fixed base; recursively applying the split to large integers gives the reported sub-quadratic exponent. The working arrays hold a constant number of limbs at each level, so space is linear in the operand size.",
        uses: [
            "Multiplying very large integers in arbitrary-precision libraries",
            "Fast polynomial multiplication over finite fields",
            "Compiler and proof-assistant arithmetic on big numerals",
        ],
        references: [
            "Toom, Using several kinds of the methods of fast multiplication, 1963",
            "Cook, On the Minimum Computation Time of Functions, 1966",
        ],
        workedExample:
            "With base 100, the number 12345 becomes limbs 45, 23, 1. Another number splits the same way. Evaluating both at minus two, minus one, zero, one, and two produces five products; Lagrange interpolation reconstructs the four product coefficients and recombining at base 100 gives the exact product, which matches ordinary multiplication.",
    },
    id: "toom-cook-multiplication",
    name: "Toom-Cook Multiplication (Toom-3)",
    category: "math",
    complexity: { time: "O(n^1.465)", space: "O(n)" },
    defaultInput: { a: 12345678, b: 87654321, base: 100 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a base and split each operand into three limbs",
        "view each operand as a polynomial in that base",
        "evaluate both polynomials at five integer points",
        "multiply the sampled values pairwise",
        "interpolate the four product coefficients with exact fractions",
        "recombine coefficients at the base to form the product",
        "done: report the exact integer product",
    ],
};

export default module;
