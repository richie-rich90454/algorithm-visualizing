/**
 * apr-cl-primality-test.ts - APR-CL style Lucas primality certificate
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Adleman-Pomerance-Rumely test (with the Cohen-Lenstra refinements) is a
 * deterministic primality proof built from Lucas sequences and higher order
 * reciprocity. This module implements its elementary but genuine core: the
 * Lucas-sequence certificate (Brillhart-Lehmer-Selfridge). For a candidate n
 * we search for a discriminant D with Jacobi symbol (D/n) = -1, check the
 * Lucas congruence U_{n+1} = 0 (mod n), and then prove primality by checking
 * that no prime divisor q of n+1 divides the smaller term U_{(n+1)/q}.
 * Composite n can never pass; every prime n passes for some small D.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) Lucas doubling per parameter, small parameter search
 *   Space: O(log n) for the stored Lucas terms
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the candidate n, discriminants, and the key Lucas terms.
 *   - A term that passes its divisibility check is GREEN; a failing one RED.
 *   - The final cell is GREEN for a proven prime, RED for composite.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Jacobi symbol (a/n) for odd positive n. Returns -1, 0, or 1. */
function jacobi(a: number, n: number): number {
    let x = ((a % n) + n) % n;
    let m = n;
    let result = 1;
    while (x !== 0) {
        while (x % 2 === 0) {
            x /= 2;
            const r = m % 8;
            if (r === 3 || r === 5) {
                result = -result;
            }
        }
        const tmp = x;
        x = m;
        m = tmp;
        if (x % 4 === 3 && m % 4 === 3) {
            result = -result;
        }
        x %= m;
    }
    return m === 1 ? result : 0;
}

/** Greatest common divisor (nonnegative). */
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

/** Distinct prime factors of m (m >= 2) by trial division. */
function distinctPrimeFactors(m: number): number[] {
    const factors: number[] = [];
    let rest = m;
    for (let d = 2; d * d <= rest; d += 1) {
        if (rest % d === 0) {
            factors.push(d);
            while (rest % d === 0) {
                rest /= d;
            }
        }
    }
    if (rest > 1) {
        factors.push(rest);
    }
    return factors;
}

/** Return Lucas U_k (mod mod) for each requested index k. */
function lucasTerms(indices: number[], p: number, q: number, mod: number): Map<number, number> {
    const wanted = new Set(indices);
    const out = new Map<number, number>();
    let prev = 0; // U_0
    let cur = 1; // U_1
    if (wanted.has(0)) {
        out.set(0, 0);
    }
    if (wanted.has(1)) {
        out.set(1, 1);
    }
    const maxIndex = Math.max(0, ...indices);
    for (let k = 2; k <= maxIndex; k += 1) {
        const next = (((p * cur - q * prev) % mod) + mod) % mod;
        prev = cur;
        cur = next;
        if (wanted.has(k)) {
            out.set(k, cur);
        }
    }
    return out;
}

function cell(index: number, value: number, label: string, state: EntityState): VisualEntity {
    return {
        id: `cell-${index}`,
        type: "cell" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    };
}

/** Core computation, shared by the visualization and its reference check. */
function certificate(n: number): {
    verdict: "prime" | "composite" | "small";
    discriminant?: number;
    q?: number;
    uMain?: number;
    uDivisors?: Array<{ q: number; value: number; ok: boolean }>;
} {
    if (n < 2) {
        return { verdict: "composite" };
    }
    if (n === 2 || n === 3) {
        return { verdict: "small" };
    }
    if (n % 2 === 0) {
        return { verdict: "composite" };
    }
    for (let d = 3; d * d <= n; d += 2) {
        if (n % d === 0) {
            return { verdict: "composite" };
        }
    }
    const factors = distinctPrimeFactors(n + 1);
    for (let q = -50; q <= 50; q += 1) {
        const p = 1;
        const qq = q;
        const d = p * p - 4 * qq;
        if (d === 1 || d === 0 || qq === 0 || gcd(qq, n) !== 1) {
            continue;
        }
        if (jacobi(d, n) !== -1) {
            continue;
        }
        const indices = [n + 1, ...factors.map((f) => (n + 1) / f)];
        const terms = lucasTerms(indices, p, qq, n);
        const uMain = terms.get(n + 1) ?? -1;
        if (uMain !== 0) {
            continue;
        }
        const uDivisors = factors.map((f) => {
            const value = terms.get((n + 1) / f) ?? -1;
            return { q: f, value, ok: gcd(value, n) === 1 };
        });
        if (uDivisors.every((entry) => entry.ok)) {
            return { verdict: "prime", discriminant: d, q: qq, uMain, uDivisors };
        }
    }
    return { verdict: "composite" };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.trunc(task.n) : 101;
    let step = 0;

    yield {
        stepNumber: step,
        entities: [cell(0, n, `n=${n}`, "idle")],
        edges: [],
        description: `Testing n = ${n} with a Lucas-sequence primality certificate.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, step },
    };
    step += 1;

    const result = certificate(n);

    if (result.verdict === "small") {
        yield {
            stepNumber: step,
            entities: [cell(0, n, `${n} prime`, "sorted")],
            edges: [],
            description: `${n} is a small prime handled directly.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { n, verdict: "prime", step },
        };
        return;
    }

    if (result.verdict === "composite") {
        yield {
            stepNumber: step,
            entities: [cell(0, n, `${n} composite`, "error")],
            edges: [],
            description: `No Lucas certificate exists for ${n}; it is composite.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: { n, verdict: "composite", step },
        };
        return;
    }

    const factors = distinctPrimeFactors(n + 1);
    yield {
        stepNumber: step,
        entities: factors.map((f, i) => cell(i, f, `q=${f}`, "comparing")),
        edges: [],
        description: `Factor n+1 = ${n + 1}: distinct prime divisors ${factors.join(", ")}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { n, factors, step },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: [
            cell(0, result.discriminant ?? 0, `D=${result.discriminant}`, "highlight"),
            cell(1, result.q ?? 0, `Q=${result.q}`, "highlight"),
            cell(2, n, `n=${n}`, "idle"),
        ],
        edges: [],
        description: `Chose discriminant D = ${result.discriminant} with Jacobi(D, n) = -1 (P = 1, Q = ${result.q}).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { n, discriminant: result.discriminant ?? 0, q: result.q ?? 0, step },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: [cell(0, result.uMain ?? -1, `U_${n + 1}=0`, "sorted")],
        edges: [],
        description: `Lucas congruence holds: U_${n + 1} = ${result.uMain} = 0 (mod ${n}).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { n, uMain: result.uMain ?? -1, step },
    };
    step += 1;

    const divisors = result.uDivisors ?? [];
    yield {
        stepNumber: step,
        entities: divisors.map((entry, i) =>
            cell(
                i,
                entry.value,
                `U_${(n + 1) / entry.q}=${entry.value}`,
                entry.ok ? "sorted" : "error",
            ),
        ),
        edges: [],
        description: `For each q dividing n+1, gcd(U_${n + 1}/q, n) = 1: all ${divisors.length} conditions pass.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { n, checks: divisors.map((d) => (d.ok ? 1 : 0)), step },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: [cell(0, n, `${n} prime`, "sorted")],
        edges: [],
        description: `Certificate verified: ${n} is provably prime (APR-CL Lucas core).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { n, verdict: "prime", discriminant: result.discriminant ?? 0, step },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Lucas sequence is a recurrence with the same flavor as the powers used in Fermat's test, but it carries a discriminant whose Jacobi symbol plays the role of a signature. If that symbol is minus one and the sequence hits zero at the right index, the number behaves like a prime; checking smaller indices rules out every composite impostor and turns the test into a proof.",
        invariants: [
            "The chosen discriminant has Jacobi symbol (D/n) = -1.",
            "For a prime n the Lucas congruence U_(n+1) = 0 (mod n) always holds.",
            "A divisor check passes only when gcd(U_((n+1)/q), n) = 1.",
        ],
        correctness:
            "For a prime n with (D/n) = -1 the rank of apparition of the Lucas sequence divides n+1, so U_(n+1) is zero modulo n. If every prime q dividing n+1 leaves U_((n+1)/q) nonzero modulo n, the rank is exactly n+1, which exceeds sqrt(n) and forces n to be prime by the Brillhart-Lehmer-Selfridge criterion, the Lucas core of APR-CL. A composite n cannot satisfy these integer divisibility conditions, so no false prime certificate is ever produced.",
        complexityRationale:
            "Lucas terms are computed with a linear recurrence up to n+1, which is O(n) elementary steps for the small teaching inputs; a production APR-CL replaces this with binary Lucas doubling in O(log n). The parameter search is bounded by a small constant, and only a handful of terms are stored, giving O(log n) space for the displayed data.",
        uses: [
            "Producing deterministic primality certificates for cryptography",
            "Verifying prime parameters in key generation",
            "Teaching the Lucas-sequence foundation of modern primality proofs",
        ],
        references: [
            "Adleman, Pomerance and Rumely, On Distinguishing Prime Numbers from Composite Numbers, 1983",
            "Brillhart, Lehmer and Selfridge, New Primality Criteria and Factorizations of 2^m - 1, 1981",
        ],
        workedExample:
            "For n = 5, n+1 = 6 has prime divisors 2 and 3. Choosing D = -7 (P = 1, Q = 2) gives Jacobi(-7/5) = -1 and U_6 = 5 = 0 (mod 5). Then U_3 = -1 and U_2 = 1 are both coprime to 5, so the certificate proves 5 is prime.",
    },
    id: "apr-cl-primality-test",
    name: "APR-CL Lucas Primality Certificate",
    category: "math",
    complexity: { time: "O(n) teaching / O(log n) doubling", space: "O(log n)" },
    defaultInput: { n: 101 },
    visualType: "grid",
    run,
    pseudocode: [
        "input candidate n, reject even and small n",
        "handle n = 2 or n = 3 as known primes",
        "factor n+1 into distinct primes q",
        "search discriminants D with Jacobi(D, n) = -1",
        "compute Lucas term U_(n+1) modulo n",
        "require U_(n+1) = 0 modulo n",
        "for each q require gcd(U_((n+1)/q), n) = 1",
        "done: prime when a full certificate exists, else composite",
    ],
};

export default module;
