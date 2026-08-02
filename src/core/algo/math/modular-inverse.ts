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
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The candidate products a·x mod m are shown as cells.
 *   - The candidate whose product equals 1 is GREEN (sorted).
 *   - The Bezout computation is narrated.
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
        meta: {},
    };
    step += 1;

    // If not coprime, no inverse exists.
    if (gcd(a, m) !== 1) {
        yield {
            stepNumber: step,
            entities: makeCells([a]),
            edges: [],
            description: `gcd(${a}, ${m}) ≠ 1 – no modular inverse exists.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {},
        };
        return;
    }

    // Extended Euclid: find x with a·x + m·y = 1.
    let oldR = a;
    let r = m;
    let oldX = 1;
    let x = 0;

    while (r !== 0) {
        const quotient = Math.floor(oldR / r);
        const nextR = oldR - quotient * r;
        oldR = r;
        r = nextR;
        const nextX = oldX - quotient * x;
        oldX = x;
        x = nextX;
    }

    // Normalise the inverse into [0, m).
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
    id: "modular-inverse",
    name: "Modular Inverse",
    category: "math",
    complexity: { time: "O(log min(a, m))", space: "O(1)" },
    // The inverse of 3 mod 11 is 4 (3·4 = 12 ≡ 1).
    defaultInput: { a: 3, m: 11 },
    visualType: "grid",
    run,
};

export default module;
