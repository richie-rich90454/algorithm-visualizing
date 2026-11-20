/**
 * cantor-zassenhaus.ts - Cantor-Zassenhaus Polynomial Factorization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cantor-Zassenhaus factors a squarefree polynomial over GF(2) into monic
 * irreducibles. It first separates factors by degree (distinct-degree
 * factorization), then splits each equal-degree bucket with a randomized
 * trace-and-gcd step (equal-degree factorization).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) expected field operations for degree n
 *   Space: O(n) per working polynomial
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show each phase, the current degree, and the factor count.
 *   - The final frame reports the irreducible factors in meta.factors.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

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
function trace(h: Poly, d: number, f: Poly): Poly {
    let total: Poly = [0];
    let cur = h;
    for (let i = 0; i < d; i += 1) {
        total = add(total, cur);
        cur = divmod(mul(cur, cur), f)[1];
    }
    return trim(total);
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
        description: `Factoring a degree-${deg(f)} squarefree polynomial over GF(2) with Cantor-Zassenhaus.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, degree: deg(f) },
    };
    step += 1;

    // Phase 1: distinct-degree separation.
    const X: Poly = [0, 1];
    const buckets: Array<{ degree: number; factor: Poly }> = [];
    let h = f;
    let i = 1;
    while (deg(h) >= 2 * i) {
        const g = gcd(add(powXmod(Math.pow(2, i), h), X), h);
        if (deg(g) > 0) {
            buckets.push({ degree: i, factor: g });
            h = divmod(h, g)[0];
        }
        i += 1;
    }
    if (deg(h) > 0) buckets.push({ degree: deg(h), factor: h });

    yield {
        stepNumber: step,
        entities: makeCells(
            buckets.map((b) => b.degree),
            buckets.map((b) => `deg=${b.degree}`),
        ),
        edges: [],
        description: `Distinct-degree phase found ${buckets.length} bucket(s).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { step, buckets: buckets.length },
    };
    step += 1;

    // Phase 2: split each bucket by equal-degree factorization.
    let seed = 987654321;
    const nextRandom = (limit: number): number => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return (seed >>> 0) % limit;
    };
    const irreducibles: Poly[] = [];
    for (const bucket of buckets) {
        if (bucket.degree === 1) {
            irreducibles.push(bucket.factor);
            continue;
        }
        const stack: Poly[] = [bucket.factor];
        let attempts = 0;
        while (stack.length > 0) {
            const current = stack.pop()!;
            if (deg(current) <= bucket.degree) {
                irreducibles.push(current);
                continue;
            }
            let splitFound = false;
            for (let trial = 0; trial < 500; trial += 1) {
                attempts += 1;
                const hpoly = Array(deg(current)).fill(0);
                let nonzero = false;
                for (let k = 0; k < hpoly.length; k += 1) {
                    hpoly[k] = nextRandom(2);
                    if (hpoly[k]) nonzero = true;
                }
                if (!nonzero) continue;
                const g = gcd(trace(trim(hpoly), bucket.degree, current), current);
                if (deg(g) > 0 && deg(g) < deg(current)) {
                    stack.push(g);
                    stack.push(divmod(current, g)[0]);
                    splitFound = true;
                    yield {
                        stepNumber: step,
                        entities: makeCells([bucket.degree, deg(g), deg(current)], ["d", "split", "from"], 1),
                        edges: [],
                        description: `Degree-${bucket.degree} bucket split off a degree-${deg(g)} factor after ${attempts} attempt(s).`,
                        codeLineNumber: 5,
                        layout: "grid",
                        meta: { step, degree: bucket.degree, splitDegree: deg(g), attempts },
                    };
                    step += 1;
                    break;
                }
            }
            if (!splitFound) irreducibles.push(current);
        }
    }

    const product = irreducibles.reduce((acc, part) => mul(acc, part), [1]);
    yield {
        stepNumber: step,
        entities: makeCells(
            irreducibles.map((part) => deg(part)),
            irreducibles.map((part, idx) => `irr ${idx} deg ${deg(part)}`),
        ),
        edges: [],
        description: `Cantor-Zassenhaus complete with ${irreducibles.length} irreducible factor(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            step,
            factors: irreducibles.map((part) => part.join(",")),
            count: irreducibles.length,
            product: product.join(","),
            original: f.join(","),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Cantor-Zassenhaus is the standard randomized way to factor polynomials over a finite field. It works in two stages: first separate irreducible factors by their degree using gcds with x^(q^i) - x, then split each same-degree bucket by taking a random polynomial, forming a trace, and using its gcd with the bucket to peel off part of it. Recursion continues until only irreducibles remain.",
        invariants: [
            "The input polynomial is monic and squarefree.",
            "Distinct-degree buckets group irreducibles by a common degree.",
            "Every successful split divides a bucket into smaller valid buckets whose product is unchanged.",
        ],
        correctness:
            "The distinct-degree stage is correct because x^(q^i) - x contains exactly the irreducibles whose degree divides i, so each bucket truly holds one degree. Within a bucket the randomized trace is constant on each irreducible's root set, so its gcd isolates a subset with high probability; repeating handles unlucky draws. After all buckets are split into components of degree equal to their bucket degree, each component must be irreducible, and their product equals the original polynomial because every operation preserved it.",
        complexityRationale:
            "The distinct-degree sweep uses O(n) modular exponentiations on degree-n polynomials, and the splitting stage needs only a constant number of random trials per split with O(n^2) field work each. The expected total is O(n^3) field operations, with O(n) space per working polynomial.",
        uses: [
            "Factoring polynomials over finite fields in computer algebra systems",
            "Error-correcting code decoding and algebraic cryptography",
            "Constructing field extensions and irreducible-polynomial tables",
        ],
        references: [
            "Cantor and Zassenhaus, A New Algorithm for Factoring Polynomials over Finite Fields, 1981",
            "von zur Gathen and Gerhard, Modern Computer Algebra, Chapter 14",
        ],
        workedExample:
            "For f = (x^3+x+1)(x^3+x^2+1) over GF(2), the distinct-degree stage reports a single bucket of degree 3. The splitting stage draws a random h, forms its trace modulo f, and finds gcd equal to one cubic factor. Dividing it out leaves the other cubic, so the final answer lists the two irreducible cubics whose product is f.",
    },
    id: "cantor-zassenhaus",
    name: "Cantor-Zassenhaus Factorization",
    category: "math",
    complexity: { time: "O(n^3) expected", space: "O(n)" },
    defaultInput: { polynomial: [1, 1, 1, 1, 1, 1, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "input a monic squarefree polynomial f over GF(2)",
        "phase one: separate factors by degree",
        "for i from 1 while remaining degree >= 2i",
        "extract gcd(x^(2^i) - x, h) as the degree-i bucket",
        "phase two: for each bucket pick random h and form its trace",
        "split the bucket by gcd(trace, bucket) until irreducibles remain",
        "done: the list of irreducible factors",
    ],
};

export default module;
