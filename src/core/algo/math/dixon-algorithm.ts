/**
 * dixon-algorithm.ts - Dixon's Random Squares Factorization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dixon's algorithm looks for a congruence x^2 = y^2 (mod n) by collecting
 * relations whose residue x^2 mod n is smooth over a small factor base. Each
 * relation contributes a parity vector of prime exponents. Once more vectors
 * than factor-base primes exist, linear algebra over GF(2) finds a subset
 * whose exponents are all even; that subset multiplies into a square on both
 * sides, and gcd(x - y, n) splits n.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  L^3 Gaussian elimination plus L^2 smoothing attempts for base size L
 *   Space: O(L^2) for the relation matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Factor-base primes are cells; used primes light up SORTED.
 *   - Each smooth relation is shown with its exponent pattern.
 *   - The final cell reports the nontrivial gcd factor.
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

/** One collected smooth relation. */
interface Relation {
    x: number;
    exponents: number[];
}

/** Try to factor q fully over the factor base. */
function factorOverBase(qValue: number, base: number[]): number[] | null {
    let value = qValue;
    const exponents = new Array<number>(base.length).fill(0);
    for (let i = 0; i < base.length; i += 1) {
        const p = base[i] as number;
        while (value % p === 0) {
            exponents[i] = (exponents[i] as number) + 1;
            value = Math.floor(value / p);
        }
    }
    return value === 1 ? exponents : null;
}

/** Find all subsets of rows whose parity vectors XOR to zero. */
function dependencies(relations: Relation[], baseSize: number): number[][] {
    const rows = relations.map((rel, index) => {
        const vec = new Array<number>(baseSize + relations.length).fill(0);
        for (let j = 0; j < baseSize; j += 1) {
            vec[j] = (rel.exponents[j] as number) % 2;
        }
        vec[baseSize + index] = 1;
        return vec;
    });
    let pivotRow = 0;
    for (let col = 0; col < baseSize && pivotRow < rows.length; col += 1) {
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
        if (vec.slice(0, baseSize).every((v) => v === 0)) {
            const subset: number[] = [];
            for (let i = 0; i < relations.length; i += 1) {
                if (vec[baseSize + i] === 1) {
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

/** The Dixon algorithm generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; bound?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.trunc(task.n) : 8051;
    const bound = typeof task.bound === "number" ? Math.trunc(task.bound) : 30;
    const base = primesUpTo(Math.max(3, bound));
    let step = 0;

    if (!Number.isFinite(n) || n < 4) {
        yield {
            stepNumber: 0,
            entities: makeCells(base, [], 0),
            edges: [],
            description: "Dixon's algorithm needs a composite n >= 4.",
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
            codeLineNumber: 5,
            layout: "grid",
            meta: { n, factor: 2, base },
        };
        return;
    }

    yield {
        stepNumber: step,
        entities: makeCells(base, [], 0),
        edges: [],
        description: `Factor ${n} with factor base [${base.join(", ")}]; collect smooth x^2 mod n.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, factor: 0, base, relations: 0 },
    };
    step += 1;

    // Collect smooth relations x^2 mod n over the factor base.
    const relations: Relation[] = [];
    const needed = base.length * 2 + 2;
    const searchLimit = Math.max(400000, n * 40);
    let x = Math.ceil(Math.sqrt(n));
    while (relations.length < needed && x < searchLimit) {
        const q = (x * x) % n;
        if (q > 1) {
            const exponents = factorOverBase(q, base);
            if (exponents && exponents.some((e) => e > 0)) {
                relations.push({ x, exponents });
                yield {
                    stepNumber: step,
                    entities: makeCells(base, exponents, 0),
                    edges: [],
                    description:
                        `Relation ${relations.length}: x=${x}, x^2 mod ${n} = ${q}, smooth over the base.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: { n, factor: 0, base, relations: relations.length, x, q },
                };
                step += 1;
            }
        }
        x += 1;
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
                productX = (productX * rel.x) % n;
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
                ? `Found congruence of squares; gcd gives ${n} = ${factor} * ${n / factor}.`
                : `No splitting congruence found for ${n}; it may be prime or need a larger base.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { n, factor, base, relations: relations.length },
    };
}

/** The Dixon algorithm module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If we can find x and y with x squared congruent to y squared modulo n but x not congruent to plus or minus y, then gcd(x - y, n) is a nontrivial factor. Dixon's algorithm manufactures such a pair by collecting values x squared mod n that factor completely over a small prime base. Their exponent vectors are combined so every exponent becomes even, turning the product into a square on both sides.",
        invariants: [
            "Every relation stores x and the full prime exponents of x squared mod n.",
            "The relation matrix is reduced over GF(2), tracking which original rows combine.",
            "A dependency has even total exponent for every base prime.",
        ],
        correctness:
            "A subset of relations whose exponent parities all cancel multiplies to a value whose prime exponents are even, hence a perfect square Y squared. The product of the corresponding x values is X, and X squared is congruent to Y squared modulo n because each relation came from x squared mod n. If X differs from plus or minus Y, gcd(X - Y, n) is a proper divisor, so the algorithm splits n.",
        complexityRationale:
            "With a base of L primes the relation matrix has O(L^2) bits, and Gaussian elimination over GF(2) costs O(L^3) word operations; each smoothness trial divides by L primes, so collecting relations is roughly quadratic in L. Memory holds the matrix, O(L^2).",
        uses: [
            "Factoring integers as a conceptual precursor to the quadratic sieve",
            "Teaching smooth numbers and linear algebra over finite fields",
            "A simple deterministic core for factoring small semiprimes",
        ],
        references: [
            "Dixon, Asymptotically Fast Factorization of Integers, 1981",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Chapter 6",
        ],
        workedExample:
            "For n = 8051, x = 90 gives 90 squared mod 8051 = 49 = 7 squared, and x = 91 gives 230 = 2 * 5 * 23. Combining enough such relations so all exponents are even yields a congruence of squares; gcd extracts a factor such as 83, leaving 8051 = 83 * 97.",
    },
    id: "dixon-algorithm",
    name: "Dixon's Algorithm",
    category: "math",
    complexity: { time: "O(L^3 + L^2 * trials)", space: "O(L^2)" },
    defaultInput: { n: 8051, bound: 30 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a factor base of small primes up to the bound",
        "search x upward and compute q = x squared mod n",
        "keep x when q factors fully over the base (a relation)",
        "record each relation's prime exponent vector",
        "once there are more relations than primes, find an even-exponent subset",
        "build X and Y from that subset and take gcd(X - Y, n)",
        "done: report the nontrivial factor",
    ],
};

export default module;
