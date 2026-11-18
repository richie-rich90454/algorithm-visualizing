/**
 * modular-inverse.ts – Modular Inverse (via Extended Euclid)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The modular inverse of a mod m is the number x with a·x ≡ 1 (mod m). It
 * exists iff gcd(a, m) = 1. The extended Euclidean algorithm computes it
 * directly: the Bezout coefficients give a·x + m·y = 1, so a·x ≡ 1 (mod m)
 * and x is the inverse.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log min(a, m))
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The candidate products a·x mod m are shown as cells.
 *   - The candidate whose product equals 1 is GREEN (sorted).
 *   - Each Euclid step shows (oldR, r, quotient, oldX, x) as cells.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Division mod m is implemented as multiplication by the inverse.
 *   - Existence requires gcd(a, m) = 1.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A tiny gcd helper. */
function gcd(a: number, b: number): number {
    while (b !== 0) {
        const r = a % b;
        a = b;
        b = r;
    }
    return a;
}

/**
 * Build a grid of cells showing x·a mod m for each candidate x.
 *
 * @param values The candidate products.
 * @param winner The index that equals 1 (or -1).
 * @returns Cell entities in a single row.
 */
function makeCells(values: number[], winner = -1): VisualEntity[] {
    return values.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: (index === winner ? "sorted" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Modular Inverse generator.
 *
 * @param input `{ a, m }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; m?: number } | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 3;
    const m = typeof task.m === "number" ? task.m : 11;

    let step = 0;

    // Frame 0: the setup.
    yield {
        stepNumber: step,
        entities: makeCells([a]),
        edges: [],
        description: `Finding the inverse of ${a} modulo ${m}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;

    // Degenerate modulus: no meaningful inverse ring.
    if (m < 2) {
        yield {
            stepNumber: step,
            entities: makeCells([a]),
            edges: [],
            description: `Modulus m = ${m} is degenerate – no modular inverse exists.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { step },
        };
        return;
    }

    // If not coprime, no inverse exists.
    if (gcd(a, m) !== 1) {
        yield {
            stepNumber: step,
            entities: makeCells([a]),
            edges: [],
            description: `gcd(${a}, ${m}) ≠ 1 – no modular inverse exists.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { step },
        };
        return;
    }

    // Extended Euclid: find x with a·x + m·y = 1.
    let oldR = a;
    let r = m;
    let oldX = 1;
    let x = 0;

    while (r !== 0) {
        const quotient = Math.trunc(oldR / r);
        const nextR = oldR - quotient * r;
        const nextX = oldX - quotient * x;
        yield {
            stepNumber: step,
            entities: makeCells([oldR, r, quotient, oldX, x]),
            edges: [],
            description: `${oldR} = ${quotient}·${r} + ${nextR} (x: ${oldX} → ${nextX}).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { step },
        };
        step += 1;
        oldR = r;
        r = nextR;
        oldX = x;
        x = nextX;
    }

    // Normalize the inverse into [0, m).
    const inverse = ((oldX % m) + m) % m;

    // Show the verification products for a few candidates.
    const values: number[] = [];
    const winner = -1;
    for (let k = 1; k <= m; k += 1) {
        values.push((a * k) % m);
        if ((a * k) % m === 1) {
            // This is the inverse; mark it.
            break;
        }
    }

    const winnerIndex = values.indexOf(1);

    yield {
        stepNumber: step,
        entities: makeCells(values, winnerIndex >= 0 ? winnerIndex : winner),
        edges: [],
        description: `The inverse of ${a} modulo ${m} is ${inverse}, since ${a}·${inverse} ≡ 1 (mod ${m}).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { inverse },
    };
}

/** The Modular Inverse module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "The modular inverse of a modulo m is the number x with a*x = 1 (mod m), analogous to a reciprocal in modular arithmetic. It exists exactly when a and m are coprime. The extended Euclidean algorithm produces Bezout coefficients a*x + m*y = 1, and reducing x modulo m gives the inverse directly.",
        "invariants": [
            "An inverse exists only when gcd(a, m) = 1.",
            "The Bezout coefficient x satisfies a*x = 1 modulo m.",
            "The reported inverse lies in the range 0 to m-1."
        ],
        "correctness": "Extended Euclid yields integers x and y with a*x + m*y = gcd(a, m) = 1. Taking this modulo m drops the m*y term, leaving a*x = 1 (mod m), so x is an inverse. Any negative coefficient is normalized by adding m, which preserves the congruence.",
        "complexityRationale": "Computing the Bezout coefficients takes O(log min(a, m)) Euclidean steps with constant work each. Only a few integer variables are stored, giving O(1) space.",
        "uses": [
            "Implementing division in modular arithmetic",
            "RSA private key computation",
            "CRT and ElGamal decryption steps"
        ],
        "references": [
            "Cormen et al., Introduction to Algorithms, Section 31.2",
            "Knuth, The Art of Computer Programming, Vol. 2, Section 4.5.2"
        ],
        "workedExample": "For a = 3 and m = 11, extended Euclid gives 3*4 + 11*(-1) = 1. Therefore 3*4 = 12 = 1 mod 11 and the inverse of 3 modulo 11 is 4."
    },
    id: "modular-inverse",
    name: "Modular Inverse",
    category: "math",
    complexity: { time: "O(log min(a, m))", space: "O(1)" },
    // The inverse of 3 mod 11 is 4 (3·4 = 12 ≡ 1).
    defaultInput: { a: 3, m: 11 },
    visualType: "grid",
    run,
    pseudocode: [
        "state the goal: a⁻¹ mod m",
        "no inverse exists unless gcd(a, m) = 1",
        "run Euclid while tracking the x-coefficients",
        "normalize a negative coefficient into 0..m−1",
        "done: a·inverse ≡ 1 (mod m)",
    ],
};

export default module;
