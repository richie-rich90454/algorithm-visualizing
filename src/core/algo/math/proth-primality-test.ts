/**
 * proth-primality-test.ts - Proth's Primality Theorem
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Proth number has the form k times two to the m plus one, where k is odd
 * and smaller than two to the m. Proth's theorem says such a number n is
 * prime exactly when some base a satisfies a^((n-1)/2) congruent to minus one
 * modulo n. The test checks a handful of small bases with exact BigInt
 * modular exponentiation.
 *
 * The simulation is exact for any JavaScript-safe integer n; the base search
 * is capped so the visualization stays finite. When the search is exhausted
 * without a witness the number is reported composite.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b * log^3 n) for b bases using modular exponentiation
 *   Space: O(log n) for the BigInt arithmetic
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the residue of each tested base's exponentiation.
 *   - A residue of n-1 is the minus-one witness and is highlighted.
 *   - The final frame reports prime, composite, or not applicable.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ProthInput {
    n?: number;
    k?: number;
    m?: number;
    maxBases?: number;
}

/** Exact modular exponentiation with BigInt. */
function modpow(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    let b = base % mod;
    let e = exp;
    while (e > 0n) {
        if (e & 1n) result = (result * b) % mod;
        b = (b * b) % mod;
        e >>= 1n;
    }
    return result;
}

/** Greatest common divisor for BigInt. */
function gcd(a: bigint, b: bigint): bigint {
    let x = a;
    let y = b;
    while (y !== 0n) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

/** Decompose n-1 into k times two to the m with k odd. */
function decompose(n: number): { k: number; m: number } {
    let odd = n - 1;
    let twos = 0;
    while (odd % 2 === 0 && odd > 0) {
        odd = Math.floor(odd / 2);
        twos += 1;
    }
    return { k: odd, m: twos };
}

/** Bars for the tested bases and their residues. */
function makeBars(residues: number[], highlight: number): VisualEntity[] {
    return residues.map((value, index) => ({
        id: `base-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: index === highlight ? "sorted" : "comparing",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, residue: value },
    }));
}

/** The Proth primality generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ProthInput | null) ?? {};
    const explicit = typeof task.k === "number" && typeof task.m === "number"
        ? { k: Math.floor(task.k), m: Math.floor(task.m) }
        : null;
    const n = Math.max(3, Math.min(2_000_000_000, Math.floor(Number(task.n) || (explicit ? explicit.k * 2 ** explicit.m + 1 : 13))));
    const { k, m } = explicit ?? decompose(n);
    const computedN = explicit ? k * 2 ** m + 1 : n;
    const value = BigInt(computedN);
    const applicable = k > 0 && k % 2 === 1 && BigInt(k) < 1n << BigInt(m);
    const exponent = (value - 1n) / 2n;
    const maxBases = Math.max(1, Math.min(Math.floor(task.maxBases ?? 64), computedN - 1));

    const residues: number[] = [];
    let witness = 0;
    let verdict: "prime" | "composite" | "not-applicable" | "inconclusive" = "inconclusive";

    const metaBase = {
        n: computedN,
        k,
        m,
        exponent: exponent.toString(),
        applicable,
        witness,
        verdict,
        residues: [] as number[],
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([computedN], -1),
        edges: [],
        description: `Testing n = ${computedN} = ${k} times 2^${m} plus 1; Proth form is ${applicable ? "satisfied" : "not satisfied"}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaBase },
    };
    step += 1;

    if (!applicable) {
        yield {
            stepNumber: step,
            entities: makeBars([computedN], -1),
            edges: [],
            description: `The number does not satisfy k less than 2^m with k odd, so Proth's theorem does not apply.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { ...metaBase, verdict: "not-applicable" },
        };
        return;
    }

    for (let a = 2; a <= maxBases + 1; a += 1) {
        const base = BigInt(a);
        if (gcd(base, value) !== 1n) continue;
        const residue = modpow(base, exponent, value);
        const asNumber = Number(residue);
        residues.push(asNumber);
        if (residue === value - 1n) {
            witness = a;
            verdict = "prime";
            break;
        }
        yield {
            stepNumber: step,
            entities: makeBars(residues, -1),
            edges: [],
            description: `Base ${a} gives residue ${asNumber}, not minus one; trying another base.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { ...metaBase, residues: [...residues] },
        };
        step += 1;
    }

    if (verdict !== "prime") {
        verdict = maxBases >= computedN - 1 ? "composite" : "inconclusive";
    }

    yield {
        stepNumber: step,
        entities: makeBars(residues, verdict === "prime" ? residues.length - 1 : -1),
        edges: [],
        description:
            verdict === "prime"
                ? `Base ${witness} is a minus-one witness: n = ${computedN} is prime.`
                : `No minus-one witness found in ${residues.length} base(s): verdict ${verdict}.`,
        codeLineNumber: verdict === "prime" ? 3 : 4,
        layout: "array",
        meta: { ...metaBase, witness, verdict, residues: [...residues] },
    };
}

/** The Proth primality module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Some numbers have a special shape: an odd multiplier times a power of two, plus one. For those numbers a single modular exponentiation can prove primality. If you find a base whose half-exponent lands on minus one modulo n, the number must be prime. It is a one-sided test in the sense that finding the witness is the proof.",
        invariants: [
            "The candidate satisfies n minus one equals k times two to the m with k odd.",
            "Each tested base is coprime to n, so modular exponentiation stays in the unit group.",
            "A minus-one residue is a sufficient certificate of primality by Proth's theorem.",
        ],
        correctness:
            "Proth's theorem follows from the structure of the multiplicative group modulo a prime Proth number. For prime n the group is cyclic of order n-1, and exactly half of the bases have a half-power equal to minus one, so a witness exists. If a composite n had such a witness, the congruence would force every prime factor of n to be larger than the square root of n, which is impossible for a composite Proth number; hence the witness certifies primality.",
        complexityRationale:
            "Each base costs one modular exponentiation with a binary expansion of the exponent, which takes O(log n) modular multiplications of O(log n)-bit numbers, or O(log^3 n) bit operations. Trying b bases multiplies that by b, while memory stays at O(log n) for the BigInt values.",
        uses: [
            "Fast primality proofs for numbers of the special Proth form",
            "Generating and verifying large primes for cryptography",
            "A teaching bridge between Fermat tests and deterministic primality proofs",
        ],
        references: [
            "Proth, Theoremes sur les nombres premiers, 1878",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Chapter 4",
        ],
        workedExample:
            "Take k equals 3 and m equals 2, giving n equals 13. The exponent is six. Two to the sixth is 64, which is congruent to minus one modulo 13, so 2 is a minus-one witness and 13 is prime.",
    },
    id: "proth-primality-test",
    name: "Proth Primality Test",
    category: "math",
    complexity: { time: "O(b log^3 n)", space: "O(log n)" },
    defaultInput: { k: 3, m: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "write n minus one as k times two to the m with k odd",
        "verify k is odd and less than two to the m",
        "set the exponent to n minus one over two",
        "for each small base a coprime to n",
        "compute r equals a^exponent mod n",
        "if r equals n minus one, report prime",
        "after all bases, report composite or inconclusive",
    ],
};

export default module;
