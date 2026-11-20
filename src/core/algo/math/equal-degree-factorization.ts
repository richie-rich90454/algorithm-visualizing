/**
 * equal-degree-factorization.ts - Equal-Degree Factorization over GF(2)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Equal-degree factorization splits a polynomial that is a product of
 * distinct monic irreducibles all of the same degree d. Over GF(2) it uses the
 * trace T = h + h^2 + ... + h^(2^(d-1)) mod f: for a random h the gcd of T and
 * f is a nontrivial factor with high probability, and recursion finishes the
 * split.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) successful splits, each O(n^2) field operations
 *   Space: O(n) per working polynomial
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the random h, trace degree, gcd degree, and factor count.
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
const add = (a:Poly, b:Poly): Poly => {
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
    const task = (input as { polynomial?: number[]; degree?: number } | null) ?? {};
    let f: Poly = trim(task.polynomial ?? [1, 1, 1, 1, 1, 1, 1]);
    const d = typeof task.degree === "number" && task.degree >= 1 ? task.degree : 3;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells([deg(f), d], ["deg f", "d"]),
        edges: [],
        description: `Splitting a degree-${deg(f)} polynomial whose irreducible factors all have degree ${d}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, degree: deg(f), d },
    };
    step += 1;

    let seed = 12345;
    const nextRandom = (limit: number): number => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return (seed >>> 0) % limit;
    };

    const factors: Poly[] = [];
    const stack: Poly[] = [f];
    let attempts = 0;
    while (stack.length > 0) {
        const current = stack.pop()!;
        if (deg(current) <= d) {
            factors.push(current);
            continue;
        }
        let splitFound = false;
        for (let trial = 0; trial < 500; trial += 1) {
            attempts += 1;
            const h = Array(deg(current)).fill(0);
            let nonzero = false;
            for (let k = 0; k < h.length; k += 1) {
                h[k] = nextRandom(2);
                if (h[k]) nonzero = true;
            }
            if (!nonzero) continue;
            const T = trace(trim(h), d, current);
            const g = gcd(T, current);
            yield {
                stepNumber: step,
                entities: makeCells([deg(current), deg(T), deg(g), factors.length], ["deg f", "deg T", "deg gcd", "found"], 2),
                edges: [],
                description: `Split attempt ${attempts}: trace has degree ${deg(T)}, gcd has degree ${deg(g)}.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { step, attempts, traceDegree: deg(T), gcdDegree: deg(g) },
            };
            step += 1;
            if (deg(g) > 0 && deg(g) < deg(current)) {
                stack.push(g);
                stack.push(divmod(current, g)[0]);
                splitFound = true;
                break;
            }
        }
        if (!splitFound) factors.push(current);
    }

    const product = factors.reduce((acc, part) => mul(acc, part), [1]);
    yield {
        stepNumber: step,
        entities: makeCells(
            factors.map((part) => deg(part)),
            factors.map((part, i) => `factor ${i} deg ${deg(part)}`),
        ),
        edges: [],
        description: `Equal-degree factorization complete with ${factors.length} irreducible factor(s).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            step,
            factors: factors.map((part) => part.join(",")),
            count: factors.length,
            attempts,
            product: product.join(","),
            original: f.join(","),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When every irreducible factor has the same degree d, no gcd with x^(2^i)-x can tell them apart. Instead the algorithm uses randomness: for a random polynomial h it forms the trace h + h^2 + ... + h^(2^(d-1)) modulo f. That trace behaves like a random element of the ground field on each factor, so with good probability it vanishes on some factors but not others, and a gcd with f isolates a subset.",
        invariants: [
            "The input is a product of distinct irreducibles, all of degree d.",
            "The trace of an element of GF(2^d) lies in GF(2), so it is constant on each factor's root set.",
            "A successful gcd splits f into two smaller valid equal-degree polynomials.",
        ],
        correctness:
            "For an irreducible factor m of degree d, reduction modulo m maps h to a root in GF(2^d), and the trace of that root is zero or one. Since the trace is GF(2)-linear and h is chosen at random, it is zero on a given factor with probability about one half. The gcd of the trace polynomial with f therefore contains exactly those factors whose trace vanished; when it is a proper nonempty divisor it splits f. Recursion terminates because degree strictly decreases, and leaves only irreducible factors of degree d.",
        complexityRationale:
            "A constant number of random trials succeeds on average, and each trial computes about d squarings and a gcd on degree-n polynomials, costing O(n^2) field operations. Across the O(log n) levels of recursion the expected time is polynomial in n, and space is O(n) for the current polynomial.",
        uses: [
            "The randomized splitting phase of Cantor-Zassenhaus factorization",
            "Factoring polynomials over finite fields for coding theory",
            "Building irreducible-factor databases for finite-field arithmetic",
        ],
        references: [
            "Cantor and Zassenhaus, A New Algorithm for Factoring Polynomials over Finite Fields, 1981",
            "von zur Gathen and Gerhard, Modern Computer Algebra, Chapter 14",
        ],
        workedExample:
            "Let f = (x^3+x+1)(x^3+x^2+1) over GF(2), so d = 3. Picking h = x (coefficient mask 10 binary) gives trace h + h^2 + h^4 mod f of degree 4, whose gcd with f is x^3+x+1, one of the two cubic factors. Dividing it out leaves the other cubic, completing the split in a single successful trial.",
    },
    id: "equal-degree-factorization",
    name: "Equal-Degree Factorization",
    category: "math",
    complexity: { time: "O(n^2 log n) expected", space: "O(n)" },
    defaultInput: { polynomial: [1, 1, 1, 1, 1, 1, 1], degree: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "input a squarefree polynomial f with all factors of degree d",
        "place f on a work stack",
        "while the stack is nonempty",
        "pop a polynomial g; if deg(g) = d record it",
        "otherwise pick random h and form the trace sum",
        "compute gcd(trace, g) and split when it is proper",
        "push both pieces back onto the stack",
        "done: the irreducible factors",
    ],
};

export default module;
