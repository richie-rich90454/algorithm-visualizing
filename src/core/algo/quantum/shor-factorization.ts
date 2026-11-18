/**
 * shor-factorization.ts - Shor's Factorization (Toy Order-Finding Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Shor's algorithm factors an odd composite N by picking a coprime base a,
 * finding the order r of a modulo N, and using a^(r/2) to split N through two
 * greatest-common-divisor computations. The quantum part is period finding: a
 * quantum Fourier transform samples the period of the function x -> a^x mod N.
 *
 * This teaching model makes the mathematical step exact by computing that
 * period with a direct classical search over residues, then performing the same
 * classical gcd reduction Shor's algorithm uses. It is NOT a fault-tolerant
 * quantum computation and it is NOT a secure or production factoring tool: the
 * numbers are tiny, there is no quantum circuit simulation, no Fourier sampling,
 * and no noise or error correction. Real Shor needs a large fault-tolerant
 * quantum computer to beat classical factoring.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r log N) for the toy order search, O(log N) for each gcd
 *   Space: O(r) for the residue sequence
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the residue sequence a^x mod N over one full period.
 *   - The final frame is green when a nontrivial factor pair is found.
 *   - Order, midpoint power, and gcd factors are in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Modular exponentiation by repeated squaring. */
export function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1 % modulus;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0) {
        if (e & 1) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e >>>= 1;
    }
    return result;
}

/** Euclidean greatest common divisor. */
export function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        [x, y] = [y, x % y];
    }
    return x;
}

export interface ShorData {
    n: number;
    a: number;
    sequence: number[];
    order: number;
    halfPower: number;
    factors: number[] | null;
    success: boolean;
}

/** Exact toy Shor reduction: find the order, then split N with gcds. */
export function shorToy(n: number, a: number): ShorData {
    const N = Math.max(3, Math.floor(n));
    const base = ((a % N) + N) % N;
    const sequence: number[] = [];
    let order = 0;
    let value = 1 % N;
    for (let x = 0; x <= N; x += 1) {
        value = (value * base) % N;
        if (value === 1) {
            order = x + 1;
            break;
        }
    }
    for (let x = 0; x < order; x += 1) {
        sequence.push(powMod(base, x, N));
    }
    const halfPower = order > 0 && order % 2 === 0 ? powMod(base, order / 2, N) : -1;
    let factors: number[] | null = null;
    if (halfPower >= 0 && halfPower !== N - 1) {
        const p = gcd(halfPower - 1, N);
        const q = gcd(halfPower + 1, N);
        if (p > 1 && p < N && q > 1 && q < N) {
            factors = [p, q].sort((u, v) => u - v);
        }
    }
    return { n: N, a: base, sequence, order, halfPower, factors, success: factors !== null };
}

/** Build residue bars. */
function makeBars(sequence: number[], active: number, state: EntityState = "idle"): VisualEntity[] {
    return sequence.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `a^${index}=${value}`,
        value,
        state: index === active ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { exponent: index, residue: value },
    }));
}

/** The toy Shor generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; a?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(3, Math.floor(task.n)) : 15;
    const a = typeof task.a === "number" ? task.a : 7;
    const data = shorToy(n, a);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(data.sequence, -1),
        edges: [],
        description: `Toy Shor factorization of N = ${n} with base ${a} (exact order search, not a quantum run).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: data.n, a: data.a, order: 0, halfPower: -1, factors: [], success: false },
    };

    yield {
        stepNumber: step++,
        entities: makeBars(data.sequence, -1),
        edges: [],
        description: `Residue sequence a^x mod N over one period: [${data.sequence.join(", ")}].`,
        codeLineNumber: 2,
        layout: "array",
        meta: { n: data.n, a: data.a, order: 0, sequence: [...data.sequence], halfPower: -1, factors: [], success: false },
    };

    yield {
        stepNumber: step++,
        entities: makeBars(data.sequence, data.sequence.length - 1, "active"),
        edges: [],
        description: `The period-finding step gives order r = ${data.order}, where a^r mod N = 1.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n: data.n, a: data.a, order: data.order, sequence: [...data.sequence], halfPower: data.halfPower, factors: [], success: false },
    };

    yield {
        stepNumber: step++,
        entities: makeBars(data.sequence, -1, data.success ? "sorted" : "unvisited"),
        edges: [],
        description: data.success
            ? `a^(r/2) = ${data.halfPower}; gcd(${data.halfPower}-1, N) and gcd(${data.halfPower}+1, N) give factors [${data.factors?.join(", ")}].`
            : `No nontrivial split: order ${data.order} is odd or a^(r/2) equals N-1, so try another base.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n: data.n, a: data.a, order: data.order, halfPower: data.halfPower, factors: data.factors ?? [], success: data.success },
    };

    yield {
        stepNumber: step,
        entities: makeBars(data.sequence, -1, data.success ? "sorted" : "error"),
        edges: [],
        description: data.success
            ? `Done: ${data.n} = ${data.factors?.[0]} x ${data.factors?.[1]} (toy model, not secure quantum factoring).`
            : `Done: base ${a} failed to factor ${data.n}; pick a different coprime base.`,
        codeLineNumber: 8,
        layout: "array",
        meta: {
            n: data.n,
            a: data.a,
            order: data.order,
            halfPower: data.halfPower,
            factors: data.factors ?? [],
            success: data.success,
        },
    };
}

/** The toy Shor module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Pick a number a that shares no factor with N and watch the remainders of a to the first, second, third power and so on. They cycle with some period r. When r is even, the midpoint of the cycle usually hides a square root of one that is not plus or minus one, and taking gcds with N peels off a real factor.",
        invariants: [
            "Every residue equals a to the exponent modulo N.",
            "The sequence repeats with period r, so a to the r is one modulo N.",
            "A reported factor pair multiplies back to N and neither factor is trivial.",
        ],
        correctness:
            "If a to the r is one modulo N and r is even, then (a to the r/2) squared is one modulo N. When that midpoint is neither one nor minus one, it is a nontrivial square root of one, so N divides the product (midpoint minus one)(midpoint plus one) but not either factor alone. Taking gcd of N with each term therefore returns a proper divisor, and the two divisors multiply to N. The toy search finds r exactly by enumeration, matching the period the quantum Fourier step would sample.",
        complexityRationale:
            "The toy order search enumerates at most N residues, O(r*log N) with modular multiplication, and each gcd costs O(log N). Space holds one period of residues, O(r). Real Shor replaces the search with a polynomial-time quantum circuit, which this model does not simulate.",
        uses: [
            "A teaching model for order finding and reduction to gcd",
            "Understanding why period finding breaks RSA-style factoring",
            "A bridge from classical modular arithmetic to quantum algorithms",
        ],
        references: [
            "Shor, Polynomial-Time Algorithms for Prime Factorization and Discrete Logarithms, SIAM Journal on Computing, 1997",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Section 5.3",
        ],
        workedExample:
            "For N = 15 and a = 7 the residues are 1, 7, 4, 13 and then back to 1, so the order is 4. The midpoint is 7 squared mod 15, which is 4. gcd(3, 15) is 3 and gcd(5, 15) is 5, giving 15 = 3 times 5.",
    },
    id: "shor-factorization",
    name: "Shor Factorization (Toy)",
    category: "quantum",
    complexity: { time: "O(r*log N)", space: "O(r)" },
    defaultInput: { n: 15, a: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "choose an odd composite N and a coprime base a",
        "list residues a to the x modulo N until one repeats",
        "the order r is the exponent where the residue returns to one",
        "if r is odd, reject this base and choose another",
        "compute the midpoint power a to the r/2 modulo N",
        "if the midpoint is minus one, reject this base",
        "take gcds of N with midpoint minus and plus one",
        "verify that the two gcds multiply back to N",
        "done: report the factors or ask for a new base",
    ],
};

export default module;
