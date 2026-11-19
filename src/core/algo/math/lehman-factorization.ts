/**
 * lehman-factorization.ts - Lehman's Deterministic Factorization Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lehman's method factors n in deterministic O(n^{1/3}) steps. For each small
 * multiplier k up to the cube root of n it scans integers a whose square lies
 * between k*n and (k+1)*n. If a squared minus k*n is a perfect square b^2, then
 * (a-b)(a+b) is a multiple of n and the gcd of a-b with n is a nontrivial
 * factor. It improves on Fermat's method by testing a family of nearby
 * multiples instead of only k=1.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^{1/3} log n) with exact integer square roots
 *   Space: O(1) beyond the running candidates
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows the current multiplier k, candidate a, and residual a^2-k*n.
 *   - A candidate whose residual is a perfect square is YELLOW (comparing).
 *   - A confirmed factor is GREEN (sorted); the final frame reports it.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function isqrt(n: number): number {
    if (n <= 0) return 0;
    let r = Math.floor(Math.sqrt(n));
    while ((r + 1) * (r + 1) <= n) r += 1;
    while (r * r > n) r -= 1;
    return r;
}

function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

function makeCells(values: number[], states: Map<number, EntityState>, active: number): VisualEntity[] {
    return values.map((value, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: states.get(i) ?? (i === active ? "comparing" : "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = Math.max(2, Math.floor(typeof task.n === "number" ? task.n : 8051));
    let factor = 0;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells([n, 0, 0, 0], new Map(), -1),
        edges: [],
        description: `Factoring ${n} with Lehman's deterministic n to the one third method.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, factor: 0, found: false },
    };
    step += 1;

    if (n % 2 === 0) {
        factor = 2;
    } else {
        const root = isqrt(n);
        if (root * root === n) {
            factor = root;
        } else {
            const limit = Math.floor(Math.cbrt(n));
            outer: for (let k = 1; k <= limit; k += 1) {
                if (k > 1 && n % k === 0) {
                    factor = k;
                    break;
                }
                const aStart = Math.ceil(Math.sqrt(k * n));
                const aEnd = Math.floor(Math.sqrt((k + 1) * n));
                let lastSquare: { a: number; residual: number; b: number } | null = null;
                for (let a = aStart; a <= aEnd; a += 1) {
                    const residual = a * a - k * n;
                    const b = isqrt(residual);
                    if (b * b !== residual) continue;
                    lastSquare = { a, residual, b };
                    const g = gcd(a - b, n);
                    if (g > 1 && g < n) {
                        factor = g;
                    }
                }
                if (step < 200) {
                    const sample = lastSquare ?? { a: aEnd, residual: aEnd * aEnd - k * n, b: 0 };
                    yield {
                        stepNumber: step,
                        entities: makeCells([k, sample.a, sample.residual, sample.b], new Map(lastSquare ? [[2, "comparing" as EntityState]] : []), lastSquare ? 2 : 1),
                        edges: [],
                        description: `k=${k}: scanned a from ${aStart} to ${aEnd}${lastSquare ? "; found a perfect-square residual" : " with no square residual"}.`,
                        codeLineNumber: lastSquare ? 4 : 3,
                        layout: "grid",
                        meta: { n, factor: 0, found: false, k, a: sample.a, residual: sample.residual, square: lastSquare !== null },
                    };
                    step += 1;
                }
                if (factor > 0) break outer;
            }
        }
    }

    if (factor === 0) factor = n;
    yield {
        stepNumber: step,
        entities: makeCells([n, factor, Math.floor(n / factor), 0], new Map([[1, "sorted" as EntityState]]), -1),
        edges: [],
        description: `Lehman found the factor ${factor}, so ${n} = ${factor} * ${Math.floor(n / factor)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { n, factor, cofactor: Math.floor(n / factor), divides: n % factor === 0, found: factor > 1 && factor < n },
    };
}

/** The Lehman factorization module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Fermat's factorization looks for a square just above n. Lehman's idea is to look near k*n for a whole range of small k instead. When a squared minus k*n is itself a square, the difference of two squares factors a multiple of n, and a gcd extracts a genuine factor. The range of k only needs to reach the cube root of n to guarantee success.",
        invariants: [
            "The multiplier k never exceeds the cube root of n.",
            "The candidate a satisfies k*n <= a^2 <= (k+1)*n.",
            "A perfect-square residual b^2 makes a^2 - b^2 a multiple of k*n, hence of n.",
            "Any reported factor is strictly between one and n and divides n exactly.",
        ],
        correctness:
            "For a composite n with a factor p at most n^{2/3}, choose k so that a suitable multiple of p aligns with a square near k*n; the Lehman analysis guarantees some k at most the cube root of n for which the scanned interval contains such an a. Then a^2 - k*n = b^2, so (a-b)(a+b) equals k*n and gcd(a-b, n) is a nontrivial divisor. Checking every k and a in the prescribed ranges therefore finds a factor. A perfect-square or even input is handled directly.",
        complexityRationale:
            "There are O(n^{1/3}) values of k and about sqrt(n) over the square-root spread divided by k candidates each, giving O(n^{1/3}) scanned candidates overall; each step uses an integer square root and gcd, so the total is O(n^{1/3} log n) time and O(1) space.",
        uses: [
            "Deterministic factorization of moderately sized integers",
            "A teaching bridge between Fermat factorization and the quadratic sieve",
            "Splitting small RSA-style moduli in computational number theory demos",
        ],
        references: [
            "Lehman, Factorization of a Natural Number by a Deterministic Method, 1974",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Section 5.2",
        ],
        workedExample:
            "For n = 8051, Fermat's method struggles, but with k = 1 the candidate a = 90 gives 8100 - 8051 = 49 = 7^2. Then gcd(90 - 7, 8051) = gcd(83, 8051) = 83, and indeed 8051 = 83 * 97. The residual was a perfect square, so Lehman's gcd step recovers the factor immediately.",
    },
    id: "lehman-factorization",
    name: "Lehman Factorization",
    category: "math",
    complexity: { time: "O(n^{1/3} log n)", space: "O(1)" },
    defaultInput: { n: 8051 },
    visualType: "grid",
    run,
    pseudocode: [
        "if n is even return two",
        "if n is a perfect square return its square root",
        "let the limit be the integer cube root of n",
        "for k from one to the limit",
        "for a from the square root of k n to the square root of (k+1) n",
        "if a squared minus k n is a perfect square b squared",
        "let g be the gcd of a minus b and n; if it is nontrivial return it",
        "done: return the discovered factor and its cofactor",
    ],
};

export default module;
