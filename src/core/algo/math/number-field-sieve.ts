/**
 * number-field-sieve.ts - A Small Number Field Sieve.
 *
 * Selects the polynomial f(x) = x^2 + r with m = floor(sqrt(n)) and r = n - m^2,
 * so f(m) = n is zero modulo n. Relations pair a rational smooth value a - b*m
 * with a smooth algebraic norm a^2 + b^2*r in Z[x]/(f). A GF(2) dependency of
 * parity vectors yields a congruence of squares and a factor of n.
 *
 * Time subexponential for large n; this small demonstration uses bounded search.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function gcd(a: number, b: number): number {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { [a, b] = [b, a % b]; }
    return a;
}
function isqrt(x: number): number { return Math.floor(Math.sqrt(x)); }
function primesUpTo(bound: number): number[] {
    const sieve = new Array(bound + 1).fill(true);
    sieve[0] = sieve[1] = false;
    for (let i = 2; i * i <= bound; i += 1) if (sieve[i]) for (let j = i * i; j <= bound; j += i) sieve[j] = false;
    const primes: number[] = [];
    for (let i = 2; i <= bound; i += 1) if (sieve[i]) primes.push(i);
    return primes;
}
function smoothVector(value: number, primes: number[]): number[] | null {
    if (value === 0) return null;
    let rest = Math.abs(value);
    const vec = new Array(primes.length + 1).fill(0);
    if (value < 0) vec[0] = 1;
    for (let i = 0; i < primes.length; i += 1) {
        const p = primes[i]!;
        while (rest % p === 0) { vec[i + 1] ^= 1; rest /= p; }
    }
    return rest === 1 ? vec : null;
}
function cells(entries: Array<{ label: string; value: number | string }>, active: number): VisualEntity[] {
    return entries.map((entry, i) => ({
        id: `cell-${i}`,
        type: "cell",
        label: `${entry.label}=${entry.value}`,
        value: entry.value,
        state: (i === active ? "comparing" : i < active ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; B?: number; aMax?: number; bMax?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(15, Math.trunc(task.n)) : 253;
    const B = typeof task.B === "number" ? Math.max(5, Math.trunc(task.B)) : 40;
    const aMax = typeof task.aMax === "number" ? Math.max(50, Math.trunc(task.aMax)) : 6000;
    const bMax = typeof task.bMax === "number" ? Math.max(1, Math.trunc(task.bMax)) : 5;
    const m = Math.floor(Math.sqrt(n));
    const r = n - m * m;
    const primes = primesUpTo(B);
    const need = 2 * (primes.length + 1);
    let step = 0;

    yield {
        stepNumber: step++,
        entities: cells([{ label: "n", value: n }, { label: "m", value: m }, { label: "r", value: r }], 2),
        edges: [],
        description: `Polynomial f(x)=x^2+${r}; f(${m})=${n}=0 mod ${n}; factor base has ${primes.length} primes below ${B}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, B, m, r, need, primes: primes.slice() },
    };

    const relations: Array<{ a: number; b: number; rat: number[]; alg: number[]; norm: number }> = [];
    for (let b = 1; b <= bMax && relations.length <= need; b += 1) {
        for (let a = 1; a < aMax && relations.length <= need; a += 1) {
            if (gcd(a, b) !== 1) continue;
            const rational = smoothVector(a - b * m, primes);
            if (!rational) continue;
            const norm = a * a + b * b * r;
            const algebraic = smoothVector(norm, primes);
            if (!algebraic) continue;
            relations.push({ a, b, rat: rational, alg: algebraic, norm });
            if (relations.length <= 10) {
                yield {
                    stepNumber: step++,
                    entities: cells([{ label: "a,b", value: `${a},${b}` }, { label: "a-bm", value: a - b * m }, { label: "norm", value: norm }], 2),
                    edges: [],
                    description: `Relation (${a},${b}): rational ${a - b * m} and algebraic norm ${norm} are both ${B}-smooth.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: { n, B, a, b, rational: a - b * m, norm, relations: relations.length },
                };
            }
        }
    }

    let factor = 0;
    let X = 0;
    let N = 0;
    if (relations.length > need) {
        const rows = relations.map((rel, i) => ({ bits: rel.rat.concat(rel.alg), id: Math.pow(2, i) }));
        let pivotCol = 0;
        for (let c = 0; c < need && pivotCol < rows.length; c += 1) {
            let pivot = -1;
            for (let rr = pivotCol; rr < rows.length; rr += 1) if (rows[rr]!.bits[c]) { pivot = rr; break; }
            if (pivot === -1) continue;
            [rows[pivotCol], rows[pivot]] = [rows[pivot]!, rows[pivotCol]!];
            for (let rr = 0; rr < rows.length; rr += 1) {
                if (rr === pivotCol || !rows[rr]!.bits[c]) continue;
                for (let k = 0; k < need; k += 1) rows[rr]!.bits[k] ^= rows[pivotCol]!.bits[k]!;
                rows[rr]!.id ^= rows[pivotCol]!.id;
            }
            pivotCol += 1;
        }

        for (const row of rows) {
            if (!row.bits.every((v) => v === 0) || row.id === 0) continue;
            let rationalProduct = 1;
            let normProduct = 1;
            let A0 = 1, A1 = 0;
            for (let i = 0; i < relations.length; i += 1) {
                if (Math.floor(row.id / Math.pow(2, i)) % 2 !== 1) continue;
                const rel = relations[i]!;
                rationalProduct *= rel.a - rel.b * m;
                normProduct *= rel.norm;
                const c0 = A0 * rel.a + A1 * rel.b * r;
                const c1 = A1 * rel.a - A0 * rel.b;
                A0 = c0; A1 = c1;
            }
            const rational = Math.abs(rationalProduct);
            X = isqrt(rational);
            N = isqrt(normProduct);
            if (X * X !== rational || N * N !== normProduct) continue;
            const modn = (z: number) => ((z % n) + n) % n;
            for (const f of [gcd(X - N, n), gcd(X + N, n)]) {
                if (f > 1 && f < n) { factor = f; break; }
            }
            if (!factor) {
                for (const su of [1, -1]) for (const sv of [1, -1]) {
                    const u2 = su * (N + A0) / 2;
                    const v2 = sv * (N - A0) / 2;
                    if (u2 < 0 || v2 < 0 || !Number.isInteger(u2) || !Number.isInteger(v2)) continue;
                    const u = isqrt(u2), v = isqrt(v2);
                    if (u * u !== u2 || v * v !== v2 || 2 * u * v !== Math.abs(A1)) continue;
                    for (const phi of [modn(u + v * m), modn(-(u + v * m))]) {
                        for (const f of [gcd(X - phi, n), gcd(X + phi, n)]) {
                            if (f > 1 && f < n) { factor = f; break; }
                        }
                        if (factor) break;
                    }
                    if (factor) break;
                }
            }
            if (factor) break;
        }
    }

    yield {
        stepNumber: step++,
        entities: cells([{ label: "relations", value: relations.length }, { label: "X", value: X }, { label: "N", value: N }], 2),
        edges: [],
        description: `GF(2) dependency: ${relations.length} relations, rational square root X=${X}, norm square root N=${N}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { n, B, relations: relations.length, X, N },
    };
    yield {
        stepNumber: step,
        entities: cells([{ label: "n", value: n }, { label: "factor", value: factor }, { label: "cofactor", value: factor ? n / factor : 0 }], 2),
        edges: [],
        description: factor
            ? `Done: the congruence of squares gave factor ${factor}; ${n} = ${factor} * ${n / factor}.`
            : `Done: no factor found with B=${B}; increase the smoothness bound.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { n, B, m, r, factor, cofactor: factor ? n / factor : 0 },
    };
}

const module: AlgorithmModule = {
    id: "number-field-sieve",
    name: "Number Field Sieve",
    category: "math",
    complexity: { time: "L_n[1/3, (64/9)^(1/3)]", space: "O(B pi(B))" },
    defaultInput: { n: 253, B: 40, aMax: 6000, bMax: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose m = floor(sqrt(n)) and r = n - m^2, so f(x)=x^2+r has f(m)=0 mod n",
        "build a factor base of small primes",
        "collect coprime pairs (a,b) where a-b*m and norm a^2+b^2*r are both smooth",
        "record parity vectors for the rational and algebraic factorizations",
        "find a dependency over GF(2) so both products are squares",
        "compute square roots X and N and set factor <- gcd(X-N, n)",
        "done: return a nontrivial factor or increase the bound",
    ],
    education: {
        intuition:
            "Instead of one polynomial x^2-n, the number field sieve works in a ring where n has a known root, here x^2+r with root m. Smoothness is required on two sides at once: an ordinary integer a-b*m and an algebraic norm a^2+b^2*r. Combining dependencies on both sides produces a congruence of squares modulo n.",
        invariants: [
            "The polynomial satisfies f(m) = n, which is zero modulo n.",
            "Each relation uses coprime (a,b) and both smoothness tests pass.",
            "The parity dependency makes the rational product and algebraic norm perfect squares.",
        ],
        correctness:
            "The map sending x to m is a ring homomorphism from Z[x]/(f) to Z/nZ because f(m) is zero modulo n. A dependency gives a rational square X^2 and an algebraic square whose image modulo n is also X^2, producing a congruence of squares. If X is not congruent to the algebraic square root up to sign, their gcd with n is a proper factor.",
        complexityRationale:
            "For large n the polynomial degree and smoothness bound are optimized to give L_n[1/3,(64/9)^(1/3)] time, far faster than the quadratic sieve. This demonstration uses a fixed degree-two polynomial and bounded search, so its cost grows with the search ranges rather than reaching that asymptotic optimum.",
        uses: [
            "Factoring RSA moduli of hundreds of digits",
            "The general number field sieve is the fastest known classical factoring method",
            "A model for index calculus in algebraic number fields",
        ],
        references: [
            "Lenstra and Lenstra, The Development of the Number Field Sieve, 1993",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Chapter 8",
        ],
        workedExample:
            "For n=253, m=15 and r=28, so f(x)=x^2+28 and f(15)=253. Collecting coprime pairs whose rational part a-15b and norm a^2+28b^2 are both 40-smooth yields a dependency; the resulting congruence of squares gives gcd(X-N,253)=11, so 253=11*23.",
    },
};

export default module;
