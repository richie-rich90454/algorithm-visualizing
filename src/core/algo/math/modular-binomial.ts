/**
 * modular-binomial.ts - Binomial Coefficients Modulo a Prime (Lucas Theorem).
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lucas' theorem computes C(n,k) modulo a prime p from the base-p digits of n
 * and k: the answer is the product over digit positions of C(n_i, k_i) mod p,
 * where a factor is zero whenever k_i exceeds n_i. Each small binomial is
 * evaluated with modular inverses through Fermat's little theorem.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log_p(n) * p) digit work for k of the smaller digit used
 *   Space: O(log_p(n)) for the digit arrays and displayed table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid lists each base-p digit position with n_i, k_i and C(n_i,k_i).
 *   - The running product is carried in the meta of each frame.
 *   - The final frame reports C(n,k) mod p.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ModularBinomialInput {
    n?: number;
    k?: number;
    p?: number;
}

function digits(value: number, base: number): number[] {
    if (value === 0) {
        return [0];
    }
    const result: number[] = [];
    let v = value;
    while (v > 0) {
        result.push(v % base);
        v = Math.floor(v / base);
    }
    return result;
}

function powMod(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    while (e > 0n) {
        if (e & 1n) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e >>= 1n;
    }
    return result;
}

/** Compute C(n,k) mod a prime p using Fermat inverses, with BigInt safety. */
function smallBinomial(n: number, k: number, p: bigint): number {
    if (k < 0 || k > n) {
        return 0;
    }
    let result = 1n;
    for (let j = 1; j <= k; j += 1) {
        const numerator = BigInt(n - k + j) % p;
        const denominator = BigInt(j) % p;
        result = (result * numerator) % p;
        result = (result * powMod(denominator, p - 2n, p)) % p;
    }
    return Number(result);
}

interface DigitRow {
    position: number;
    ni: number;
    ki: number;
    factor: number;
}

function makeEntities(rows: DigitRow[], done: boolean, shown: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < shown; i += 1) {
        const row = rows[i]!;
        const values: Array<[string, number]> = [
            ["i", row.position],
            ["n_i", row.ni],
            ["k_i", row.ki],
            ["C", row.factor],
        ];
        values.forEach(([name, value], col) => {
            entities.push({
                id: `cell-${i}-${col}`,
                type: "cell" as const,
                label: `${name}=${value}`,
                value,
                state: (done ? "sorted" : row.factor === 0 ? "error" : i === shown - 1 ? "highlight" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ModularBinomialInput | null) ?? {};
    const n = typeof task.n === "number" ? Math.trunc(task.n) : 100;
    const kInput = typeof task.k === "number" ? Math.trunc(task.k) : 50;
    const k = Math.min(Math.max(kInput, 0), n);
    const p = typeof task.p === "number" && task.p > 1 ? Math.trunc(task.p) : 1000000007;
    const pBig = BigInt(p);
    const nd = digits(n, p);
    const kd = digits(k, p);
    const length = Math.max(nd.length, kd.length);
    const rows: DigitRow[] = [];
    let product = 1;

    yield {
        stepNumber: 0,
        entities: [],
        edges: [],
        description: `Computing C(${n}, ${k}) mod ${p} from base-${p} digits.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: length, cols: 4, n, k, p, shown: 0 },
    };

    for (let i = 0; i < length; i += 1) {
        const ni = nd[i] ?? 0;
        const ki = kd[i] ?? 0;
        const factor = smallBinomial(ni, ki, pBig);
        product = Number((BigInt(product) * BigInt(factor)) % pBig);
        rows.push({ position: i, ni, ki, factor });
        yield {
            stepNumber: i + 1,
            entities: makeEntities(rows, false, rows.length),
            edges: [],
            description: `Digit ${i}: n_i=${ni}, k_i=${ki}, C(n_i,k_i) mod p = ${factor}; product ${product}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: length, cols: 4, n, k, p, shown: rows.length, product },
        };
    }

    yield {
        stepNumber: length + 1,
        entities: makeEntities(rows, true, rows.length),
        edges: [],
        description: `Done: by Lucas' theorem C(${n}, ${k}) mod ${p} = ${product}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: length, cols: 4, n, k, p, shown: rows.length, result: product },
    };
}

const module: AlgorithmModule = {
    id: "modular-binomial",
    name: "Modular Binomial (Lucas)",
    category: "math",
    complexity: { time: "O(log_p(n) * p)", space: "O(log_p(n))" },
    defaultInput: { n: 100, k: 50, p: 1000000007 },
    visualType: "grid",
    run,
    pseudocode: [
        "write n and k in base p as digit arrays",
        "start the product at one",
        "for each digit position i",
        "if k_i is greater than n_i set the factor to zero",
        "otherwise set the factor to C(n_i, k_i) modulo p",
        "multiply the factor into the product modulo p",
        "done: report the product as C(n,k) modulo p",
    ],
    education: {
        intuition:
            "Computing a huge binomial coefficient directly overflows, but only its residue modulo a prime p is often needed. Lucas' theorem says the answer factors digit by digit in base p: reduce n and k to their base-p digits, take the small binomial of each digit pair, and multiply the results modulo p.",
        invariants: [
            "The base-p digits of n and k determine the result entirely.",
            "If any digit k_i exceeds n_i the whole binomial is 0 modulo p.",
            "Each digit factor is C(n_i, k_i) computed modulo p.",
            "The running product is always reduced modulo p.",
        ],
        correctness:
            "Lucas' theorem states C(n,k) is congruent modulo p to the product over i of C(n_i,k_i), where n_i and k_i are base-p digits. This follows from the congruence (1+x)^p congruent to 1+x^p modulo p, which lets (1+x)^n factor into digit blocks. Computing each small C(n_i,k_i) with Fermat modular inverses is exact because p is prime and each denominator is nonzero modulo p.",
        complexityRationale:
            "There are O(log base p of n) digit positions, and each small binomial costs O(k_i) modular multiplications with a logarithmic-cost inverse, bounded by O(p) per digit. The digit arrays are the only stored structures, so space is O(log base p of n).",
        uses: [
            "Computing combinatorics values modulo a prime in contests",
            "Counting modulo p in dynamic-programming and generating-function problems",
            "Verifying identities in computational number theory",
        ],
        references: [
            "Lucas, Sur les congruences des nombres euleriens, 1878",
            "Wikipedia, Lucas' theorem",
        ],
        workedExample:
            "For n=100, k=50 and p=7 the base-7 digits of 100 are 2,0,2 and of 50 are 1,0,1, so the result is C(2,1)*C(0,0)*C(2,1)=2*1*2=4 modulo 7.",
    },
};

export default module;
