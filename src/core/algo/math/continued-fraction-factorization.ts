/**
 * continued-fraction-factorization.ts - Continued Fraction Factorization (CFRAC)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CFRAC factors an integer n by walking the continued fraction expansion of
 * sqrt(n). Each convergent p/q satisfies p^2 - n*q^2 = d for a small value d,
 * so p^2 is congruent to plus or minus d modulo n. When d is smooth over a
 * chosen factor base, the convergent supplies a relation. Combining relations
 * whose exponents are all even (and whose signs cancel) gives a congruence of
 * squares, and gcd splits n.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((L + r) * L) for L base primes and r convergents tested
 *   Space: O(L * r) for the relation matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Factor-base primes are cells; used ones light up SORTED.
 *   - Each smooth convergent is reported with its residue and exponent vector.
 *   - The final cell holds the discovered nontrivial factor.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** gcd of two nonnegative integers. */
function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const r = x % y;
        x = y;
        y = r;
    }
    return x;
}

/** Modular exponentiation for small safe integers. */
function powMod(base: number, exp: number, mod: number): number {
    let result = 1;
    let b = base % mod;
    let e = exp;
    while (e > 0) {
        if (e % 2 === 1) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Primes up to a bound. */
function primesUpTo(bound: number): number[] {
    const result: number[] = [];
    for (let p = 2; p <= bound; p += 1) {
        let prime = true;
        for (let d = 2; d * d <= p; d += 1) {
            if (p % d === 0) {
                prime = false;
                break;
            }
        }
        if (prime) {
            result.push(p);
        }
    }
    return result;
}

/** A CFRAC relation: convergent p and the exponents of its smooth residue. */
interface Relation {
    p: number;
    exponents: number[];
    sign: number;
}

/** Factor a positive value over the base, returning exponents or null. */
function factorOverBase(value: number, base: number[]): number[] | null {
    let rest = value;
    const exponents = new Array<number>(base.length).fill(0);
    for (let i = 0; i < base.length; i += 1) {
        const p = base[i] as number;
        while (rest % p === 0) {
            exponents[i] = (exponents[i] as number) + 1;
            rest = Math.floor(rest / p);
        }
    }
    return rest === 1 ? exponents : null;
}

/** Find all dependencies whose exponent and sign parities all cancel. */
function dependencies(relations: Relation[], baseSize: number): number[][] {
    const cols = baseSize + 1;
    const rows = relations.map((rel, index) => {
        const vec = new Array<number>(cols + relations.length).fill(0);
        for (let j = 0; j < baseSize; j += 1) {
            vec[j] = (rel.exponents[j] as number) % 2;
        }
        vec[baseSize] = rel.sign < 0 ? 1 : 0;
        vec[cols + index] = 1;
        return vec;
    });
    let pivotRow = 0;
    for (let col = 0; col < cols && pivotRow < rows.length; col += 1) {
        let pivot = -1;
        for (let i = pivotRow; i < rows.length; i += 1) {
            if (rows[i]?.[col] === 1) {
                pivot = i;
                break;
            }
        }
        if (pivot < 0) {
            continue;
        }
        const tmp = rows[pivotRow];
        rows[pivotRow] = rows[pivot] as number[];
        rows[pivot] = tmp as number[];
        for (let i = 0; i < rows.length; i += 1) {
            if (i !== pivotRow && rows[i]?.[col] === 1) {
                for (let k = 0; k < rows[i]!.length; k += 1) {
                    rows[i]![k] = (rows[i]![k] as number) ^ (rows[pivotRow]![k] as number);
                }
            }
        }
        pivotRow += 1;
    }
    const result: number[][] = [];
    for (const vec of rows) {
        if (vec.slice(0, cols).every((v) => v === 0)) {
            const subset: number[] = [];
            for (let i = 0; i < relations.length; i += 1) {
                if (vec[cols + i] === 1) {
                    subset.push(i);
                }
            }
            if (subset.length > 0) {
                result.push(subset);
            }
        }
    }
    return result;
}

/** Build factor-base cells for a frame. */
function makeCells(base: number[], exponents: number[], factor = 0): VisualEntity[] {
    const cols = 10;
    const cells = base.map((p, index) => {
        const e = exponents[index] ?? 0;
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: e > 0 ? `${p}^${e}` : String(p),
            value: e,
            state: (e > 0 ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: Math.floor(index / cols), col: index % cols, prime: p },
        };
    });
    cells.push({
        id: "factor-cell",
        type: "cell" as const,
        label: factor > 0 ? `f=${factor}` : "f=?",
        value: factor,
        state: factor > 0 ? "highlight" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(base.length / cols), col: base.length % cols, prime: 0 },
    });
    return cells;
}

/** The CFRAC generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; bound?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.trunc(task.n) : 8051;
    const bound = typeof task.bound === "number" ? Math.trunc(task.bound) : 40;
    const base = primesUpTo(Math.max(3, bound));
    let step = 0;

    if (!Number.isFinite(n) || n < 4) {
        yield {
            stepNumber: 0,
            entities: makeCells(base, [], 0),
            edges: [],
            description: "CFRAC needs a composite n >= 4.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { n, factor: 0, base },
        };
        return;
    }
    if (n % 2 === 0) {
        yield {
            stepNumber: 0,
            entities: makeCells(base, [], 2),
            edges: [],
            description: `${n} is even, so 2 is a nontrivial factor.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: { n, factor: 2, base },
        };
        return;
    }

    const a0 = Math.floor(Math.sqrt(n));
    if (a0 * a0 === n) {
        yield {
            stepNumber: 0,
            entities: makeCells(base, [], a0),
            edges: [],
            description: `${n} is a perfect square with factor ${a0}.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: { n, factor: a0, base },
        };
        return;
    }

    yield {
        stepNumber: step,
        entities: makeCells(base, [], 0),
        edges: [],
        description: `Factor ${n} via convergents of sqrt(${n}); factor base [${base.join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, factor: 0, base, relations: 0 },
    };
    step += 1;

    // Continued fraction recurrence for sqrt(n).
    const relations: Relation[] = [];
    const needed = base.length * 2 + 2;
    let m = 0;
    let d = 1;
    let a = a0;
    let pModPrev2 = 0;
    let pModPrev1 = 1 % n;

    for (let i = 0; i < 100000 && relations.length < needed; i += 1) {
        // Maintain the convergent modulo n so large convergents never overflow.
        const pCurrent = (a * pModPrev1 + pModPrev2) % n;
        pModPrev2 = pModPrev1;
        pModPrev1 = pCurrent;

        // Advance the continued fraction one step.
        const mNext = d * a - m;
        const dNext = Math.floor((n - mNext * mNext) / d);
        if (dNext <= 0) {
            break;
        }
        const aNext = Math.floor((a0 + mNext) / dNext);

        // p^2 mod n equals plus or minus a smooth candidate.
        const residue = (pCurrent * pCurrent) % n;
        let exponents = factorOverBase(residue, base);
        let sign = 1;
        if (!exponents) {
            exponents = factorOverBase(n - residue, base);
            sign = -1;
        }
        if (exponents && exponents.some((e) => e > 0)) {
            relations.push({ p: pCurrent, exponents, sign });
            yield {
                stepNumber: step,
                entities: makeCells(base, exponents, 0),
                edges: [],
                description:
                    `Convergent ${i}: p=${pCurrent}, p squared mod ${n} = ${sign > 0 ? "" : "-"}${sign > 0 ? residue : n - residue}, smooth over the base.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { n, factor: 0, base, relations: relations.length, p: pCurrent, sign },
            };
            step += 1;
        }

        m = mNext;
        d = dNext;
        a = aNext;
    }

    let factor = 0;
    if (relations.length > base.length) {
        for (const subset of dependencies(relations, base.length)) {
            const totals = new Array<number>(base.length).fill(0);
            let productX = 1;
            for (const idx of subset) {
                const rel = relations[idx];
                if (!rel) {
                    continue;
                }
                productX = (productX * (rel.p % n)) % n;
                for (let j = 0; j < base.length; j += 1) {
                    totals[j] = (totals[j] as number) + (rel.exponents[j] as number);
                }
            }
            let productY = 1;
            for (let j = 0; j < base.length; j += 1) {
                const half = Math.floor((totals[j] as number) / 2);
                if (half > 0) {
                    productY = (productY * powMod(base[j] as number, half, n)) % n;
                }
            }
            let g = gcd(productX - productY, n);
            if (g === 1 || g === n) {
                g = gcd(productX + productY, n);
            }
            if (g > 1 && g < n) {
                factor = g;
                break;
            }
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(base, [], factor),
        edges: [],
        description:
            factor > 0
                ? `Congruence of squares gives ${n} = ${factor} * ${n / factor}.`
                : `No split found for ${n}; it may be prime or need a larger base.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { n, factor, base, relations: relations.length },
    };
}

/** The CFRAC module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The continued fraction expansion of the square root of n produces convergents p/q for which p squared differs from n times q squared by a surprisingly small amount. Reducing that identity modulo n means p squared is congruent to a small number, and if that small number factors over a prime base the convergent becomes a relation. Enough relations combine into a congruence of squares that gcd turns into a factor.",
        invariants: [
            "Each convergent p/q satisfies p squared minus n times q squared equal to plus or minus a small d value.",
            "Every accepted relation stores the sign and the prime exponents of the small residue.",
            "A dependency has even exponent for every base prime and an even number of negative signs.",
        ],
        correctness:
            "The continued fraction recurrence guarantees p squared is congruent to a small value modulo n, so a relation is a genuine congruence. When a subset has even exponents in every prime and an even number of negative signs, the product of the p values squared is congruent to a perfect square Y squared. If X differs from plus or minus Y modulo n, gcd(X - Y, n) is a proper divisor of n.",
        complexityRationale:
            "Testing each convergent factors a small residue by dividing by the L base primes, costing O(L) per relation; Gaussian elimination on an r by L binary matrix costs O(r * L). With r relations the total is O((L + r) * L) time and O(L * r) space for the matrix.",
        uses: [
            "Factoring integers with the quadratic sieve's historical predecessor",
            "Demonstrating continued fractions in an algorithmic setting",
            "Producing congruences of squares for general-number-field methods",
        ],
        references: [
            "Morrison and Brillhart, A Method of Factoring and the Factorization of F7, 1975",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Chapter 6",
        ],
        workedExample:
            "For n = 8051 the convergents of sqrt(8051) begin 90/1, 181/2, 452/5. The first gives 90 squared minus 8051 = 49 = 7 squared, so 90 squared is congruent to 49 modulo 8051. Combining such relations into an even-exponent subset yields a congruence of squares whose gcd reveals 83 or 97.",
    },
    id: "continued-fraction-factorization",
    name: "Continued Fraction Factorization (CFRAC)",
    category: "math",
    complexity: { time: "O((L + r) * L)", space: "O(L * r)" },
    defaultInput: { n: 8051, bound: 40 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a factor base of small primes",
        "start the sqrt(n) continued fraction recurrence",
        "form each convergent p from the recurrence",
        "reduce p squared mod n and try to factor the small residue",
        "record smooth residues with their exponent parity and sign",
        "combine relations whose parities cancel into a congruence of squares",
        "done: gcd(X - Y, n) gives a nontrivial factor",
    ],
};

export default module;
