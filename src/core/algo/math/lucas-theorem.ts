/**
 * lucas-theorem.ts – Lucas's Theorem (binomial coefficients mod p)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lucas's theorem computes binomial coefficients modulo a prime p by reducing
 * n and k to their base-p digits:
 *
 *   C(n, k) ≡ ∏ C(n_i, k_i)  (mod p)
 *
 * where n_i, k_i are the digits of n and k in base p, and C(n_i, k_i) is
 * treated as 0 when k_i > n_i. This turns a potentially enormous binomial
 * computation into a product of tiny ones.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log_p n)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The base-p digits of n and k are shown as cells.
 *   - The digit pair being combined is YELLOW (comparing).
 *   - The final product is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The digit-wise product idea is the heart to teach.
 *   - Combined with factorial precomputation, it powers competitive binomial
 *     queries mod p.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** The modulus must be prime (here a small one). */
const P = 7;

/**
 * Build a grid of cells showing a number's base-p digits.
 *
 * @param digits The digits (MSB first).
 * @param activeIndex The digit being combined.
 * @returns Cell entities in a single row.
 */
function makeDigits(digits: number[], activeIndex = -1): VisualEntity[] {
    return digits.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: (activeIndex === index ? "comparing" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/** Factorial modulo p. */
function factorialModP(k: number): number {
    let result = 1;
    for (let i = 2; i <= k; i += 1) {
        result = (result * i) % P;
    }
    return result;
}

/** Binomial C(a, b) mod p for 0 ≤ b ≤ a < p. */
function smallBinom(a: number, b: number): number {
    if (b < 0 || b > a) {
        return 0;
    }
    const num = factorialModP(a);
    const den = (factorialModP(b) * factorialModP(a - b)) % P;
    // Inverse via Fermat: den^(p-2) mod p.
    let inv = 1;
    for (let i = 0; i < P - 2; i += 1) {
        inv = (inv * den) % P;
    }
    return (num * inv) % P;
}

/**
 * The Lucas Theorem generator.
 *
 * @param input `{ n, k }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; k?: number } | null) ?? {};
    const n = typeof task.n === "number" ? task.n : 10;
    const k = typeof task.k === "number" ? task.k : 3;

    let step = 0;

    // Frame 0: the setup.
    yield {
        stepNumber: step,
        entities: makeDigits([n, k]),
        edges: [],
        description: `Computing C(${n}, ${k}) mod ${P} with Lucas's theorem.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // Compute the base-p digits of n and k.
    const digitsN: number[] = [];
    const digitsK: number[] = [];
    let nn = n;
    let kk = k;
    while (nn > 0 || kk > 0) {
        digitsN.push(nn % P);
        digitsK.push(kk % P);
        nn = Math.floor(nn / P);
        kk = Math.floor(kk / P);
    }
    // Pad to equal length and reverse to MSB-first.
    while (digitsN.length < digitsK.length) {
        digitsN.push(0);
    }
    while (digitsK.length < digitsN.length) {
        digitsK.push(0);
    }
    digitsN.reverse();
    digitsK.reverse();

    yield {
        stepNumber: step,
        entities: makeDigits(digitsN),
        edges: [],
        description: `${n} in base ${P} = ${digitsN.join("")}; ${k} in base ${P} = ${digitsK.join("")}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // Multiply the digit-wise binomials.
    let result = 1;
    const factors: number[] = [];

    for (let i = 0; i < digitsN.length; i += 1) {
        const ni = digitsN[i] ?? 0;
        const ki = digitsK[i] ?? 0;
        const factor = smallBinom(ni, ki);
        factors.push(factor);
        result = (result * factor) % P;

        yield {
            stepNumber: step,
            entities: makeDigits(factors, i),
            edges: [],
            description: `C(${ni}, ${ki}) mod ${P} = ${factor}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { result },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeDigits(factors),
        edges: [],
        description: `C(${n}, ${k}) mod ${P} = ${result}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { result },
    };
}

/** The Lucas Theorem module, registered with the engine. */
const module: AlgorithmModule = {
    id: "lucas-theorem",
    name: "Lucas's Theorem",
    category: "math",
    complexity: { time: "O(log_p n)", space: "O(1)" },
    // C(10, 3) mod 7 = 120 mod 7 = 1.
    defaultInput: { n: 10, k: 3 },
    visualType: "grid",
    run,
};

export default module;
