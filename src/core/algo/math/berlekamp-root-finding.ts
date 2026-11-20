/**
 * berlekamp-root-finding.ts - Berlekamp Root Finding over a Finite Field
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This module finds every root of a polynomial over the prime field GF(p).
 * It first intersects the polynomial with x^p minus x, which keeps exactly the
 * distinct linear factors. It then repeatedly applies an equal-degree split:
 * for a field element a, the gcd of h with (x+a)^((p-1)/2) minus one separates
 * the roots according to whether a is a quadratic residue. Recursing on each
 * side isolates every linear factor and therefore every root. This is the
 * root-extraction specialization of Berlekamp's method; unlike the cataloged
 * Berlekamp polynomial factorization module, it returns field elements rather
 * than irreducible factor polynomials.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 log p) field operations for degree n
 *   Space: O(n) for the polynomial work arrays
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Poly = number[];

/** Normalize a polynomial by removing trailing zeros. */
function trim(poly: Poly): Poly {
    const result = poly.slice();
    while (result.length > 1 && result[result.length - 1] === 0) {
        result.pop();
    }
    return result;
}

/** Modular inverse of a nonzero field element. */
function inv(value: number, p: number): number {
    let t = 0;
    let newT = 1;
    let r = p;
    let newR = ((value % p) + p) % p;
    while (newR !== 0) {
        const q = Math.floor(r / newR);
        const oldT = t;
        t = newT;
        newT = oldT - q * newT;
        const oldR = r;
        r = newR;
        newR = oldR - q * newR;
    }
    return ((t % p) + p) % p;
}

function add(a: Poly, b: Poly, p: number): Poly {
    const result = new Array<number>(Math.max(a.length, b.length)).fill(0);
    for (let i = 0; i < result.length; i += 1) {
        result[i] = (((a[i] ?? 0) + (b[i] ?? 0)) % p + p) % p;
    }
    return trim(result);
}

function sub(a: Poly, b: Poly, p: number): Poly {
    const result = new Array<number>(Math.max(a.length, b.length)).fill(0);
    for (let i = 0; i < result.length; i += 1) {
        result[i] = (((a[i] ?? 0) - (b[i] ?? 0)) % p + p) % p;
    }
    return trim(result);
}

function mul(a: Poly, b: Poly, p: number): Poly {
    if (a.length === 1 && a[0] === 0) {
        return [0];
    }
    const result = new Array<number>(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) {
            result[i + j] = (result[i + j] as number) + (a[i] as number) * (b[j] as number);
            result[i + j] %= p;
        }
    }
    return trim(result);
}

/** Polynomial remainder of a divided by b over GF(p). */
function rem(a: Poly, b: Poly, p: number): Poly {
    const result = a.slice();
    const leadInv = inv(b[b.length - 1] as number, p);
    while (result.length >= b.length && !(result.length === 1 && result[0] === 0)) {
        const shift = result.length - b.length;
        const factor = ((result[result.length - 1] as number) * leadInv) % p;
        for (let i = 0; i < b.length; i += 1) {
            result[shift + i] = (((result[shift + i] as number) - factor * (b[i] as number)) % p + p) % p;
        }
        trimInPlace(result);
    }
    return result;
}

function trimInPlace(poly: Poly): void {
    while (poly.length > 1 && poly[poly.length - 1] === 0) {
        poly.pop();
    }
}

/** Monic polynomial gcd over GF(p). */
function gcd(a: Poly, b: Poly, p: number): Poly {
    let x = trim(a);
    let y = trim(b);
    while (!(y.length === 1 && y[0] === 0)) {
        const r = rem(x, y, p);
        x = y;
        y = r;
    }
    if (x.length === 1 && x[0] === 0) {
        return [0];
    }
    const scale = inv(x[x.length - 1] as number, p);
    return x.map((c) => (c * scale) % p);
}

/** Polynomial exponentiation modulo a polynomial. */
function powMod(base: Poly, exponent: number, modPoly: Poly, p: number): Poly {
    let result: Poly = [1];
    let b = rem(base, modPoly, p);
    let e = exponent;
    while (e > 0) {
        if (e & 1) {
            result = rem(mul(result, b, p), modPoly, p);
        }
        b = rem(mul(b, b, p), modPoly, p);
        e = Math.floor(e / 2);
    }
    return result;
}

/** Polynomial quotient of a by b over GF(p). */
function div(a: Poly, b: Poly, p: number): Poly {
    const work = a.slice();
    const quotient = new Array<number>(Math.max(1, a.length - b.length + 1)).fill(0);
    const leadInv = inv(b[b.length - 1] as number, p);
    while (work.length >= b.length && !(work.length === 1 && work[0] === 0)) {
        const shift = work.length - b.length;
        const factor = ((work[work.length - 1] as number) * leadInv) % p;
        quotient[shift] = factor;
        for (let i = 0; i < b.length; i += 1) {
            work[shift + i] = (((work[shift + i] as number) - factor * (b[i] as number)) % p + p) % p;
        }
        trimInPlace(work);
    }
    return trim(quotient);
}

/** Record of one equal-degree splitting step for the visualization. */
type SplitStep = { poly: Poly; candidate: number; left: Poly; right: Poly };

/** Collect all roots by recursively splitting the squarefree linear part. */
function findRoots(f: Poly, p: number): { roots: number[]; steps: SplitStep[] } {
    const steps: SplitStep[] = [];
    const xp = powMod([0, 1], p, f, p);
    const squarefree = gcd(f, sub(xp, [0, 1], p), p);
    if (squarefree.length <= 1) {
        return { roots: [], steps };
    }
    const roots: number[] = [];
    const recurse = (h: Poly, depth: number): void => {
        if (depth > 40) {
            return;
        }
        if (h.length <= 1) {
            return;
        }
        if (h.length === 2) {
            roots.push(((p - (h[0] as number)) * inv(h[1] as number, p)) % p);
            return;
        }
        const half = (p - 1) / 2;
        for (let a = 0; a < p; a += 1) {
            const power = powMod([a, 1], half, h, p);
            const left = gcd(sub(power, [1], p), h, p);
            if (left.length > 1 && left.length < h.length) {
                const right = div(h, left, p);
                steps.push({ poly: h.slice(), candidate: a, left: left.slice(), right: right.slice() });
                recurse(left, depth + 1);
                recurse(right, depth + 1);
                return;
            }
        }
    };
    recurse(squarefree, 0);
    return { roots: roots.sort((x, y) => x - y), steps };
}

/** Evaluate a polynomial at a field element for verification. */
function evaluate(poly: Poly, x: number, p: number): number {
    let value = 0;
    for (let i = poly.length - 1; i >= 0; i -= 1) {
        value = (value * x + (poly[i] as number)) % p;
    }
    return ((value % p) + p) % p;
}

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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { coefficients?: number[]; p?: number } | null) ?? {};
    const coefficients: number[] = task.coefficients ?? [6, 0, 0, 1];
    const p = typeof task.p === "number" ? Math.trunc(task.p) : 7;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(coefficients, 0),
        edges: [],
        description: `Finding roots of the given polynomial over GF(${p}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { p, phase: "start", coefficients: coefficients.slice() },
    };
    step += 1;

    if (!(p >= 3) || coefficients.length < 2) {
        yield {
            stepNumber: step,
            entities: makeBars([], -1),
            edges: [],
            description: "Root finding needs an odd prime and a polynomial of positive degree.",
            codeLineNumber: 0,
            layout: "array",
            meta: { p, error: true },
        };
        return;
    }

    const f = trim(coefficients.map((c) => ((c % p) + p) % p));
    const { roots, steps } = findRoots(f, p);
    for (const split of steps) {
        yield {
            stepNumber: step,
            entities: makeBars(split.poly, -1),
            edges: [],
            description: `Candidate ${split.candidate} splits the current factor of degree ${split.poly.length - 1} into degrees ${split.left.length - 1} and ${split.right.length - 1}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { p, candidate: split.candidate, leftDegree: split.left.length - 1, rightDegree: split.right.length - 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(roots.length > 0 ? roots : [0], -1),
        edges: [],
        description: roots.length > 0
            ? `Found ${roots.length} root(s) in GF(${p}): ${roots.join(", ")}.`
            : `The polynomial has no roots in GF(${p}).`,
        codeLineNumber: 7,
        layout: "array",
        meta: { p, roots: roots.slice(), count: roots.length, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Roots of a polynomial over a finite field are exactly the linear factors of its squarefree part. Intersect the polynomial with x to the p minus x to discard repeated and irreducible factors. Then split the remaining product by testing, for each field element a, whether a root makes x plus a a quadratic residue; a gcd separates the two classes. Recurse until the factors are linear and read off the roots.",
        invariants: [
            "The polynomial gcd with x to the p minus x keeps exactly the distinct linear factors.",
            "Every split partitions the current root set into two disjoint classes.",
            "A degree-one factor a*x plus b has the single root negative b times the inverse of a.",
        ],
        correctness:
            "Over GF(p) the polynomial x to the p minus x vanishes exactly on all field elements, so its gcd with f contains precisely the linear factors of f, once each. For a field element a, the value (r+a) to the (p-1)/2 is one exactly when r+a is a nonzero quadratic residue, so the gcd with (x+a) to that power minus one selects a strict subset of the current roots when a is chosen well. Iterating until degree one therefore isolates every root, and each reported root evaluates to zero in the field.",
        complexityRationale:
            "Polynomial multiplication and remainder for degree n take O(n^2) field operations, and modular exponentiation uses O(log p) multiplications. Each split reduces degree, so at most n splits occur. The total is O(n^2 log p) field operations with O(n) working space.",
        uses: [
            "Solving polynomial equations over finite fields in coding theory",
            "Computing discrete logarithm and elliptic-curve group structures",
            "A subroutine in polynomial factorization and symbolic algebra systems",
        ],
        references: [
            "Berlekamp, Factoring Polynomials over Large Finite Fields, 1970",
            "Rabin, Probabilistic Algorithms in Finite Fields, 1980",
        ],
        workedExample:
            "Over GF(7), the polynomial x cubed minus one has coefficients 6, 0, 0, 1. Its gcd with x to the 7 minus x keeps all three linear factors. Splitting with field candidates separates the roots, which evaluate to 1, 2, and 4, since 1, 8, and 64 are all congruent to one modulo seven.",
    },
    id: "berlekamp-root-finding",
    name: "Berlekamp Root Finding",
    category: "math",
    complexity: { time: "O(n^2 log p)", space: "O(n)" },
    defaultInput: { coefficients: [6, 0, 0, 1], p: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "reduce the polynomial modulo the prime field",
        "compute the gcd with x to the p minus x",
        "if the result is constant, report no roots",
        "for each field element as a splitting candidate",
        "compute (x plus a) to the (p-1)/2 modulo the current factor",
        "gcd that with the factor to split the root set",
        "recurse until each factor is linear and read its root",
        "done: report all roots in sorted order",
    ],
};

export default module;
