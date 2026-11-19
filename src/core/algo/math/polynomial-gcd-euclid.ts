/**
 * polynomial-gcd-euclid.ts - Euclidean GCD of Polynomials.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Computes the greatest common divisor of two polynomials over a prime field
 * by the Euclidean algorithm: divide one polynomial by the other, replace the
 * pair by the divisor and the remainder, and repeat until the remainder is
 * zero. The last nonzero divisor, scaled to be monic, is the gcd.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d^2) field operations for polynomials of degree at most d
 *   Space: O(d) for the coefficient arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid table shows the current dividend, divisor, and remainder.
 *   - The remainder row is highlighted after each polynomial division.
 *   - The final frame reports the monic gcd and verifies it divides both inputs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PolyGcdInput {
    p?: number[];
    q?: number[];
}

const PRIME = 1000003;

function mod(value: number): number {
    return ((value % PRIME) + PRIME) % PRIME;
}

function trim(poly: number[]): number[] {
    const result = poly.map(mod);
    let end = result.length - 1;
    while (end >= 0 && result[end] === 0) {
        end -= 1;
    }
    return result.slice(0, end + 1);
}

function degree(poly: number[]): number {
    return trim(poly).length - 1;
}

function power(base: number, exponent: number): number {
    let result = 1;
    let b = mod(base);
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) {
            result = mod(result * b);
        }
        b = mod(b * b);
        e = Math.floor(e / 2);
    }
    return result;
}

function inverse(value: number): number {
    return power(value, PRIME - 2);
}

function remainder(dividend: number[], divisor: number[]): number[] {
    let current = trim(dividend);
    const divisorTrimmed = trim(divisor);
    const divisorDegree = degree(divisorTrimmed);
    if (divisorDegree < 0) {
        return current;
    }
    const divisorLead = divisorTrimmed[divisorDegree] ?? 1;
    let guard = 0;
    while (degree(current) >= divisorDegree && guard < 1000) {
        const currentDegree = degree(current);
        const factor = mod((current[currentDegree] ?? 0) * inverse(divisorLead));
        const shift = currentDegree - divisorDegree;
        const next = current.slice();
        for (let i = 0; i <= divisorDegree; i += 1) {
            next[i + shift] = mod((next[i + shift] ?? 0) - factor * (divisorTrimmed[i] ?? 0));
        }
        current = trim(next);
        guard += 1;
    }
    return current;
}

function monic(poly: number[]): number[] {
    const trimmed = trim(poly);
    if (trimmed.length === 0) {
        return [];
    }
    const factor = inverse(trimmed[trimmed.length - 1] ?? 1);
    return trim(trimmed.map((coefficient) => mod(coefficient * factor)));
}

function show(poly: number[]): string {
    const trimmed = trim(poly);
    if (trimmed.length === 0) {
        return "0";
    }
    const terms: string[] = [];
    for (let i = trimmed.length - 1; i >= 0; i -= 1) {
        const coefficient = trimmed[i] ?? 0;
        if (coefficient === 0) {
            continue;
        }
        if (i === 0) {
            terms.push(String(coefficient));
        } else if (i === 1) {
            terms.push(`${coefficient}x`);
        } else {
            terms.push(`${coefficient}x^${i}`);
        }
    }
    return terms.join(" + ") || "0";
}

function table(a: number[], b: number[], r: number[], iteration: number, done: boolean): VisualEntity[] {
    const rows: Array<{ field: string; value: string }> = [
        { field: "iteration", value: String(iteration) },
        { field: "dividend", value: show(a) },
        { field: "divisor", value: show(b) },
        { field: "remainder", value: show(r) },
    ];
    return rows.map((row, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: `${row.field}: ${row.value}`,
        value: row.value,
        state: (done ? "sorted" : i === 3 ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: i, col: 0, field: row.field },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PolyGcdInput | null) ?? {};
    const p = Array.isArray(task.p) ? task.p : [-1, 0, 1];
    const q = Array.isArray(task.q) ? task.q : [-1, 1];
    let a = trim(p);
    let b = trim(q);
    let step = 0;

    yield {
        stepNumber: step,
        entities: table(a, b, [], 0, false),
        edges: [],
        description: `Compute the polynomial gcd of (${show(a)}) and (${show(b)}) over the prime field modulo ${PRIME}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 4, cols: 1, p: show(a), q: show(b), prime: PRIME },
    };
    step += 1;

    let iteration = 0;
    let r: number[] = [];
    while (degree(b) >= 0) {
        r = remainder(a, b);
        iteration += 1;
        yield {
            stepNumber: step,
            entities: table(a, b, r, iteration, false),
            edges: [],
            description: `Iteration ${iteration}: (${show(a)}) mod (${show(b)}) = (${show(r)}).`,
            codeLineNumber: degree(r) >= 0 ? 2 : 3,
            layout: "grid",
            meta: { rows: 4, cols: 1, a: show(a), b: show(b), r: show(r), remainderDegree: degree(r), iteration },
        };
        step += 1;
        a = b;
        b = r;
        if (iteration >= 100) {
            break;
        }
    }

    const result = monic(a);
    const dividesP = remainder(p, result).length === 0;
    const dividesQ = remainder(q, result).length === 0;
    yield {
        stepNumber: step,
        entities: table(a, b, result, iteration, true),
        edges: [],
        description: `Done: monic gcd = (${show(result)}); it divides both input polynomials.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 4, cols: 1, result: show(result), resultDegree: degree(result), dividesP, dividesQ },
    };
}

const module: AlgorithmModule = {
    id: "polynomial-gcd-euclid",
    name: "Polynomial GCD (Euclid)",
    category: "math",
    complexity: { time: "O(d^2)", space: "O(d)" },
    defaultInput: { p: [-1, 0, 1], q: [-1, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "write both polynomials with coefficients low degree first",
        "while the divisor is not the zero polynomial",
        "compute the remainder of the dividend divided by the divisor",
        "replace the pair by the divisor and that remainder",
        "when the remainder is zero the last divisor is the gcd",
        "scale it to be monic and return it",
    ],
    education: {
        intuition:
            "The Euclidean algorithm works for polynomials just as it does for integers. Dividing one polynomial by another leaves a remainder of smaller degree; repeatedly swapping divisor and remainder shrinks the degree until it cannot shrink further, and that last divisor is the greatest common divisor.",
        invariants: [
            "Each remainder has strictly smaller degree than its divisor.",
            "The gcd of the current pair equals the gcd of the original pair at every step.",
            "Making the final divisor monic does not change which polynomials it divides.",
        ],
        correctness:
            "Polynomial long division guarantees gcd(a, b) equals gcd(b, a mod b) because a mod b differs from a by a multiple of b. Repeated application reduces degree until the remainder is zero, at which point the nonzero divisor divides both originals and any common divisor must divide it, so it is the monic gcd.",
        complexityRationale:
            "Each division of polynomials of degree at most d costs O(d^2) field operations, and there are at most d steps, giving a bound that is quadratic in the degree. Coefficient arrays of length at most d are the only storage, so space is O(d).",
        uses: [
            "Reducing rational functions in computer algebra systems",
            "Computing square-free factorizations of polynomials",
            "Constructing finite fields and error-correcting codes",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 2, Section 4.6.1",
            "Wikipedia, Polynomial greatest common divisor",
        ],
        workedExample:
            "For p = x^2 - 1 and q = x - 1, dividing p by q leaves remainder zero, so the last divisor is x - 1. Making it monic gives x - 1, which indeed divides both polynomials.",
    },
};

export default module;
