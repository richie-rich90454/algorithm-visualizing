/**
 * index-calculus-discrete-log.ts - Index Calculus for Discrete Logarithms
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Index calculus solves the discrete logarithm in the multiplicative group of
 * a prime field by working with a small factor base of primes. It collects
 * relations by expressing g^r as a product of factor-base primes, solves the
 * resulting linear system modulo p-1 for the logs of those primes, then
 * expresses h times a power of g as another smooth product to recover log_g(h).
 * It is subexponential, unlike the square-root methods.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(smoothness search + linear algebra) roughly L_p(1/2, c)
 *   Space: O(relations * factor base size)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows each collected relation as a row of factor exponents.
 *   - The row currently being reduced is YELLOW (comparing).
 *   - Successful relations are GREEN; the final frame reports log_g(h).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function egcd(a: number, b: number): { g: number; x: number; y: number } {
    if (b === 0) return { g: a, x: 1, y: 0 };
    const r = egcd(b, a % b);
    return { g: r.g, x: r.y, y: r.x - Math.trunc(a / b) * r.y };
}
function invMod(a: number, m: number): number {
    const v = ((a % m) + m) % m;
    const { g, x } = egcd(v, m);
    if (g !== 1) return 0;
    return ((x % m) + m) % m;
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
function modPow(a: number, e: number, m: number): number {
    let result = 1 % m;
    let base = ((a % m) + m) % m;
    let exp = e;
    while (exp > 0) {
        if (exp % 2 === 1) result = (result * base) % m;
        base = (base * base) % m;
        exp = Math.floor(exp / 2);
    }
    return result;
}
function primesUpTo(bound: number): number[] {
    const primes: number[] = [];
    for (let n = 2; n <= bound; n += 1) {
        let prime = true;
        for (let d = 2; d * d <= n; d += 1) {
            if (n % d === 0) {
                prime = false;
                break;
            }
        }
        if (prime) primes.push(n);
    }
    return primes;
}
function factorSmooth(value: number, fb: number[]): number[] | null {
    let rest = value;
    const exps = new Array<number>(fb.length).fill(0);
    for (let i = 0; i < fb.length; i += 1) {
        while (rest % fb[i]! === 0) {
            exps[i] = exps[i]! + 1;
            rest = Math.floor(rest / fb[i]!);
        }
    }
    return rest === 1 ? exps : null;
}

type Relation = { exps: number[]; r: number };

function primePowerFactors(M: number): Array<{ mod: number; q: number }> {
    const factors: Array<{ mod: number; q: number }> = [];
    let rest = M;
    for (let q = 2; q * q <= rest; q += 1) {
        if (rest % q === 0) {
            let mod = 1;
            while (rest % q === 0) {
                mod *= q;
                rest = Math.floor(rest / q);
            }
            factors.push({ mod, q });
        }
    }
    if (rest > 1) factors.push({ mod: rest, q: rest });
    return factors;
}

/** Solve the relations modulo a single prime power using unit pivots. */
function solveOverPrimePower(relations: Relation[], k: number, M: number, q: number): number[] | null {
    const A = relations.map((rel) => [...rel.exps, ((rel.r % M) + M) % M]);
    const pivots: Array<{ row: number; col: number }> = [];
    let pivotRow = 0;
    for (let col = 0; col < k && pivotRow < A.length; col += 1) {
        let found = -1;
        for (let i = pivotRow; i < A.length; i += 1) {
            const v = ((A[i]![col]! % M) + M) % M;
            if (v % q !== 0) {
                found = i;
                break;
            }
        }
        if (found < 0) continue;
        const tmp = A[found]!;
        A[found] = A[pivotRow]!;
        A[pivotRow] = tmp;
        const invp = invMod(A[pivotRow]![col]!, M);
        if (invp === 0) continue;
        for (let j = col; j <= k; j += 1) A[pivotRow]![j] = (A[pivotRow]![j]! * invp) % M;
        for (let i = 0; i < A.length; i += 1) {
            if (i === pivotRow) continue;
            const factor = ((A[i]![col]! % M) + M) % M;
            if (factor === 0) continue;
            for (let j = col; j <= k; j += 1) {
                A[i]![j] = (((A[i]![j]! - factor * A[pivotRow]![j]!) % M) + M) % M;
            }
        }
        pivots.push({ row: pivotRow, col });
        pivotRow += 1;
    }
    const logs = new Array<number>(k).fill(0);
    for (const { row, col } of pivots) logs[col] = A[row]![k]!;
    return logs;
}

/** Solve the relation system over Z_M by CRT over its prime-power factors. */
function solveRelations(relations: Relation[], k: number, M: number): number[] | null {
    const factors = primePowerFactors(M);
    const solutions = factors.map((f) => solveOverPrimePower(relations, k, f.mod, f.q));
    const logs = new Array<number>(k).fill(0);
    for (let i = 0; i < k; i += 1) {
        let x = 0;
        let prod = 1;
        for (let fi = 0; fi < factors.length; fi += 1) {
            const mod = factors[fi]!.mod;
            const value = solutions[fi]![i]! % mod;
            const diff = ((value - x) % mod + mod) % mod;
            const factorInv = invMod(prod % mod, mod);
            if (factorInv === 0) return null;
            const t = (diff * factorInv) % mod;
            x += prod * t;
            prod *= mod;
        }
        logs[i] = ((x % M) + M) % M;
    }
    for (const rel of relations) {
        let sum = 0;
        for (let i = 0; i < k; i += 1) sum += rel.exps[i]! * logs[i]!;
        if (((sum % M) + M) % M !== ((rel.r % M) + M) % M) return null;
    }
    return logs;
}

function makeCells(matrix: number[][], active: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < (matrix[r]?.length ?? 0); c += 1) {
            const value = matrix[r]![c]!;
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: r === active ? "comparing" as EntityState : "sorted" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, exponent: value },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p?: number; g?: number; h?: number; bound?: number } | null) ?? {};
    const p = Math.floor(typeof task.p === "number" ? task.p : 101);
    const g = Math.floor(typeof task.g === "number" ? task.g : 2);
    const h = Math.floor(typeof task.h === "number" ? task.h : 83);
    const bound = Math.floor(typeof task.bound === "number" ? task.bound : 13);
    const fb = primesUpTo(bound);
    const M = p - 1;
    let step = 0;

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `Setting up index calculus in the multiplicative group modulo ${p} with ${fb.length} factor-base primes.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { p, g, h, bound, factorBase: [...fb], log: 0, found: false, relations: 0 },
    };
    step += 1;

    const relations: Relation[] = [];
    for (let r = 1; r <= 5000 && relations.length < fb.length * 8; r += 1) {
        const value = modPow(g, r, p);
        const exps = factorSmooth(value, fb);
        if (!exps || exps.every((e) => e === 0)) continue;
        relations.push({ exps, r });
        if (step < 20) {
            yield {
                stepNumber: step,
                entities: makeCells([[...exps, r % M]], 0),
                edges: [],
                description: `Relation ${relations.length}: g^${r} = ${value} factors over the factor base.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { p, g, h, log: 0, found: false, relations: relations.length, r },
            };
            step += 1;
        }
    }

    const logs = solveRelations(relations, fb.length, M);
    if (logs === null) {
        yield {
            stepNumber: step,
            entities: makeCells(relations.slice(0, 12).map((rel) => [...rel.exps, rel.r % M]), -1),
            edges: [],
            description: "The collected relations did not yield a consistent linear solution.",
            codeLineNumber: 4,
            layout: "grid",
            meta: { p, g, h, log: 0, found: false, relations: relations.length },
        };
        return;
    }

    const matrix = relations.slice(0, 14).map((rel) => [...rel.exps, rel.r % M]);
    yield {
        stepNumber: step,
        entities: makeCells(matrix, -1),
        edges: [],
        description: `Solved ${relations.length} relations for the logarithms of the ${fb.length} factor-base primes.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: {
            p,
            g,
            h,
            log: 0,
            found: false,
            relations: relations.length,
            factorBaseLogs: logs.map((v) => `${v}`).join(";"),
        },
    };
    step += 1;

    let t = 0;
    let individual: number[] | null = null;
    for (; t < M && individual === null; t += 1) {
        const value = (h * modPow(g, t, p)) % p;
        individual = factorSmooth(value, fb);
    }
    if (individual === null) {
        yield {
            stepNumber: step,
            entities: makeCells(matrix, -1),
            edges: [],
            description: "No smooth multiple of h was found within the group order.",
            codeLineNumber: 5,
            layout: "grid",
            meta: { p, g, h, log: 0, found: false, relations: relations.length },
        };
        return;
    }
    t -= 1;
    let sum = 0;
    for (let i = 0; i < fb.length; i += 1) sum += individual[i]! * logs[i]!;
    const log = (((sum - t) % M) + M) % M;
    const verified = modPow(g, log, p) === ((h % p) + p) % p;

    yield {
        stepNumber: step,
        entities: makeCells([[...individual, t % M]], -1),
        edges: [],
        description: `Individual logarithm step: log_g(${h}) = ${log}${verified ? ", verified by modular exponentiation" : ""}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            p,
            g,
            h,
            log,
            verified,
            found: verified,
            individualExps: [...individual],
            multiplier: t,
            relations: relations.length,
            factorBase: [...fb],
            factorBaseLogs: logs.map((v) => `${v}`).join(";"),
        },
    };
}

/** The index-calculus discrete logarithm module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Brute-force discrete log walks the whole group, but index calculus uses the fact that many group elements factor over a small set of primes. Random powers of the generator that happen to be smooth give linear equations for the logarithms of those primes. Once those are known, multiplying the target by powers of the generator until it is smooth turns its logarithm into a simple sum, just like the earlier equations.",
        invariants: [
            "Every collected relation satisfies the sum of exponent times prime log congruent to the relation exponent modulo p-1.",
            "The factor base consists of small primes below the smoothness bound.",
            "All arithmetic on logarithms is performed modulo the group order p-1.",
            "The reported log satisfies g raised to the log congruent to the target modulo p.",
        ],
        correctness:
            "Because the factor-base primes generate a subgroup covering the smooth elements, a relation g^r equal to the product of primes to given powers implies the linear congruence sum e_i log_g(p_i) is congruent to r modulo p-1. Solving enough independent relations recovers each factor-base logarithm. For the target, once h times g^t is smooth, its logarithm is the sum of the corresponding prime logs, and subtracting t gives log_g(h). Every step is an identity in the group, so the final exponentiation check must succeed.",
        complexityRationale:
            "The dominant costs are finding smooth values, which takes subexponential L_p(1/2, c) time for a suitable bound, and solving a dense linear system over Z_{p-1}. The teaching implementation uses a naive direct solver so the number of relations and their size determine the running time.",
        uses: [
            "Attacking discrete-log-based cryptosystems over prime fields",
            "Computing logarithms in finite fields for number-theory experiments",
            "Teaching the difference between generic and index-calculus algorithms",
        ],
        references: [
            "Coppersmith, Odlyzko and Schroeppel, Discrete Logarithms in GF(p), 1984",
            "Menezes, Oorschot and Vanstone, Handbook of Applied Cryptography, Chapter 3",
        ],
        workedExample:
            "Modulo 101 with generator 2 and factor base primes up to 13, powers such as 2^7 = 128 = 27 mod 101 factor as 3^3, giving the equation 3*log(3) = 7 mod 100. Collecting similar relations for primes 2, 3, 5, 7, 11, 13 determines all six logs. If 83 times a small power of 2 factors over the base, its prime logs sum to the discrete log of 83, which can be checked by exponentiating 2 again.",
    },
    id: "index-calculus-discrete-log",
    name: "Index Calculus Discrete Log",
    category: "math",
    complexity: { time: "L_p(1/2, c)", space: "O(relations * base)" },
    defaultInput: { p: 101, g: 2, h: 83, bound: 13 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a smoothness bound and list the primes up to it",
        "for random exponents r factor g raised to r modulo p over the factor base",
        "record each successful factorization as a linear congruence modulo p-1",
        "solve the collected system for the logs of the factor-base primes",
        "multiply the target by powers of g until a smooth value is found",
        "sum the corresponding prime logs and subtract the multiplier",
        "done: return the discrete logarithm and verify by exponentiation",
    ],
};

export default module;
