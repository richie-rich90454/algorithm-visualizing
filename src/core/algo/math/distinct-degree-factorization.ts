/**
 * distinct-degree-factorization.ts - Distinct-Degree Factorization over GF(2)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Distinct-degree factorization splits a squarefree polynomial f over GF(2)
 * into products whose irreducible factors all share the same degree. It uses
 * the identity that x^(2^i) - x is the product of all monic irreducibles whose
 * degree divides i, so gcd(x^(2^i) - x, f) peels off exactly the degree-i part.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 * log n) field operations for degree n
 *   Space: O(n) per working polynomial
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the current degree i, gcd degree, and remaining f.
 *   - The final frame reports each (degree, factor) pair in meta.factors.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

// Polynomials are little-endian coefficient arrays over GF(2).
type Poly = number[];

const trim = (a: Poly): Poly => {
    const r = a.slice();
    while (r.length > 1 && r[r.length - 1] === 0) r.pop();
    return r;
};
const trimInPlace = (a: Poly): Poly => {
    while (a.length > 1 && a[a.length - 1] === 0) a.pop();
    return a;
};
const deg = (a: Poly): number => a.length - 1;
const add = (a: Poly, b: Poly): Poly => {
    const n = Math.max(a.length, b.length);
    const r = Array(n).fill(0);
    for (let i = 0; i < n; i += 1) r[i] = (a[i] ?? 0) ^ (b[i] ?? 0);
    return trim(r);
};
const mul = (a: Poly, b: Poly): Poly => {
    const r = Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) if (a[i] && b[j]) r[i + j] ^= 1;
    }
    return trim(r);
};
function divmod(a: Poly, b: Poly): [Poly, Poly] {
    const rem = a.slice();
    const q = Array(Math.max(1, a.length - b.length + 1)).fill(0);
    while (!(rem.length === 1 && rem[0] === 0) && deg(rem) >= deg(b)) {
        const shift = deg(rem) - deg(b);
        q[shift] ^= 1;
        for (let i = 0; i < b.length; i += 1) rem[i + shift] ^= b[i];
        trimInPlace(rem);
    }
    return [trim(q), rem];
}
function gcd(a: Poly, b: Poly): Poly {
    let x = a.slice();
    let y = b.slice();
    while (!(y.length === 1 && y[0] === 0)) {
        const r = divmod(x, y)[1];
        x = y;
        y = r;
    }
    return x;
}
function powXmod(e: number, f: Poly): Poly {
    let result: Poly = [1];
    let base = divmod([0, 1], f)[1];
    let exp = e;
    while (exp > 0) {
        if (exp % 2 === 1) result = divmod(mul(result, base), f)[1];
        base = divmod(mul(base, base), f)[1];
        exp = Math.floor(exp / 2);
    }
    return result;
}

function encode(poly: Poly): string {
    return poly.join(",");
}

function makeCells(values: number[], labels: string[], active = -1): VisualEntity[] {
    return values.map((value, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: labels[i] ?? String(value),
        value,
        state: (i === active ? "comparing" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { polynomial?: number[] } | null) ?? {};
    let f: Poly = trim(task.polynomial ?? [1, 1, 1, 1, 1, 1, 1]);
    if (deg(f) < 2) f = [1, 1, 1, 1, 1, 1, 1];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(f, f.map((v, i) => `x^${i}:${v}`)),
        edges: [],
        description: `Splitting a degree-${deg(f)} squarefree polynomial over GF(2) by distinct-degree factorization.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, degree: deg(f) },
    };
    step += 1;

    const X: Poly = [0, 1];
    const factors: Array<{ degree: number; factor: Poly }> = [];
    let h = f;
    let i = 1;
    while (deg(h) >= 2 * i) {
        const xi = powXmod(Math.pow(2, i), h);
        const g = gcd(add(xi, X), h);
        yield {
            stepNumber: step,
            entities: makeCells([i, deg(g), deg(h)], ["i", "gcd deg", "rem deg"], 1),
            edges: [],
            description: `Degree i=${i}: gcd(x^(2^${i}) - x, h) has degree ${deg(g)}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { step, i, gcdDegree: deg(g), remaining: deg(h) },
        };
        step += 1;
        if (deg(g) > 0) {
            factors.push({ degree: i, factor: g });
            h = divmod(h, g)[0];
        }
        i += 1;
    }
    if (deg(h) > 0) factors.push({ degree: deg(h), factor: h });

    yield {
        stepNumber: step,
        entities: makeCells(
            factors.map((entry) => entry.degree),
            factors.map((entry) => `deg=${entry.degree}`),
        ),
        edges: [],
        description: `Distinct-degree factorization complete with ${factors.length} component(s).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            step,
            factors: factors.map((entry) => `${entry.degree}:${encode(entry.factor)}`),
            count: factors.length,
            product: encode(factors.reduce((acc, entry) => mul(acc, entry.factor), [1])),
            original: encode(f),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Over a finite field, x^(q^i) - x is exactly the product of all monic irreducible polynomials whose degree divides i. Taking the gcd of that expression with the input polynomial therefore pulls out precisely the irreducible factors of degree i. Sweeping i upward separates the factors into degree buckets.",
        invariants: [
            "The input polynomial is monic and squarefree, so each irreducible appears once.",
            "gcd(x^(2^i) - x, h) contains only irreducibles whose degree divides i.",
            "Each extracted component is divided out of h, so components are disjoint.",
        ],
        correctness:
            "The product identity for x^(q^i) - x over GF(q) means an irreducible of degree d divides it if and only if d divides i. When the sweep reaches i = d, the gcd with the remaining h collects exactly the degree-d irreducibles, and none were collected earlier because no smaller i is a multiple of d. Dividing them out leaves the higher-degree part; the loop stops once deg(h) < 2i, at which point h must be irreducible and forms the last component.",
        complexityRationale:
            "Each sweep step computes x^(2^i) mod h with O(log(2^i)) = O(i) polynomial multiplications of degree at most n, plus a gcd, so the total is polynomial in the degree n, bounded by O(n^2 log n) field operations. Working storage is O(n).",
        uses: [
            "The first phase of the Cantor-Zassenhaus factorization algorithm",
            "Factoring polynomials over finite fields in computer algebra systems",
            "Constructing finite fields and irreducible-polynomial tables",
        ],
        references: [
            "Cantor and Zassenhaus, A New Algorithm for Factoring Polynomials over Finite Fields, 1981",
            "Knuth, The Art of Computer Programming Volume 2, Section 4.6.2",
        ],
        workedExample:
            "The degree-6 polynomial (x^3+x+1)(x^3+x^2+1) over GF(2) is squarefree. At i=1 the gcd with x^2-x is trivial. At i=3 the polynomial x^8-x is divisible by both cubic factors, so gcd(x^8-x, f) = f and the whole polynomial is reported as the degree-3 component, matching the fact that both irreducible factors have degree three.",
    },
    id: "distinct-degree-factorization",
    name: "Distinct-Degree Factorization",
    category: "math",
    complexity: { time: "O(n^2 log n)", space: "O(n)" },
    defaultInput: { polynomial: [1, 1, 1, 1, 1, 1, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "input a monic squarefree polynomial f over GF(2)",
        "set h = f and degree i = 1",
        "while degree(h) >= 2i",
        "compute g = gcd(x^(2^i) - x, h)",
        "if g is nontrivial, record (i, g) and divide h by g",
        "increment i",
        "record any remaining h as its own component",
        "done: the distinct-degree factors",
    ],
};

export default module;
