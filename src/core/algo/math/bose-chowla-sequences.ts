/**
 * bose-chowla-sequences.ts - Bose-Chowla Sidon Sets in Finite Fields
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Sidon set (B_2 sequence) has all pairwise sums distinct. The Bose-Chowla
 * construction builds one of size q inside the cyclic group of order q^2 - 1:
 * choose a primitive element theta of the field GF(q^2), then take the discrete
 * logarithms of theta + a for every element a of the base field GF(q). The
 * basis representation of the field makes distinct unordered pairs of base
 * elements produce distinct field products, hence distinct exponent sums.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(q^2) for the field search and discrete logarithms by enumeration
 *   Space: O(q^2) for exponent and sum tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The Sidon exponents appear in the first row of cells.
 *   - The sum table below it has one row per exponent; duplicates would be RED.
 *   - The final frame reports whether every sum is distinct.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A field element a + b*t in GF(p^2) = GF(p)[t]/(t^2 - r). */
type FieldElement = [number, number];

function fieldAdd(x: FieldElement, y: FieldElement, p: number): FieldElement {
    return [(x[0] + y[0]) % p, (x[1] + y[1]) % p];
}

function fieldMul(x: FieldElement, y: FieldElement, p: number, r: number): FieldElement {
    return [(x[0] * y[0] + x[1] * y[1] * r) % p, (x[0] * y[1] + x[1] * y[0]) % p];
}

function fieldPow(base: FieldElement, exponent: number, p: number, r: number): FieldElement {
    let result: FieldElement = [1, 0];
    let current: FieldElement = [base[0], base[1]];
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) result = fieldMul(result, current, p, r);
        current = fieldMul(current, current, p, r);
        e = Math.floor(e / 2);
    }
    return result;
}

function equalElements(x: FieldElement, y: FieldElement): boolean {
    return x[0] === y[0] && x[1] === y[1];
}

function distinctPrimeFactors(m: number): number[] {
    const factors: number[] = [];
    let rest = m;
    for (let d = 2; d * d <= rest; d += 1) {
        if (rest % d === 0) {
            factors.push(d);
            while (rest % d === 0) rest /= d;
        }
    }
    if (rest > 1) factors.push(rest);
    return factors;
}

/** Find r so that t^2 - r has no root mod p, making the extension a field. */
function findIrreducible(p: number): number {
    for (let r = 1; r < p; r += 1) {
        let hasRoot = false;
        for (let s = 0; s < p; s += 1) {
            if ((s * s) % p === r) {
                hasRoot = true;
                break;
            }
        }
        if (!hasRoot) return r;
    }
    return 1;
}

/** Find a primitive element of GF(p^2) by testing the prime factors of p^2-1. */
function findPrimitive(p: number, r: number): FieldElement {
    const groupOrder = p * p - 1;
    const primes = distinctPrimeFactors(groupOrder);
    for (let b = 1; b < p; b += 1) {
        for (let a = 0; a < p; a += 1) {
            const candidate: FieldElement = [a, b];
            let primitive = true;
            for (const q of primes) {
                const power = fieldPow(candidate, groupOrder / q, p, r);
                if (power[0] === 1 && power[1] === 0) {
                    primitive = false;
                    break;
                }
            }
            if (primitive) return candidate;
        }
    }
    return [0, 1];
}

/** Discrete logarithm by enumeration, valid because theta is primitive. */
function discreteLog(theta: FieldElement, target: FieldElement, p: number, r: number): number {
    const groupOrder = p * p - 1;
    let power: FieldElement = [1, 0];
    for (let k = 0; k < groupOrder; k += 1) {
        if (equalElements(power, target)) return k;
        power = fieldMul(power, theta, p, r);
    }
    return -1;
}

interface BoseResult {
    sidonSet: number[];
    modulus: number;
    r: number;
    theta: FieldElement;
    sums: number[][];
    isSidon: boolean;
    distinctSumCount: number;
}

function construct(p: number): BoseResult {
    const r = findIrreducible(p);
    const theta = findPrimitive(p, r);
    const sidonSet: number[] = [];
    for (let a = 0; a < p; a += 1) {
        const target = fieldAdd(theta, [a, 0], p);
        sidonSet.push(discreteLog(theta, target, p, r));
    }
    const modulus = p * p - 1;
    const sums = sidonSet.map((row) => sidonSet.map((col) => (row + col) % modulus));
    const distinctSumCount = new Set(sums.flat()).size;
    return {
        sidonSet,
        modulus,
        r,
        theta,
        sums,
        isSidon: distinctSumCount === (p * (p + 1)) / 2,
        distinctSumCount,
    };
}

function sumEntities(result: BoseResult): VisualEntity[] {
    const entities: VisualEntity[] = [];
    result.sums.forEach((row, i) => {
        row.forEach((value, j) => {
            const seen = new Map<number, number>();
            for (let a = 0; a < result.sums.length; a += 1) {
                for (let b = 0; b < result.sums.length; b += 1) {
                    if (a === i && b === j) break;
                    seen.set(result.sums[a]![b]!, (seen.get(result.sums[a]![b]!) ?? 0) + 1);
                }
            }
            const duplicate = (seen.get(value) ?? 0) > 0;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: (duplicate ? "error" : i === j ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p?: number } | null) ?? {};
    const p = typeof task.p === "number" ? task.p : 3;
    let step = 0;

    yield {
        stepNumber: step,
        entities: [
            {
                id: "cell-field",
                type: "cell",
                label: `GF(${p * p})`,
                value: p * p,
                state: "highlight",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            },
        ],
        edges: [],
        description: `Building a Bose-Chowla Sidon set of size ${p} in the cyclic group of order ${p * p - 1}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, p, modulus: p * p - 1 },
    };
    step += 1;

    if (p < 3 || p > 13 || !Number.isInteger(p)) {
        yield {
            stepNumber: step,
            entities: [
                {
                    id: "cell-bad",
                    type: "cell",
                    label: "invalid",
                    value: p,
                    state: "error",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: 0, col: 0 },
                },
            ],
            edges: [],
            description: "Need an odd prime p between 3 and 13 for this finite-field construction.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { step, valid: false },
        };
        return;
    }

    const result = construct(p);
    yield {
        stepNumber: step,
        entities: result.sidonSet.map((value, i) => ({
            id: `sidon-${i}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: "comparing" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        })),
        edges: [],
        description: `Primitive element theta = ${result.theta[0]} + ${result.theta[1]}t; the exponents of theta + a give the Sidon set [${result.sidonSet.join(", ")}].`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { step, theta: result.theta, r: result.r, sidonSet: result.sidonSet },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: sumEntities(result),
        edges: [],
        description: `All pairwise sums modulo ${result.modulus} occupy ${result.distinctSumCount} distinct values out of ${(p * (p + 1)) / 2} unordered pairs.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            step,
            sums: result.sums.map((row) => row.join(",")),
            distinctSumCount: result.distinctSumCount,
            expectedPairs: (p * (p + 1)) / 2,
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: result.sidonSet.map((value, i) => ({
            id: `sidon-${i}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: (result.isSidon ? "sorted" : "error") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        })),
        edges: [],
        description: result.isSidon
            ? `Verified: every unordered pair of the ${p} exponents gives a different sum, so the set is Sidon.`
            : `The construction failed the Sidon check; review the primitive element.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            step,
            isSidon: result.isSidon,
            size: result.sidonSet.length,
            modulus: result.modulus,
            sidonSet: result.sidonSet,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Sidon set behaves like a ruler whose pairwise marks never repeat: no two unordered pairs add to the same value. The Bose-Chowla trick transfers the problem into a finite field, where multiplying theta plus a and theta plus b expands to a quadratic whose coefficients uniquely determine the unordered pair a, b. Taking discrete logarithms turns those products into sums, giving a Sidon set in a cyclic group.",
        invariants: [
            "Theta has multiplicative order p^2 - 1, so its powers list every nonzero field element.",
            "The elements theta + a for a in GF(p) are distinct and nonzero.",
            "Each unordered pair of exponents corresponds to a unique unordered pair of base-field elements.",
        ],
        correctness:
            "Suppose two pairs of exponents have the same sum modulo p^2 - 1. Exponentiating gives (theta + a)(theta + b) = (theta + c)(theta + d). Expanding, both sides equal theta squared plus (a+b) theta plus ab. Since one and theta form a basis of GF(p^2) over GF(p), the coefficients match, so a+b = c+d and ab = cd; the pair a, b is therefore the same as c, d as roots of the same quadratic, and the exponent pairs coincide. Thus all sums are distinct.",
        complexityRationale:
            "Finding an irreducible polynomial and a primitive element enumerates at most O(p^2) candidates with O(log p) field multiplications each. Computing q = p discrete logs by enumeration takes O(p * p^2) = O(p^3) field steps, and building the sum table is O(p^2). Space is O(p^2) for the sum table, all bounded because p is a small prime in this visualization.",
        uses: [
            "Constructing sparse rulers and distinct-difference sets",
            "Designing error-correcting codes and frequency-hopping patterns",
            "Building optimal confocal and difference-set based antennas",
        ],
        references: [
            "Bose and Chowla, Theorems in the Additive Theory of Numbers, 1962",
            "Halberstam and Roth, Sequences, Volume 1, Chapter 2",
        ],
        workedExample:
            "For p = 3 the field GF(9) has multiplicative group order eight. Choosing a primitive theta and logging theta + 0, theta + 1 and theta + 2 gives three exponents in Z_8. Their six unordered sums are all distinct, so they form a Sidon set of size three in a group of order eight.",
    },
    id: "bose-chowla-sequences",
    name: "Bose-Chowla Sidon Sequences",
    category: "math",
    complexity: { time: "O(p^3)", space: "O(p^2)" },
    defaultInput: { p: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "input a small prime p and set modulus to p squared minus one",
        "choose r so t squared minus r is irreducible over GF(p)",
        "find a primitive element theta of GF(p squared)",
        "for each a in GF(p) compute theta plus a",
        "find its discrete logarithm base theta",
        "collect the exponents into the Sidon set",
        "form every pairwise sum modulo the group order",
        "done: accept when all unordered sums are distinct",
    ],
};

export default module;
