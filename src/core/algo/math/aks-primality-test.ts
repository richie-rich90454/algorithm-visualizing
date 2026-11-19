/**
 * aks-primality-test.ts - The Agrawal-Kayal-Saxena Primality Test.
 *
 * A deterministic primality test based on the polynomial congruence
 * (x+a)^n = x^n + a modulo (x^r - 1, n). A small r is chosen so the order of
 * n modulo r is large; composites are then caught by a perfect-power check, a
 * gcd test, or a failing polynomial identity.
 *
 * Polynomial arithmetic uses coefficient arrays of length r.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function gcd(a: number, b: number): number {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { [a, b] = [b, a % b]; }
    return a;
}
function isPerfectPower(n: number): boolean {
    for (let b = 2; b <= Math.floor(Math.log2(n)) + 1; b += 1) {
        const a = Math.round(Math.pow(n, 1 / b));
        for (const cand of [a - 1, a, a + 1]) {
            if (cand >= 2 && Math.pow(cand, b) === n) return true;
        }
    }
    return false;
}
function order(n: number, r: number): number {
    if (gcd(n, r) !== 1) return -1;
    let x = 1 % r;
    for (let k = 1; k <= r; k += 1) { x = (x * n) % r; if (x === 1 % r) return k; }
    return -1;
}
function phi(r: number): number {
    let count = 0;
    for (let a = 1; a <= r; a += 1) if (gcd(a, r) === 1) count += 1;
    return count;
}
function polyMul(A: number[], B: number[], r: number, n: number): number[] {
    const C = new Array<number>(r).fill(0);
    for (let i = 0; i < r; i += 1) {
        if (!A[i]) continue;
        for (let j = 0; j < r; j += 1) {
            if (!B[j]) continue;
            C[(i + j) % r] = (C[(i + j) % r]! + A[i]! * B[j]!) % n;
        }
    }
    return C;
}
function polyPow(base: number[], exp: number, r: number, n: number): number[] {
    let result = new Array<number>(r).fill(0);
    result[0] = 1;
    while (exp > 0) {
        if (exp % 2 === 1) result = polyMul(result, base, r, n);
        base = polyMul(base, base, r, n);
        exp = Math.floor(exp / 2);
    }
    return result;
}
function congruenceHolds(a: number, n: number, r: number): boolean {
    const base = new Array<number>(r).fill(0);
    base[0] = a % n;
    base[1] = 1;
    const lhs = polyPow(base, n, r, n);
    const expected = new Array<number>(r).fill(0);
    expected[0] = a % n;
    expected[n % r] = (expected[n % r]! + 1) % n;
    return lhs.every((v, i) => v === expected[i]);
}
function panel(n: number, label: string, value: string, state: EntityState, line: number, description: string, meta: Record<string, number | string | boolean>): VisualFrame {
    return {
        stepNumber: 0,
        entities: [
            { id: "n", type: "cell", label: `n=${n}`, value: n, state: "active", x: 0, y: 0, width: 0, height: 0, metadata: { row: 0, col: 0 } },
            { id: "check", type: "cell", label: `${label}=${value}`, value, state, x: 0, y: 0, width: 0, height: 0, metadata: { row: 0, col: 1 } },
        ],
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta,
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(2, Math.trunc(task.n)) : 101;
    let step = 0;
    const emit = (frame: VisualFrame): VisualFrame => ({ ...frame, stepNumber: step++ });

    const small = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
    let prime: boolean | null = null;
    for (const p of small) {
        if (n === p) { prime = true; break; }
        if (n % p === 0) { prime = false; break; }
    }
    yield emit(panel(n, "verdict", prime === null ? "pending" : prime ? "prime" : "composite", prime === true ? "sorted" : prime === false ? "error" : "idle", 0,
        `Testing ${n}: small-prime trial division ${prime === null ? "found no small factor" : prime ? "matched a small prime" : "found a small factor"}.`, { n, verdict: prime ?? "pending" }));

    if (prime === null) {
        const power = isPerfectPower(n);
        yield emit(panel(n, "perfectPower", power ? "yes" : "no", power ? "error" : "sorted", 1,
            `Perfect-power check: ${n} is ${power ? "a perfect power, so composite" : "not a perfect power"}.`, { n, perfectPower: power }));
        if (power) prime = false;
    }

    let r = 2;
    let logSq = Math.log2(n) * Math.log2(n);
    if (prime === null) {
        while (true) {
            if (gcd(n, r) === 1 && order(n, r) > logSq) break;
            r += 1;
            if (r > n) { prime = true; break; }
        }
        yield emit(panel(n, "r", String(r), "active", 2,
            `Chosen r=${r} with multiplicative order of ${n} modulo r exceeding (log2 n)^2=${logSq.toFixed(1)}.`, { n, r, orderBound: logSq }));
    }

    if (prime === null) {
        if (n <= r) {
            prime = true;
        } else {
            const limit = Math.floor(Math.sqrt(phi(r)) * Math.log2(n));
            let failedA = 0;
            for (let a = 1; a <= limit; a += 1) {
                if (gcd(a, n) > 1) { failedA = a; prime = false; break; }
                if (!congruenceHolds(a, n, r)) { failedA = a; prime = false; break; }
            }
            yield emit(panel(n, "polynomial", failedA ? `failed a=${failedA}` : `passed a=1..${limit}`, failedA ? "error" : "sorted", 4,
                failedA
                    ? `Polynomial congruence failed at a=${failedA}, so ${n} is composite.`
                    : `All (x+a)^n identities held for a=1..${limit}, so ${n} is prime.`,
                { n, r, aLimit: limit, failedA }));
        }
    }
    if (prime === null) prime = true;

    yield emit(panel(n, "final", prime ? "prime" : "composite", prime ? "sorted" : "error", 5,
        `Done: ${n} is ${prime ? "prime" : "composite"}.`, { n, prime, r }));
}

const module: AlgorithmModule = {
    id: "aks-primality-test",
    name: "AKS Primality Test",
    category: "math",
    complexity: { time: "O(log^6 n)", space: "O(r log n)" },
    defaultInput: { n: 101 },
    visualType: "grid",
    run,
    pseudocode: [
        "if n < 2 return composite; check small prime divisors first",
        "if n is a perfect power return composite",
        "find smallest r with gcd(n,r)=1 and order of n mod r > (log n)^2",
        "if n <= r return prime",
        "for a = 1 to floor(sqrt(phi(r)) * log n)",
        "if gcd(a,n) > 1 or (x+a)^n != x^n + a mod (x^r-1,n) return composite",
        "done: return prime",
    ],
    education: {
        intuition:
            "AKS turns a primality question into a polynomial identity. For a prime n, raising x+a to the n-th power modulo n behaves exactly like raising a number to the n-th power. Verifying that identity in the small ring of polynomials modulo x^r-1 is enough to prove primality with no randomness.",
        invariants: [
            "The chosen r satisfies gcd(n,r)=1 and has a multiplicative order larger than (log n)^2.",
            "All polynomial coefficients are reduced modulo n at every multiplication.",
            "Working modulo x^r-1 means exponents are taken modulo r, so arrays of length r suffice.",
        ],
        correctness:
            "A prime n satisfies (x+a)^n = x^n + a in characteristic n by the freshman's dream. If n is composite and not a perfect power, a theorem guarantees some a in the tested range violates the congruence in Z[x]/(x^r-1,n), so passing every check certifies primality. Perfect powers and small prime divisors are handled separately.",
        complexityRationale:
            "The polynomial operations cost O(r^2 log n) with r bounded by a polynomial in log n, and the outer loop runs O(sqrt(r) log n) times, giving the classic O(log^6 n) bound. Storage is a handful of length-r coefficient arrays, O(r log n) bits.",
        uses: [
            "Deterministic primality proving without randomness",
            "Foundations for primality certificates in computer algebra systems",
            "A theoretical milestone showing primality is in polynomial time",
        ],
        references: [
            "Agrawal, Kayal, and Saxena, PRIMES is in P, Annals of Mathematics, 2004",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective",
        ],
        workedExample:
            "For n=101, small primes do not divide it and it is not a perfect power. The search finds a small r with large order, then (x+a)^101 equals x^101 + a modulo (x^r-1,101) for every tested a, so 101 is prime.",
    },
};

export default module;
