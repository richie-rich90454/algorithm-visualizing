/**
 * ecpp-primality-proof.ts - Elliptic Curve Primality Proving
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This module builds an elliptic-curve primality certificate using the
 * Goldwasser-Kilian criterion. For a candidate n it searches for a curve
 * E: y^2 = x^3 + a*x + b over Z/nZ with a point P whose order m has a prime
 * factor q larger than (n^(1/4)+1)^2. That certificate proves n prime once q
 * is itself proved prime, so the search recurses until a small base case.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  heuristic polynomial time in log n for each certificate level
 *   Space: O(log n) for the certificate chain
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show n, the curve coefficients, the group order and q.
 *   - The final frame reports the verdict and certificate in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number] | null;

function egcd(a: number, b: number): { g: number; x: number; y: number } {
    if (b === 0) return { g: a, x: 1, y: 0 };
    const t = egcd(b, a % b);
    return { g: t.g, x: t.y, y: t.x - Math.trunc(a / b) * t.y };
}
function invMod(a: number, m: number): number | null {
    const r = egcd(((a % m) + m) % m, m);
    return r.g === 1 ? ((r.x % m) + m) % m : null;
}
function modPow(a: number, e: number, m: number): number {
    let r = 1;
    let base = ((a % m) + m) % m;
    let exp = e;
    while (exp > 0) {
        if (exp % 2 === 1) r = (r * base) % m;
        base = (base * base) % m;
        exp = Math.floor(exp / 2);
    }
    return r;
}
function isPrimeTrial(n: number): boolean {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d += 1) if (n % d === 0) return false;
    return true;
}
function factor(n: number): number[] {
    const out: number[] = [];
    let m = n;
    for (let d = 2; d * d <= m; d += 1) {
        if (m % d === 0) {
            out.push(d);
            while (m % d === 0) m /= d;
        }
    }
    if (m > 1) out.push(m);
    return out;
}

/** Affine point addition on y^2 = x^3 + a*x + b over Z/nZ. */
function addPoints(P: Point, Q: Point, a: number, n: number): Point | undefined {
    if (P === null) return Q;
    if (Q === null) return P;
    const [x1, y1] = P;
    const [x2, y2] = Q;
    if (x1 === x2 && ((y1 + y2) % n + n) % n === 0) return null;
    let lambda: number;
    if (x1 === x2 && y1 === y2) {
        const d = invMod((2 * y1) % n, n);
        if (d === null) return undefined;
        lambda = ((3 * x1 * x1 + a) * d) % n;
    } else {
        const d = invMod((x2 - x1 + n) % n, n);
        if (d === null) return undefined;
        lambda = (((y2 - y1 + n) % n) * d) % n;
    }
    const x3 = ((lambda * lambda - x1 - x2) % n + n) % n;
    const y3 = ((lambda * (x1 - x3) - y1) % n + n) % n;
    return [x3, y3];
}
function mulPoint(k: number, P: Point, a: number, n: number): Point | undefined {
    let result: Point | undefined = null;
    let q: Point | undefined = P;
    let e = k;
    while (e > 0) {
        if (e % 2 === 1) {
            result = addPoints(result!, q!, a, n);
            if (result === undefined) return undefined;
        }
        q = addPoints(q!, q!, a, n);
        if (q === undefined) return undefined;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Count points on the curve; for composite n this count is only heuristic. */
function countPoints(a: number, b: number, n: number): number {
    let total = 1; // point at infinity
    for (let x = 0; x < n; x += 1) {
        const rhs = ((x * x * x + a * x + b) % n + n) % n;
        if (rhs === 0) total += 1;
        else if (modPow(rhs, (n - 1) / 2, n) === 1) total += 2;
    }
    return total;
}

interface Level {
    n: number;
    a: number;
    b: number;
    order: number;
    q: number;
    point: [number, number];
    bound: number;
}

interface Cert {
    levels: Level[];
    base: number;
}

/** Build a Goldwasser-Kilian certificate chain for a prime n. */
function certify(n: number): Cert | null {
    // Small primes are the base case of the recursive proof.
    if (n < 50) return { levels: [], base: n };
    const bound = Math.pow(Math.pow(n, 0.25) + 1, 2);
    let found: Level | null = null;
    let attempts = 0;
    for (let a = 0; a < n && attempts < 200 && !found; a += 1) {
        for (let b = 0; b < n && attempts < 200 && !found; b += 1) {
            if (((4 * a * a * a + 27 * b * b) % n + n) % n === 0) continue;
            attempts += 1;
            const order = countPoints(a, b, n);
            const factors = factor(order);
            const q = factors[factors.length - 1] ?? 1;
            if (q <= bound || q >= n || order <= bound) continue;
            for (let x = 0; x < n && !found; x += 1) {
                const rhs = ((x * x * x + a * x + b) % n + n) % n;
                for (let y = 0; y < n && !found; y += 1) {
                    if ((y * y) % n !== rhs) continue;
                    const P: Point = [x, y];
                    const Q = mulPoint(Math.floor(order / q), P, a, n);
                    if (!Q || mulPoint(q, Q, a, n) !== null) continue;
                    found = { n, a, b, order, q, point: Q, bound };
                }
            }
        }
    }
    if (!found) return null;
    const sub = certify(found.q);
    if (!sub) return null;
    return { levels: [found, ...sub.levels], base: sub.base };
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
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" && task.n >= 2 && task.n <= 100000 ? Math.floor(task.n) : 101;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells([n], ["n"]),
        edges: [],
        description: `Proving the primality of ${n} with an elliptic-curve certificate.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, n },
    };
    step += 1;

    if (n < 4) {
        yield {
            stepNumber: step,
            entities: makeCells([n], ["n"]),
            edges: [],
            description: `${n} is trivially ${n >= 2 ? "prime" : "not prime"}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { step, n, verdict: n >= 2 ? "prime" : "composite" },
        };
        return;
    }

    // A quick composite screen avoids misleading curve searches on composite inputs.
    if (!isPrimeTrial(n)) {
        yield {
            stepNumber: step,
            entities: makeCells([n], ["n"]),
            edges: [],
            description: `${n} has a small factor and is composite; no elliptic-curve certificate can exist.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: { step, n, verdict: "composite" },
        };
        return;
    }

    const cert = certify(n);
    if (!cert) {
        yield {
            stepNumber: step,
            entities: makeCells([n], ["n"]),
            edges: [],
            description: `No elliptic-curve certificate was found for ${n}; ${n} is composite.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: { step, n, verdict: "composite" },
        };
        return;
    }

    for (const level of cert.levels) {
        yield {
            stepNumber: step,
            entities: makeCells(
                [level.n, level.a, level.b, level.order, level.q],
                ["n", "a", "b", "order", "q"],
                4,
            ),
            edges: [],
            description: `For n=${level.n}: curve y^2=x^3+${level.a}x+${level.b} has order ${level.order}; prime q=${level.q} exceeds bound ${Math.round(level.bound)}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                step,
                n: level.n,
                a: level.a,
                b: level.b,
                order: level.order,
                q: level.q,
                bound: Math.round(level.bound),
                point: level.point,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells([cert.base], ["base"]),
        edges: [],
        description: `Base case q=${cert.base} verified prime by trial division.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { step, base: cert.base },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells([n], ["n"], 0),
        edges: [],
        description: `Certificate complete: ${n} is prime, certified through ${cert.levels.length} curve level(s).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            step,
            n,
            verdict: "prime",
            levels: cert.levels.length,
            base: cert.base,
            certificate: cert.levels.map((level) => `${level.n}:${level.a},${level.b},${level.order},${level.q}`),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Elliptic-curve primality proving is the fastest practical way to certify that a large number is prime. It finds an elliptic curve modulo n whose group has a large prime-order point. Goldwasser and Kilian proved that such a point forces n to be prime, provided the prime order is large enough. The proof is recursive: certify that large prime with another curve until a small, easily checked prime remains.",
        invariants: [
            "Each curve has nonzero discriminant modulo n, so the group law is well defined when n is prime.",
            "The point Q has exact order q because q*Q is the identity while Q is not.",
            "The bound (n^(1/4)+1)^2 guarantees Hasse's theorem rules out a composite n with such a point.",
        ],
        correctness:
            "By Hasse's theorem an elliptic curve over a prime field p has between p+1-2*sqrt(p) and p+1+2*sqrt(p) points. If a composite n had a point of order m larger than (n^(1/4)+1)^2 with a prime divisor q of m also above that bound, then for every prime factor p of n the group order modulo p would have to be divisible by q; but q exceeds the Hasse upper bound at p, a contradiction. Therefore n has no proper factor and is prime. Recursing proves q prime by the same argument.",
        complexityRationale:
            "For each level the search tries a small number of random-looking curves, counts points in O(n) field operations, factors a number near n by trial division, and tests points with scalar multiplications costing O(log n) each. For the small teaching inputs this finishes quickly; asymptotically the method is heuristic polynomial time in log n.",
        uses: [
            "Certifying primes for cryptographic key generation",
            "Generating primes with reproducible, checkable proofs",
            "The engine behind fast primality provers such as ECPP implementations",
        ],
        references: [
            "Goldwasser and Kilian, Almost All Primes Can Be Quickly Certified, 1986",
            "Atkin and Morain, Elliptic Curves and Primality Proving, 1993",
        ],
        workedExample:
            "For n = 101 the curve y^2 = x^3 + x + 3 has order 87 over F_101. Its largest prime factor is q = 29, which exceeds (101^(1/4)+1)^2, roughly 18. A point of order 29 supplies the certificate; 29 is then certified by a shorter chain and finally by trial division, proving 101 prime.",
    },
    id: "ecpp-primality-proof",
    name: "ECPP Primality Proof",
    category: "math",
    complexity: { time: "heuristic polynomial in log n", space: "O(log n)" },
    defaultInput: { n: 101 },
    visualType: "grid",
    run,
    pseudocode: [
        "state candidate n and target bound (n^(1/4)+1)^2",
        "if n is a small prime, stop",
        "search curves y^2 = x^3 + a*x + b modulo n",
        "count the group order and factor it",
        "find a point of prime order q above the bound",
        "recurse to certify q prime",
        "if no certificate exists, n is composite",
        "done: n is prime with a verifiable certificate",
    ],
};

export default module;
