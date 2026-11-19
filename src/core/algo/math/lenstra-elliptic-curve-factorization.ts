/**
 * lenstra-elliptic-curve-factorization.ts - Lenstra Elliptic Curve Factorization.
 *
 * Stage one chooses an elliptic curve y^2 = x^3 + a*x + b modulo a composite n
 * and a point P on it, then computes k*P where k is the product of prime powers
 * up to a bound B1. When a denominator is not invertible modulo n, its gcd with
 * n is a nontrivial factor.
 *
 * Expected time subexponential in the size of the smallest factor.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = { x: number; y: number } | { inf: true } | { factor: number };

function egcd(a: number, b: number): [number, number, number] {
    if (b === 0) return [a, 1, 0];
    const [g, x1, y1] = egcd(b, a - Math.trunc(a / b) * b);
    return [g, y1, x1 - Math.trunc(a / b) * y1];
}
function invMod(a: number, m: number): number | null {
    const [g, x] = egcd(((a % m) + m) % m, m);
    return g === 1 ? ((x % m) + m) % m : null;
}
function gcd(a: number, b: number): number {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { [a, b] = [b, a % b]; }
    return a;
}
function add(P: { x: number; y: number }, Q: { x: number; y: number }, a: number, n: number): Point {
    if (P.x === Q.x && (P.y + Q.y) % n === 0) return { inf: true };
    let num: number, den: number;
    if (P.x === Q.x) {
        num = (3 * P.x * P.x + a) % n;
        den = (2 * P.y) % n;
    } else {
        num = (Q.y - P.y) % n;
        den = (Q.x - P.x) % n;
    }
    const g = gcd(den, n);
    if (g > 1 && g < n) return { factor: g };
    const inverse = invMod(den, n);
    if (inverse === null) return { inf: true };
    const lambda = (num * inverse) % n;
    const x3 = ((lambda * lambda - P.x - Q.x) % n + n) % n;
    const y3 = ((lambda * (P.x - x3) - P.y) % n + n) % n;
    return { x: x3, y: y3 };
}
function scalarMultiply(k: number, point: Point, a: number, n: number): Point {
    let result: Point = { inf: true };
    let base: Point = point;
    let remaining = k;
    while (remaining > 0) {
        if (remaining % 2 === 1) {
            if ("factor" in base) return base;
            if (!("inf" in base) && !("inf" in result)) result = add(result as { x: number; y: number }, base, a, n);
            if ("factor" in result) return result;
        }
        remaining = Math.floor(remaining / 2);
        if (remaining > 0) {
            if ("factor" in base) return base;
            if (!("inf" in base)) base = add(base, base, a, n);
            if ("factor" in base) return base;
        }
    }
    return result;
}
function primesUpTo(bound: number): number[] {
    const sieve = new Array(bound + 1).fill(true);
    sieve[0] = sieve[1] = false;
    for (let i = 2; i * i <= bound; i += 1) if (sieve[i]) for (let j = i * i; j <= bound; j += i) sieve[j] = false;
    const primes: number[] = [];
    for (let i = 2; i <= bound; i += 1) if (sieve[i]) primes.push(i);
    return primes;
}
function stageMultiplier(bound: number): number {
    let k = 1;
    for (const p of primesUpTo(bound)) {
        let power = 1;
        while (power * p <= bound) power *= p;
        k *= power;
    }
    return k;
}
function pointCells(P: Point, label: string, state: EntityState): VisualEntity[] {
    const value = "inf" in P ? "infinity" : "factor" in P ? `factor ${P.factor}` : `(${P.x},${P.y})`;
    const numeric = "factor" in P ? P.factor : "inf" in P ? 0 : P.x;
    return [
        { id: "point", type: "cell", label: `${label}=${value}`, value: numeric, state, x: 0, y: 0, width: 0, height: 0, metadata: { row: 0, col: 0 } },
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; a?: number; x?: number; y?: number; B1?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(9, Math.trunc(task.n)) : 455839;
    const a = typeof task.a === "number" ? Math.trunc(task.a) : 1;
    const px = typeof task.x === "number" ? Math.trunc(task.x) : 3;
    const py = typeof task.y === "number" ? Math.trunc(task.y) : 1;
    const B1 = typeof task.B1 === "number" ? Math.max(2, Math.trunc(task.B1)) : 10;
    const b = py * py - px * px * px - a * px;
    const k = stageMultiplier(B1);
    let step = 0;

    yield {
        stepNumber: step++,
        entities: pointCells({ x: px, y: py }, "P", "active"),
        edges: [],
        description: `Curve y^2 = x^3 + ${a}x + (${b}) mod ${n}; P=(${px},${py}), B1=${B1}, k=${k}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, a, b, B1, k, factor: 0 },
    };

    let accumulator: Point = { x: px, y: py };
    let factor = 0;
    let primeIndex = 0;
    for (const p of primesUpTo(B1)) {
        let power = 1;
        while (power * p <= B1) power *= p;
        accumulator = scalarMultiply(power, accumulator, a, n);
        if ("factor" in accumulator) { factor = accumulator.factor; break; }
        primeIndex += 1;
        yield {
            stepNumber: step++,
            entities: pointCells(accumulator, `p=${p}`, "comparing"),
            edges: [],
            description: `Multiplied the point by prime power ${power} for p=${p} (${primeIndex} primes processed); no factor yet.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n, B1, p, power, factor: 0 },
        };
    }
    if ("factor" in accumulator && factor === 0) factor = accumulator.factor;

    yield {
        stepNumber: step,
        entities: pointCells(factor ? { factor } : accumulator, "result", factor ? "sorted" : "idle"),
        edges: [],
        description: factor
            ? `Done: denominator gcd gave factor ${factor}; ${n} = ${factor} * ${n / factor}.`
            : `Done: no nontrivial factor found for B1=${B1}; increase the bound.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { n, a, b, B1, k, factor, cofactor: factor ? n / factor : 0 },
    };
}

const module: AlgorithmModule = {
    id: "lenstra-elliptic-curve-factorization",
    name: "Lenstra Elliptic Curve Factorization",
    category: "math",
    complexity: { time: "L_n[1/2, 1/2 + o(1)]", space: "O(log n)" },
    defaultInput: { n: 455839, a: 1, x: 3, y: 1, B1: 10 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose curve y^2 = x^3 + a*x + b mod n and point P on it",
        "let k be the product of prime powers up to the bound B1",
        "compute Q = k*P by repeated point addition and doubling",
        "when a denominator d has gcd(d,n) between 1 and n, that gcd is a factor",
        "otherwise increase B1 and try another curve",
        "done: report the nontrivial factor and its cofactor",
    ],
    education: {
        intuition:
            "Reducing an elliptic-curve group operation modulo n usually needs an inverse. When the denominator shares a factor with n, the inverse does not exist and the gcd exposes that factor. Multiplying a point by a highly composite k makes many denominators appear, so the chance of hitting a factor of the smallest prime divisor grows quickly.",
        invariants: [
            "The starting point satisfies the curve equation modulo n.",
            "Every accumulator position is a valid affine point or the point at infinity.",
            "A reported factor g satisfies 1 < g < n and divides n.",
        ],
        correctness:
            "For a prime divisor p of n, the curve reduced modulo p forms a group of order near p+1. If that order divides k, then k*P is the point at infinity modulo p, making a denominator divisible by p but usually not by the other factors of n. Taking the gcd therefore isolates p. Different curves give different group orders, so retrying eventually succeeds.",
        complexityRationale:
            "The work is dominated by B1-smooth exponentiation with O(B1 log B1) point operations, each costing a few modular multiplications. Optimizing B1 gives subexponential time in the smallest factor, with only O(log n) space for a few points and inverses.",
        uses: [
            "Factoring integers with moderately sized prime factors",
            "The elliptic-curve method stage of general number field sieve",
            "Finding small factors before heavier factorization attempts",
        ],
        references: [
            "Lenstra, Factoring Integers with Elliptic Curves, Annals of Mathematics, 1987",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Chapter 7",
        ],
        workedExample:
            "For n=455839 with curve y^2=x^3+x-29 and P=(3,1), multiplying by the prime powers up to 10 fails to invert a denominator whose gcd with n is 761, giving 455839 = 599 * 761.",
    },
};

export default module;
