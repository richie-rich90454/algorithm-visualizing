/**
 * wiener-attack.ts - Wiener's small-private-exponent attack on toy RSA.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When the RSA private exponent d is smaller than about n^(1/4)/3, the ratio
 * e/n is a very close approximation of k/d. The continued fraction expansion
 * of e/n therefore lists d among its convergents. Each convergent is tested
 * by reconstructing phi, solving the quadratic x^2 - (n - phi + 1)x + n = 0
 * for the primes, and verifying the factorization.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log^2 n) big-integer operations
 *   Space: O(log n) for the continued fraction terms
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the denominators of the continued-fraction convergents.
 *   - The tested convergent is highlighted; a successful one turns green.
 *   - The final frame reports the recovered private exponent and primes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Convergent = { h: bigint; k: bigint };

function egcd(a: bigint, b: bigint): { g: bigint; x: bigint; y: bigint } {
    let oldR = a;
    let r = b;
    let oldS = 1n;
    let s = 0n;
    let oldT = 0n;
    let t = 1n;
    while (r !== 0n) {
        const q = oldR / r;
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
        [oldT, t] = [t, oldT - q * t];
    }
    return { g: oldR, x: oldS, y: oldT };
}

function modInverse(a: bigint, m: bigint): bigint {
    const { g, x } = egcd(((a % m) + m) % m, m);
    if (g !== 1n) throw new Error("value is not invertible");
    return ((x % m) + m) % m;
}

function isqrt(n: bigint): bigint {
    if (n < 0n) throw new Error("negative square root");
    let x = 1n;
    while (x * x <= n) x <<= 1n;
    let low = x >> 1n;
    let high = x;
    while (low + 1n < high) {
        const mid = (low + high) >> 1n;
        if (mid * mid <= n) low = mid;
        else high = mid;
    }
    return low;
}

function convergents(num: bigint, den: bigint): Convergent[] {
    const result: Convergent[] = [];
    let hPrev2 = 0n;
    let hPrev1 = 1n;
    let kPrev2 = 1n;
    let kPrev1 = 0n;
    let n = num;
    let d = den;
    let guard = 0;
    while (d !== 0n && guard < 200) {
        const a = n / d;
        const h = a * hPrev1 + hPrev2;
        const k = a * kPrev1 + kPrev2;
        result.push({ h, k });
        hPrev2 = hPrev1;
        hPrev1 = h;
        kPrev2 = kPrev1;
        kPrev1 = k;
        [n, d] = [d, n - a * d];
        guard += 1;
    }
    return result;
}

function tryConvergent(e: bigint, n: bigint, convergent: Convergent) {
    const { h, k } = convergent;
    if (k <= 0n || h <= 0n) return null;
    const ed1 = e * k - 1n;
    if (ed1 <= 0n || ed1 % h !== 0n) return null;
    const phi = ed1 / h;
    if (phi <= 0n || phi >= n) return null;
    const s = n - phi + 1n;
    const discriminant = s * s - 4n * n;
    if (discriminant < 0n) return null;
    const root = isqrt(discriminant);
    if (root * root !== discriminant) return null;
    const p = (s + root) / 2n;
    const q = (s - root) / 2n;
    if (p <= 1n || q <= 1n || p * q !== n) return null;
    const d = modInverse(e, phi);
    if ((e * d) % phi !== 1n) return null;
    return { d, p, q, phi };
}

function bars(candidates: Convergent[], activeIndex: number, success: boolean): VisualEntity[] {
    return candidates.map((c, index) => ({
        id: `conv-${index}`,
        type: "bar" as const,
        label: `k=${c.k.toString()}`,
        value: Number(c.k > 1_000_000n ? 1_000_000n : c.k),
        state: (activeIndex === index ? success ? "sorted" : "active" : "idle") as EntityState,
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, denominator: c.k.toString() },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p?: number; q?: number; d?: number } | null) ?? {};
    const p = BigInt(task.p ?? 10007);
    const q = BigInt(task.q ?? 20011);
    const d = BigInt(task.d ?? 13);
    const n = p * q;
    const phi = (p - 1n) * (q - 1n);
    const e = modInverse(d, phi);
    const candidates = convergents(e, n);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: bars(candidates, -1, false),
        edges: [],
        description: `Public key n has ${n.toString().length} digits; e was generated from a small private exponent.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: n.toString(), e: e.toString(), candidates: candidates.map((c) => c.k.toString()) },
    };

    let found: ReturnType<typeof tryConvergent> = null;
    let foundIndex = -1;
    for (let i = 0; i < candidates.length; i += 1) {
        const convergent = candidates[i];
        if (!convergent) continue;
        const result = tryConvergent(e, n, convergent);
        if (result && !found) {
            found = result;
            foundIndex = i;
        }
        yield {
            stepNumber: step++,
            entities: bars(candidates, i, Boolean(result)),
            edges: [],
            description: `Testing convergent ${i + 1}: k = ${convergent.k.toString()}${result ? " reconstructs the factorization" : " fails the phi test"}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                n: n.toString(),
                tested: convergent.k.toString(),
                success: Boolean(result),
                recoveredD: result ? result.d.toString() : "",
            },
        };
    }

    yield {
        stepNumber: step,
        entities: bars(candidates, foundIndex, Boolean(found)),
        edges: [],
        description: found
            ? `Recovered d = ${found.d.toString()} and factors ${found.p.toString()} times ${found.q.toString()}.`
            : "No convergent exposed a factorization for this key.",
        codeLineNumber: 7,
        layout: "array",
        meta: {
            n: n.toString(),
            e: e.toString(),
            recovered: Boolean(found),
            recoveredD: found ? found.d.toString() : "",
            p: found ? found.p.toString() : "",
            q: found ? found.q.toString() : "",
            phi: found ? found.phi.toString() : "",
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A very small private exponent forces e/n to approximate k/d extremely closely. Continued fractions find best rational approximations, so enumerating their convergents enumerates promising values of d; each one can be checked by trying to factor n.",
        invariants: [
            "The public exponent e is the inverse of d modulo phi.",
            "Each convergent h/k satisfies ed approximately equals kh + 1.",
            "A candidate is accepted only if it actually factors n.",
        ],
        correctness:
            "Wiener's bound guarantees that k/d appears among the convergents of e/n when d is below n^(1/4)/3. For the true convergent, (ed - 1)/k equals phi, and n - phi + 1 is the sum of the primes. The discriminant of the corresponding quadratic is (p - q)^2, so its square root recovers p and q exactly; the final factorization check rejects all spurious candidates.",
        complexityRationale:
            "The continued fraction expansion of a rational has O(log n) terms and each convergent test uses a constant number of big-integer multiplications and one square root, giving O(log^2 n) time and O(log n) space.",
        uses: [
            "Key-generation validation that rejects dangerously small private exponents",
            "Teaching the relationship between continued fractions and RSA security",
            "Cryptanalysis demonstrations on deliberately weakened toy keys",
        ],
        references: [
            "Wiener, Cryptanalysis of Short RSA Secret Exponents, 1990",
            "Boneh and Durfee, Cryptanalysis of RSA with Private Key d Less than N^0.292, 1999",
        ],
        workedExample:
            "With p = 10007, q = 20011 and d = 13, phi = (p-1)(q-1) and e is the inverse of 13 modulo phi. The continued fraction of e/n has a convergent with denominator 13; testing it reconstructs phi and the quadratic has discriminant (p - q)^2, yielding the two primes.",
    },
    id: "wiener-attack",
    name: "Wiener Small-d Attack",
    category: "math",
    complexity: { time: "O(log^2 n)", space: "O(log n)" },
    defaultInput: { p: 10007, q: 20011, d: 13 },
    visualType: "array",
    run,
    pseudocode: [
        "compute n := p times q and phi := (p-1)(q-1)",
        "set e := inverse of d modulo phi",
        "expand e/n as a continued fraction",
        "for each convergent h/k",
        "if k is positive and (e*k - 1) is divisible by h",
        "phi' := (e*k - 1)/h and s := n - phi' + 1",
        "if s^2 - 4n is a square, factor n and recover d",
        "report the recovered private exponent",
    ],
};

export default module;
