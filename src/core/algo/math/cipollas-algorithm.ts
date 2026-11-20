/**
 * cipollas-algorithm.ts - Cipolla's Modular Square Root Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cipolla's algorithm computes a square root of a quadratic residue a modulo
 * an odd prime p. It finds b such that d = b^2 - a is a quadratic non-residue,
 * then works in the extension field F_p(sqrt(d)). There (b + sqrt(d))^((p+1)/2)
 * lies in the base field and its value squares to a.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log p) field multiplications in F_p(sqrt(d))
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the chosen b, the exponent bits, and the running pair.
 *   - The final frame reports the root in meta.root.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pair = [number, number]; // u + v*sqrt(d)

function modPow(a: number, e: number, m: number): number {
    let r = 1;
    let base = ((a % m) + m) % m;
    let exp = e;
    while (exp > 0) {
        if (exp % 2 === 1) r = (r * base) % m;
        base = (base * base) % m;
        exp = Math.floor(exp / 2);
    }
    return r;
}

/** Multiply two elements of F_p(sqrt(d)). */
function mul(x: Pair, y: Pair, d: number, p: number): Pair {
    const real = (x[0] * y[0] + x[1] * y[1] * d) % p;
    const imag = (x[0] * y[1] + x[1] * y[0]) % p;
    return [((real % p) + p) % p, ((imag % p) + p) % p];
}

function makeCells(values: number[], active = -1): VisualEntity[] {
    return values.map((value, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: (i === active ? "comparing" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; p?: number } | null) ?? {};
    const n = typeof task.n === "number" ? task.n : 5;
    const p = typeof task.p === "number" && task.p > 2 && task.p % 2 === 1 ? task.p : 41;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells([n, p]),
        edges: [],
        description: `Finding sqrt(${n}) modulo the odd prime ${p} with Cipolla's algorithm.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;

    const a = ((n % p) + p) % p;
    if (a === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([0], 0),
            edges: [],
            description: "Zero has root zero.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { step, root: 0 },
        };
        return;
    }

    // Euler's criterion: a residue satisfies a^((p-1)/2) = 1.
    if (modPow(a, (p - 1) / 2, p) !== 1) {
        yield {
            stepNumber: step,
            entities: makeCells([a], 0),
            edges: [],
            description: `${a} is a quadratic non-residue mod ${p}, so no square root exists.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { step, root: -1 },
        };
        return;
    }

    // Find b with d = b^2 - a a quadratic non-residue (Legendre symbol -1).
    let b = 0;
    let d = 0;
    for (let candidate = 0; candidate < p; candidate += 1) {
        const trial = (((candidate * candidate - a) % p) + p) % p;
        if (modPow(trial, (p - 1) / 2, p) === p - 1) {
            b = candidate;
            d = trial;
            break;
        }
    }
    yield {
        stepNumber: step,
        entities: makeCells([b, d], 1),
        edges: [],
        description: `Chose b = ${b}; d = b^2 - a = ${d} is a non-residue, so work in F_${p}(sqrt(${d})).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { step, b, d },
    };
    step += 1;

    // Binary exponentiation of (b + sqrt(d)) to (p+1)/2.
    let result: Pair = [1, 0];
    let base: Pair = [b, 1];
    let exp = (p + 1) / 2;
    while (exp > 0) {
        if (exp % 2 === 1) {
            result = mul(result, base, d, p);
            yield {
                stepNumber: step,
                entities: makeCells([result[0], result[1], exp], 0),
                edges: [],
                description: `Exponent bit set: accumulator = ${result[0]} + ${result[1]}*sqrt(${d}), exp ${exp}.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { step, real: result[0], imag: result[1] },
            };
            step += 1;
        }
        base = mul(base, base, d, p);
        exp = Math.floor(exp / 2);
    }

    const root = ((result[0] % p) + p) % p;
    yield {
        stepNumber: step,
        entities: makeCells([root], 0),
        edges: [],
        description: `sqrt(${a}) mod ${p} = ${root} because ${root}^2 mod ${p} = ${modPow(root, 2, p)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { step, root, b, d, squared: modPow(root, 2, p) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When p is 3 mod 4 a square root is just a^((p+1)/4), but that formula fails for other primes. Cipolla's trick is to step outside the base field. Pick b so that b^2 - a is a non-residue, adjoin its square root to form F_p(sqrt(b^2 - a)), and raise b + sqrt(b^2 - a) to the power (p+1)/2. That power lands back in F_p and its square is a.",
        invariants: [
            "Euler's criterion a^((p-1)/2) = 1 holds because a is a quadratic residue.",
            "The chosen d = b^2 - a is a non-residue, so x^2 - d has no root in F_p and F_p(sqrt(d)) is a field.",
            "Multiplication in F_p(sqrt(d)) is closed and uses only the rule (sqrt(d))^2 = d.",
        ],
        correctness:
            "In F_p(sqrt(d)) the Frobenius map sends sqrt(d) to -sqrt(d) because d is a non-residue, so (b + sqrt(d))^p = b - sqrt(d). Hence (b + sqrt(d))^(p+1) = b^2 - d = a. Raising to (p+1)/2 therefore gives an element whose square is a. That element is fixed by Frobenius because its (p-1)-st power is a^((p-1)/2) = 1, so it lies in F_p; binary exponentiation computes that exact power and returns a genuine square root.",
        complexityRationale:
            "Finding b scans candidates, each costing one modular exponentiation, O(log p) per trial. The main exponentiation performs O(log p) multiplications in F_p(sqrt(d)), each a constant number of base-field operations, giving O(log p) time and O(1) space.",
        uses: [
            "Point decompression on elliptic curves over prime fields",
            "Decoding quadratic-residue codes",
            "A concrete illustration of finite-field extensions for cryptography courses",
        ],
        references: [
            "Cipolla, Un metodo per la risoluzione della congruenza di secondo grado, 1903",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Section 7.3",
        ],
        workedExample:
            "For a = 5 and p = 41, Euler's criterion passes. The smallest b making b^2 - 5 a non-residue is b = 4, with d = 11. Raising 4 + sqrt(11) to the power 21 in F_41(sqrt(11)) gives 28 with zero imaginary part, and indeed 28^2 = 784 = 19*41 + 5, so 28 is a square root of 5 mod 41.",
    },
    id: "cipollas-algorithm",
    name: "Cipolla's Algorithm",
    category: "math",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { n: 5, p: 41 },
    visualType: "grid",
    run,
    pseudocode: [
        "state residue n and odd prime p",
        "if n is zero return zero",
        "reject non-residues using Euler's criterion",
        "find b so that b^2 - n is a non-residue",
        "raise b + sqrt(b^2 - n) to (p+1)/2 in F_p(sqrt(b^2 - n))",
        "done: the result is a square root of n",
    ],
};

export default module;
