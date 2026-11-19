/**
 * squarefree-factorization.ts - Squarefree Factorization of Polynomials
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Squarefree factorization separates a polynomial into parts whose roots are
 * all simple. It first computes the gcd of the polynomial with its derivative;
 * that gcd contains every repeated factor. Repeated gcd and division steps
 * then peel off the part that occurs once, the part that occurs twice, and so
 * on. This is the first stage of full polynomial factorization over a finite
 * field.
 *
 * The simulation works over a small prime field with exact modular integer
 * arithmetic. It is limited to degree eight and primes below one thousand so
 * every coefficient stays an ordinary JavaScript number.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d^3) for polynomial gcds on degree-d inputs
 *   Space: O(d) per polynomial buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show coefficients of the current polynomial at each stage.
 *   - The derivative and gcd frames reveal where repeated roots hide.
 *   - The final frame lists each squarefree factor and its multiplicity.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SquarefreeInput {
    coefficients?: number[];
    modulus?: number;
}

type Poly = number[];

function trim(p: Poly): Poly {
    const out = [...p];
    while (out.length > 1 && out[out.length - 1] === 0) out.pop();
    if (out.length === 0) out.push(0);
    return out;
}

function normalize(p: Poly, mod: number): Poly {
    return trim(p.map((c) => ((c % mod) + mod) % mod));
}

function add(a: Poly, b: Poly, mod: number): Poly {
    const out = new Array<number>(Math.max(a.length, b.length)).fill(0);
    for (let i = 0; i < out.length; i += 1) out[i] = ((a[i] ?? 0) + (b[i] ?? 0)) % mod;
    return normalize(out, mod);
}

function sub(a: Poly, b: Poly, mod: number): Poly {
    const out = new Array<number>(Math.max(a.length, b.length)).fill(0);
    for (let i = 0; i < out.length; i += 1) out[i] = ((a[i] ?? 0) - (b[i] ?? 0)) % mod;
    return normalize(out, mod);
}

function mul(a: Poly, b: Poly, mod: number): Poly {
    const out = new Array<number>(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) {
            out[i + j] = (out[i + j]! + a[i]! * b[j]!) % mod;
        }
    }
    return normalize(out, mod);
}

function powMod(a: number, e: number, mod: number): number {
    let base = ((a % mod) + mod) % mod;
    let exp = e;
    let result = 1;
    while (exp > 0) {
        if (exp % 2 === 1) result = (result * base) % mod;
        base = (base * base) % mod;
        exp = Math.floor(exp / 2);
    }
    return result;
}

function inv(a: number, mod: number): number {
    return powMod(a, mod - 2, mod);
}

function derivative(a: Poly, mod: number): Poly {
    const out = a.slice(1).map((c, i) => (c * (i + 1)) % mod);
    return normalize(out.length ? out : [0], mod);
}

function divmod(a: Poly, b: Poly, mod: number): [Poly, Poly] {
    let remainder = normalize(a, mod);
    const divisor = normalize(b, mod);
    const quotient = new Array<number>(Math.max(1, remainder.length - divisor.length + 1)).fill(0);
    const divisorLead = divisor[divisor.length - 1]!;
    while (remainder.length >= divisor.length && !(remainder.length === 1 && remainder[0] === 0)) {
        const shift = remainder.length - divisor.length;
        const factor = (remainder[remainder.length - 1]! * inv(divisorLead, mod)) % mod;
        quotient[shift] = factor;
        for (let j = 0; j < divisor.length; j += 1) {
            remainder[shift + j] = (remainder[shift + j]! - factor * divisor[j]!) % mod;
        }
        remainder = normalize(remainder, mod);
    }
    return [normalize(quotient, mod), remainder];
}

function leadingInverse(a: Poly, mod: number): number {
    return inv(a[a.length - 1]!, mod);
}

function gcdPoly(a: Poly, b: Poly, mod: number): Poly {
    let x = normalize(a, mod);
    let y = normalize(b, mod);
    while (!(y.length === 1 && y[0] === 0)) {
        const remainder = divmod(x, y, mod)[1];
        x = y;
        y = remainder;
    }
    const scale = leadingInverse(x, mod);
    return normalize(x.map((c) => (c * scale) % mod), mod);
}

function isZero(p: Poly): boolean {
    return p.length === 1 && p[0] === 0;
}

/** Bars for a polynomial's coefficients. */
function makeBars(poly: Poly, state: EntityState): VisualEntity[] {
    return poly.map((value, index) => ({
        id: `coef-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, degree: index },
    }));
}

/** The squarefree factorization generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SquarefreeInput | null) ?? {};
    const mod = Math.max(101, Math.min(997, Math.floor(Number(task.modulus) || 101)));
    const supplied = Array.isArray(task.coefficients) && task.coefficients.length > 1 ? task.coefficients : [-2, 5, -4, 1];
    const f = normalize(supplied.slice(0, 9), mod);
    const derivative = derivativePoly(f, mod);
    const c = gcdPoly(f, derivative, mod);
    const [wInitial] = divmod(f, c, mod);
    let w = wInitial!;
    let common = c;
    let multiplicity = 1;
    const factors: Array<{ poly: Poly; multiplicity: number }> = [];

    const metaBase = {
        modulus: mod,
        input: f,
        derivative,
        repeatedPart: c,
        factorCoefficients: [] as number[],
        factorMultiplicities: [] as number[],
        factorDegrees: [] as number[],
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(f, "idle"),
        edges: [],
        description: `Loaded a degree-${f.length - 1} polynomial over the field modulo ${mod}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaBase },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(derivative, "comparing"),
        edges: [],
        description: `The formal derivative shares a factor with f exactly where f has repeated roots.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...metaBase },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(c, "comparing"),
        edges: [],
        description: `The gcd of f and its derivative has degree ${c.length - 1} and contains all repeated roots.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...metaBase },
    };
    step += 1;

    while (!isZero(w) && w.length > 1) {
        const y = gcdPoly(w, common, mod);
        const [factor] = divmod(w, y, mod);
        if (factor && !isZero(factor) && factor.length > 1) {
            factors.push({ poly: factor, multiplicity });
        }
        const [nextCommon] = divmod(common, y, mod);
        w = y;
        common = nextCommon ?? [0];
        yield {
            stepNumber: step,
            entities: makeBars(factor ?? [0], "active"),
            edges: [],
            description: `Peeled the squarefree factor of multiplicity ${multiplicity}; its degree is ${(factor?.length ?? 1) - 1}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                ...metaBase,
                factorCoefficients: factors.flatMap((entry) => entry.poly),
                factorMultiplicities: factors.map((entry) => entry.multiplicity),
                factorDegrees: factors.map((entry) => entry.poly.length - 1),
            },
        };
        step += 1;
        multiplicity += 1;
        if (multiplicity > f.length + 1) break;
    }

    yield {
        stepNumber: step,
        entities: makeBars(factors.flatMap((entry) => entry.poly), "active"),
        edges: [],
        description: `Squarefree decomposition complete: ${factors.length} factor(s) with multiplicities ${factors.map((entry) => entry.multiplicity).join(", ")}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            ...metaBase,
            factorCoefficients: factors.flatMap((entry) => entry.poly),
            factorMultiplicities: factors.map((entry) => entry.multiplicity),
            factorDegrees: factors.map((entry) => entry.poly.length - 1),
        },
    };
}

/** Alias so the name does not collide with the imported-free local helper. */
function derivativePoly(p: Poly, mod: number): Poly {
    return derivative(p, mod);
}

/** The squarefree factorization module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A repeated root leaves a fingerprint: the derivative of the polynomial also vanishes there. Taking the gcd of a polynomial with its derivative therefore isolates every factor that appears more than once. Dividing repeatedly peels off the once-occurring part, the twice-occurring part, and so on until nothing remains.",
        invariants: [
            "Every coefficient is reduced modulo the same small prime.",
            "The derivative shares a root with f precisely at repeated roots, in characteristic larger than the degree.",
            "Each peeled factor has no repeated root of its own.",
        ],
        correctness:
            "Write f as the product of monic irreducible powers. Its derivative contains each irreducible with exponent one less, so the gcd with f contains each with exponent one less as well and the quotient w contains one copy of every distinct irreducible. At step i, the gcd of the remaining w and the remaining common part collects the irreducibles still occurring at least i times; dividing w by that gcd yields exactly those occurring i times. Induction on i gives the full squarefree decomposition.",
        complexityRationale:
            "Each gcd uses the Euclidean algorithm on polynomials of degree at most d, taking O(d^2) modular operations. There are at most d iterations, so the total is O(d^3) time, and the polynomial buffers use O(d) space at any moment.",
        uses: [
            "The first stage of polynomial factorization over finite fields",
            "Removing multiplicities before distinct-degree factorization",
            "Symbolic integration and squarefree decomposition in computer algebra",
        ],
        references: [
            "Knuth, The Art of Computer Programming Volume 2, Section 4.6.2",
            "von zur Gathen and Gerhard, Modern Computer Algebra, Chapter 14",
        ],
        workedExample:
            "Over a large prime field, the polynomial (x minus one) squared times (x minus two) has derivative whose gcd with f is (x minus one). Dividing gives w equals (x minus one)(x minus two). The first peeled factor is that whole w with multiplicity one, and the next factor is (x minus one) with multiplicity two.",
    },
    id: "squarefree-factorization",
    name: "Squarefree Factorization",
    category: "math",
    complexity: { time: "O(d^3)", space: "O(d)" },
    defaultInput: { coefficients: [-2, 5, -4, 1], modulus: 101 },
    visualType: "array",
    run,
    pseudocode: [
        "reduce the polynomial coefficients modulo the prime",
        "compute the formal derivative of the polynomial",
        "set c to the gcd of the polynomial and its derivative",
        "set w to the polynomial divided by c",
        "for each multiplicity i, peel gcd of w and c",
        "record the quotient as the multiplicity-i factor",
        "replace w and c by the division remainders",
        "done: report the squarefree factors and multiplicities",
    ],
};

export default module;
