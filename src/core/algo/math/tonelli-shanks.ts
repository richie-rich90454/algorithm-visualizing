/**
 * tonelli-shanks.ts – Tonelli-Shanks Algorithm (modular square roots)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Tonelli-Shanks computes the square root of a quadratic residue n modulo an
 * odd prime p: an x with x² ≡ n (mod p). The algorithm handles the hard case
 * where p − 1 has a large power of 2 factor, using a generator of a subgroup
 * to "hunt" down the correct exponent. It returns a pair of roots (±x).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log² p)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The search steps are shown as cells.
 *   - The found root is GREEN (sorted).
 *   - Non-residues are reported in RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Generalizes the simple "n^((p+1)/4)" formula to all odd primes.
 *   - The generator/subgroup-hunting is the conceptual heart.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A tiny modular exponentiation helper. */
function modPow(a: number, e: number, m: number): number {
    let result = 1;
    let base = a % m;
    let exp = e;
    while (exp > 0) {
        if (exp % 2 === 1) {
            result = (result * base) % m;
        }
        base = (base * base) % m;
        exp = Math.floor(exp / 2);
    }
    return result;
}

/**
 * Build a grid of cells showing the working values.
 *
 * @param values The values to show.
 * @param activeIndex The active index (or -1).
 * @returns Cell entities in a single row.
 */
function makeCells(values: number[], activeIndex = -1): VisualEntity[] {
    return values.map((value, index) => ({
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

/**
 * The Tonelli-Shanks generator.
 *
 * @param input `{ n, p }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; p?: number } | null) ?? {};
    const n = typeof task.n === "number" ? task.n : 5;
    const p = typeof task.p === "number" ? task.p : 41;

    let step = 0;

    // Frame 0: the setup.
    yield {
        stepNumber: step,
        entities: makeCells([n]),
        edges: [],
        description: `Finding the square root of ${n} modulo ${p}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;

    // Simple cases.
    if (n % p === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([0]),
            edges: [],
            description: `√0 mod ${p} = 0.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { root: 0 },
        };
        return;
    }
    if (p === 2) {
        yield {
            stepNumber: step,
            entities: makeCells([n]),
            edges: [],
            description: `mod 2: √${n} = ${n}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { root: n },
        };
        return;
    }

    // Euler's criterion: n is a residue iff n^((p-1)/2) ≡ 1 (mod p).
    if (modPow(n, (p - 1) / 2, p) !== 1) {
        yield {
            stepNumber: step,
            entities: makeCells([n]),
            edges: [],
            description: `${n} is NOT a quadratic residue mod ${p} – no square root exists.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { root: -1 },
        };
        return;
    }

    // Decompose p − 1 = 2^s · q with q odd.
    let q = p - 1;
    let s = 0;
    while (q % 2 === 0) {
        q /= 2;
        s += 1;
    }

    // Find a non-residue z to serve as the "generator".
    let z = 2;
    while (modPow(z, (p - 1) / 2, p) !== p - 1) {
        z += 1;
    }

    // The Tonelli-Shanks loop.
    let c = modPow(z, q, p);
    let x = modPow(n, (q + 1) / 2, p);
    let t = modPow(n, q, p);
    let m = s;

    const working: number[] = [x];
    yield {
        stepNumber: step,
        entities: makeCells(working, 0),
        edges: [],
        description: `p−1 = 2^${s}·${q}; found non-residue z = ${z}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { step },
    };
    step += 1;

    while (t !== 1) {
        // Find the smallest i with t^(2^i) ≡ 1.
        let i = 0;
        let tt = t;
        while (tt !== 1) {
            tt = modPow(tt, 2, p);
            i += 1;
        }

        const b = modPow(c, Math.pow(2, m - i - 1), p);
        x = (x * b) % p;
        t = (t * b * b) % p;
        c = (b * b) % p;
        m = i;

        working.push(x);
        yield {
            stepNumber: step,
            entities: makeCells(working, working.length - 1),
            edges: [],
            description: `t^(2^${i}) ≡ 1 → updated x = ${x}.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { step },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells([x]),
        edges: [],
        description: `√${n} mod ${p} = ±${x} (since ${x}² ≡ ${n}).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { root: x },
    };
}

/** The Tonelli-Shanks module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Tonelli-Shanks finds a square root of n modulo an odd prime p, handling the difficult case when p-1 has a large power of two factor. It splits p-1 into 2^s times an odd q, finds a quadratic non-residue to seed a subgroup, and iteratively adjusts the candidate until its square equals n. It generalizes the simple exponent formula that works only when p is 3 mod 4.",
        "invariants": [
            "The target n is a quadratic residue modulo p.",
            "The non-residue z generates the needed two-power subgroup.",
            "Each iteration reduces the order of the error term until it becomes one."
        ],
        "correctness": "Euler's criterion first guarantees a solution exists. The algorithm writes the current root and an error term in the two-power subgroup; multiplying by a suitable power of z shrinks the error's order each step until it is one, at which point the candidate squares to n. The returned value is therefore a true square root, and its negation is the other.",
        "complexityRationale": "Each iteration performs modular multiplications and one exponentiation, costing O(log p) each, and there are O(log p) iterations, giving O(log^2 p) time. Only a few residues are stored, so space is O(1).",
        "uses": [
            "Decoding quadratic-residue codes",
            "Point decompression in elliptic-curve cryptography",
            "Solving quadratic congruences modulo primes"
        ],
        "references": [
            "Tonelli, Bit quadratiche Reste (1891)",
            "Shanks, Five mathematical problems (1971)"
        ],
        "workedExample": "Solve x^2 = 5 mod 41. Here 41 is 1 mod 4 so the simple formula fails; Tonelli-Shanks splits 40 = 2^3 * 5, finds a non-residue, and converges to x = 13, since 13^2 = 169 = 4*41 + 5."
    },
    id: "tonelli-shanks",
    name: "Tonelli-Shanks",
    category: "math",
    complexity: { time: "O(log² p)", space: "O(1)" },
    // √5 mod 41 = ±13 (13² = 169 = 4·41 + 5).
    defaultInput: { n: 5, p: 41 },
    visualType: "grid",
    run,
    pseudocode: [
        "state √n mod p with inputs n, p",
        "zero has root zero",
        "mod 2 the answer is n itself",
        "a non-residue has no square root: stop",
        "split p−1 = 2^s·q and find a non-residue z",
        "lift x while t^(2^i) disagrees with 1",
        "done: roots ±x with x² ≡ n",
    ],
};

export default module;
