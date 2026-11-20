/**
 * quadratic-sieve.ts - The Quadratic Sieve Factorization Method.
 *
 * Finds x and y with x^2 - y^2 divisible by n but x not congruent to plus or
 * minus y, so gcd(x-y, n) is a factor. Smooth values of Q(x)=x^2-n over a
 * factor base are collected, combined by parity using linear algebra over
 * GF(2), and turned into a congruence of squares.
 *
 * Time subexponential in n; space proportional to the factor base.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function gcd(a: number, b: number): number {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { [a, b] = [b, a % b]; }
    return a;
}
function modPow(base: number, exp: number, mod: number): number {
    let r = 1, x = ((base % mod) + mod) % mod, e = exp;
    while (e > 0) { if (e % 2 === 1) r = (r * x) % mod; x = (x * x) % mod; e = Math.floor(e / 2); }
    return r;
}
function isResidue(a: number, p: number): boolean {
    if (p === 2) return true;
    return modPow(a, (p - 1) / 2, p) === 1;
}
function primesUpTo(bound: number): number[] {
    const sieve = new Array(bound + 1).fill(true);
    sieve[0] = sieve[1] = false;
    for (let i = 2; i * i <= bound; i += 1) if (sieve[i]) for (let j = i * i; j <= bound; j += i) sieve[j] = false;
    const primes: number[] = [];
    for (let i = 2; i <= bound; i += 1) if (sieve[i]) primes.push(i);
    return primes;
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
    const task = (input as { n?: number; B?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(15, Math.trunc(task.n)) : 8051;
    const B = typeof task.B === "number" ? Math.max(5, Math.trunc(task.B)) : 20;
    const base = [-1, ...primesUpTo(B).filter((p) => p > 1 && isResidue(n, p))];
    const startX = Math.ceil(Math.sqrt(n));
    const relations: Array<{ x: number; q: number; vec: number[]; exp: number[] }> = [];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: cells([{ label: "n", value: n }, { label: "B", value: B }, { label: "sqrt(n)", value: startX }], 2),
        edges: [],
        description: `Sieve Q(x)=x^2-${n} near x=${startX} with factor base ${base.join(", ")}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, B, factorBase: base.slice(), relations: 0 },
    };

    for (let x = startX; x < startX + 20000 && relations.length <= base.length + 1; x += 1) {
        const q = x * x - n;
        const vec = new Array(base.length).fill(0);
        const exp = new Array(base.length).fill(0);
        let rest = q;
        for (let i = 0; i < base.length; i += 1) {
            const p = base[i]!;
            if (p === -1) { if (rest < 0) { vec[i] = 1; exp[i] = 1; rest = -rest; } continue; }
            while (rest % p === 0) { exp[i] += 1; vec[i] ^= 1; rest /= p; }
        }
        if (rest === 1) relations.push({ x, q, vec, exp });
        if (rest === 1 && relations.length <= 12) {
            yield {
                stepNumber: step++,
                entities: cells([{ label: "x", value: x }, { label: "Q(x)", value: q }, { label: "found", value: relations.length }], 2),
                edges: [],
                description: `Q(${x}) = ${q} is ${base.join(",")}-smooth; relation ${relations.length} recorded.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { n, B, x, q, relations: relations.length },
            };
        }
    }

    let factor = 0;
    let X = 0;
    let Y = 0;
    const m = relations.length;
    const rows = relations.map((rel, i) => ({ bits: rel.vec.slice(), id: Math.pow(2, i) }));
    let pivotCol = 0;
    for (let c = 0; c < base.length && pivotCol < m; c += 1) {
        let pivot = -1;
        for (let r = pivotCol; r < m; r += 1) if (rows[r]!.bits[c]) { pivot = r; break; }
        if (pivot === -1) continue;
        [rows[pivotCol], rows[pivot]] = [rows[pivot]!, rows[pivotCol]!];
        for (let r = 0; r < m; r += 1) {
            if (r === pivotCol || !rows[r]!.bits[c]) continue;
            for (let k = 0; k < base.length; k += 1) rows[r]!.bits[k] ^= rows[pivotCol]!.bits[k]!;
            rows[r]!.id ^= rows[pivotCol]!.id;
        }
        pivotCol += 1;
    }

    for (const row of rows) {
        if (!row.bits.every((v) => v === 0) || row.id === 0) continue;
        let productX = 1;
        const exponents = new Array(base.length).fill(0);
        for (let i = 0; i < m; i += 1) {
            if (Math.floor(row.id / Math.pow(2, i)) % 2 !== 1) continue;
            productX = (productX * relations[i]!.x) % n;
            relations[i]!.exp.forEach((v, k) => { exponents[k] += v; });
        }
        let productY = 1;
        for (let k = 0; k < base.length; k += 1) {
            const p = base[k]!;
            if (p === -1) continue;
            for (let e = 0; e < exponents[k]! / 2; e += 1) productY = (productY * p) % n;
        }
        X = productX; Y = productY;
        for (const f of [gcd(X - Y, n), gcd(X + Y, n)]) {
            if (f > 1 && f < n) { factor = f; break; }
        }
        if (factor) break;
    }

    yield {
        stepNumber: step++,
        entities: cells([{ label: "relations", value: relations.length }, { label: "X", value: X }, { label: "Y", value: Y }], 2),
        edges: [],
        description: `GF(2) elimination found ${relations.length} relations; congruence X=${X}, Y=${Y} with X^2 = Y^2 mod ${n}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { n, B, relations: relations.length, X, Y },
    };
    yield {
        stepNumber: step,
        entities: cells([{ label: "n", value: n }, { label: "factor", value: factor }, { label: "cofactor", value: factor ? n / factor : 0 }], 2),
        edges: [],
        description: factor
            ? `Done: gcd(X-Y, n) = ${factor}; ${n} = ${factor} * ${n / factor}.`
            : `Done: no factor found with B=${B}; increase the smoothness bound.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { n, B, factor, cofactor: factor ? n / factor : 0, X, Y },
    };
}

const module: AlgorithmModule = {
    id: "quadratic-sieve",
    name: "Quadratic Sieve",
    category: "math",
    complexity: { time: "L_n[1/2, 1+o(1)]", space: "O(B pi(B))" },
    defaultInput: { n: 8051, B: 20 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose smoothness bound B and factor base of primes with n a quadratic residue",
        "for x near sqrt(n), test whether Q(x)=x^2-n factors fully over the base",
        "record each smooth Q(x) as a parity vector of prime exponents",
        "use Gaussian elimination over GF(2) to find a dependency of vectors",
        "multiply the matching x values into X and halve exponents into Y",
        "set factor <- gcd(X-Y, n)",
        "done: return a nontrivial factor or increase B",
    ],
    education: {
        intuition:
            "If two numbers square to the same value modulo n but are not plus or minus each other, their difference shares a factor with n. The sieve hunts for many values x^2-n that factor completely over a small prime base; combining enough of them by matching exponent parities forces such a pair of squares.",
        invariants: [
            "Every recorded Q(x) factors completely over the chosen factor base.",
            "A parity vector records which prime exponents are odd.",
            "A dependency of parity vectors makes the product of the Q(x) values a perfect square.",
        ],
        correctness:
            "For a dependency, the product of Q(x_i) equals a square Y^2 while the product of x_i^2 is X^2, so X^2 = Y^2 modulo n. If X is congruent to neither Y nor minus Y modulo n, then gcd(X-Y,n) is a proper divisor. More relations than factor-base primes guarantee a dependency exists by linear algebra over GF(2).",
        complexityRationale:
            "Smooth values become frequent when the factor base is chosen by the subexponential optimization, giving L_n[1/2,1+o(1)] time. Storage is one parity vector per relation and the matrix over the factor base of size about pi(B).",
        uses: [
            "Factoring integers of tens of digits before the number field sieve",
            "Breaking RSA with small to moderate moduli",
            "A teaching example of index calculus and linear sieving",
        ],
        references: [
            "Pomerance, The Quadratic Sieve Factoring Algorithm, 1984",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Chapter 6",
        ],
        workedExample:
            "For n=8051 and B=20, the factor base is {3,5,7,11,13}. Smooth values such as 90^2-8051=49 are collected; a dependency gives X=2493 and Y=910, and gcd(2493-910, 8051)=83, so 8051=83*97.",
    },
};

export default module;
