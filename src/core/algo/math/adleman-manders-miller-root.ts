/**
 * adleman-manders-miller-root.ts - Adleman-Manders-Miller r-th Roots
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a prime p, a prime r dividing p-1, and an r-th power residue a mod p,
 * the Adleman-Manders-Miller algorithm finds x with x^r = a (mod p). It splits
 * p-1 = r^e * s, extracts the exponent of a inside the small r-Sylow subgroup
 * digit by digit (Pohlig-Hellman style), finds its component in the order-s
 * subgroup, and recombines the two with the Chinese remainder theorem.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(e * r * log p) group operations for small e and r
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show p-1 = r^e*s, the recovered r-adic digits, and x.
 *   - The final frame reports the root in meta.root.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function powMod(base: number, exp: number, mod: number): number {
    let r = 1;
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    while (e > 0) {
        if (e % 2 === 1) r = (r * b) % mod;
        b = (b * b) % mod;
        e = Math.floor(e / 2);
    }
    return r;
}

function egcd(a: number, b: number): { g: number; x: number; y: number } {
    if (b === 0) return { g: a, x: 1, y: 0 };
    const t = egcd(b, a % b);
    return { g: t.g, x: t.y, y: t.x - Math.trunc(a / b) * t.y };
}

function invMod(a: number, m: number): number {
    const { g, x } = egcd(((a % m) + m) % m, m);
    if (g !== 1) return 0;
    return ((x % m) + m) % m;
}

function distinctPrimeFactors(n: number): number[] {
    const factors: number[] = [];
    let m = n;
    for (let d = 2; d * d <= m; d += 1) {
        if (m % d === 0) {
            factors.push(d);
            while (m % d === 0) m /= d;
        }
    }
    if (m > 1) factors.push(m);
    return factors;
}

function primitiveRoot(p: number): number {
    const factors = distinctPrimeFactors(p - 1);
    for (let g = 2; g < p; g += 1) {
        if (factors.every((q) => powMod(g, (p - 1) / q, p) !== 1)) return g;
    }
    return 0;
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
    const task = (input as { a?: number; r?: number; p?: number } | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 41;
    const r = typeof task.r === "number" && task.r >= 2 ? task.r : 5;
    const p = typeof task.p === "number" && task.p > 2 ? task.p : 101;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells([a, r, p], [`a=${a}`, `r=${r}`, `p=${p}`]),
        edges: [],
        description: `Extracting an ${r}-th root of ${a} modulo the prime ${p}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;

    const av = ((a % p) + p) % p;
    if (av === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([0], ["0"]),
            edges: [],
            description: "Zero has root zero.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { step, root: 0 },
        };
        return;
    }
    if ((p - 1) % r !== 0 || powMod(av, (p - 1) / r, p) !== 1) {
        yield {
            stepNumber: step,
            entities: makeCells([av], ["a"]),
            edges: [],
            description: `${a} is not an ${r}-th power residue mod ${p}; no root exists.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { step, root: -1 },
        };
        return;
    }

    // p - 1 = r^e * s, r does not divide s.
    let e = 0;
    let s = p - 1;
    while (s % r === 0) {
        s /= r;
        e += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells([r, e, s, p - 1], ["r", "e", "s", "p-1"]),
        edges: [],
        description: `Factored p-1 = ${p - 1} = ${r}^${e} * ${s}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { step, r, e, s },
    };
    step += 1;

    const g = primitiveRoot(p);
    const rho = powMod(g, s, p); // order r^e
    const zeta = powMod(rho, r, p); // order r^(e-1)
    const c = powMod(av, s, p); // element of <zeta>

    // Pohlig-Hellman digits of k with zeta^k = c, k in [0, r^(e-1)).
    const digits: number[] = [];
    let kPartial = 0;
    let rPow = 1; // r^i
    const gamma = e >= 2 ? powMod(zeta, Math.pow(r, e - 2), p) : 1; // fixed order-r generator
    for (let i = 0; i <= e - 2; i += 1) {
        const exponent = Math.pow(r, e - 2 - i);
        const current = (c * invMod(powMod(zeta, kPartial, p), p)) % p;
        const value = powMod(current, exponent, p);
        let digit = 0;
        let acc = 1;
        for (let d = 0; d < r; d += 1) {
            if (acc === value) {
                digit = d;
                break;
            }
            acc = (acc * gamma) % p;
        }
        digits.push(digit);
        kPartial += digit * rPow;
        rPow *= r;
        yield {
            stepNumber: step,
            entities: makeCells([i, digit, kPartial], ["i", "digit", "k"], 1),
            edges: [],
            description: `r-Sylow digit ${i} of k is ${digit}; partial k = ${kPartial}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { step, digit, kPartial },
        };
        step += 1;
    }

    // Component in the order-s subgroup: j = log_{g^(r^e)}(a^(r^e)) mod s.
    const re = Math.pow(r, e);
    const eta = powMod(g, re, p);
    const target = powMod(av, re, p);
    let j = 0;
    let acc = 1;
    for (let d = 0; d < s; d += 1) {
        if (acc === target) {
            j = d;
            break;
        }
        acc = (acc * eta) % p;
    }
    yield {
        stepNumber: step,
        entities: makeCells([j, s], ["j", "s"], 0),
        edges: [],
        description: `Order-s component: a^(r^e) = (g^(r^e))^${j}, so j = ${j} mod ${s}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { step, j, s },
    };
    step += 1;

    // CRT: X = k mod r^(e-1) and X = j * r^{-1} mod s.
    const m1 = Math.pow(r, e - 1);
    const x1 = kPartial % m1;
    const x2 = (j * invMod(r % s, s)) % s;
    let X: number;
    if (m1 === 1) {
        X = x2;
    } else {
        const e1 = invMod(m1, s);
        const e2 = invMod(s, m1);
        X = (x1 * s * e2 + x2 * m1 * e1) % (m1 * s);
    }
    const root = powMod(g, X, p);
    const verified = powMod(root, r, p) === av;

    yield {
        stepNumber: step,
        entities: makeCells([root, verified ? 1 : 0], ["x", "verified"], 0),
        edges: [],
        description: `${root}^${r} mod ${p} = ${powMod(root, r, p)}; root ${verified ? "verified" : "not verified"}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { step, root, x: X, verified, digits, j },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Taking an r-th root modulo a prime is easy only when r does not divide p-1; otherwise the power map is many-to-one. AMM handles the hard case by splitting the multiplicative group into an r-primary part of order r^e and a coprime part of order s. It reads off the exponent of a in each part separately, then glues the two answers back together with the Chinese remainder theorem.",
        invariants: [
            "p-1 factors as r^e times s with r and s coprime.",
            "a is an r-th power residue exactly when a^((p-1)/r) = 1.",
            "The recovered exponent X satisfies r*X congruent to log_g(a) modulo p-1.",
        ],
        correctness:
            "Writing a = g^A for a primitive root g, an r-th root x = g^X exists exactly when rX = A mod (p-1). Modulo r^e this forces X = A/r mod r^(e-1), which the digit-by-digit subgroup log recovers; modulo s the inverse of r gives X = A*r^{-1} mod s. Because r^(e-1) and s are coprime, the Chinese remainder theorem produces the unique X mod (p-1)/r satisfying both, and then x = g^X obeys x^r = g^(rX) = g^A = a.",
        complexityRationale:
            "Finding the r-adic digits uses at most e-1 levels, each probing r candidates with a modular exponentiation, and the order-s search uses s probes; for the small subgroups of teaching inputs this is O(e*r*log p) plus O(s) and stays fast. Only constant working storage is needed.",
        uses: [
            "Extracting higher roots in finite-field arithmetic",
            "Decryption and key derivation in pairing-based cryptography",
            "Solving general power congruences modulo primes",
        ],
        references: [
            "Adleman, Manders and Miller, On Taking Roots in Finite Fields, 1977",
            "Cohen, A Course in Computational Algebraic Number Theory, Section 1.5",
        ],
        workedExample:
            "For p = 101, r = 5 and a = 41, note 41 = 3^5 mod 101. Here p-1 = 100 = 5^2 * 4, so e = 2 and s = 4. The algorithm reads one r-adic digit from the order-5 subgroup, finds the order-4 component j, recombines them by CRT modulo 20, and returns a value X with g^X = 3 (or another fifth root); raising that root to the fifth power returns 41.",
    },
    id: "adleman-manders-miller-root",
    name: "Adleman-Manders-Miller Root",
    category: "math",
    complexity: { time: "O(e*r*log p)", space: "O(1)" },
    defaultInput: { a: 41, r: 5, p: 101 },
    visualType: "grid",
    run,
    pseudocode: [
        "state residue a, prime r, and prime p",
        "reject non-residues using Euler's criterion",
        "factor p-1 = r^e * s with r not dividing s",
        "choose a primitive root g and set zeta = g^(r*s)",
        "read the r-adic digits of k from the r-Sylow subgroup",
        "find j = log of a^(r^e) in the order-s subgroup",
        "recombine k and j with the Chinese remainder theorem",
        "done: the root x = g^X",
    ],
};

export default module;
