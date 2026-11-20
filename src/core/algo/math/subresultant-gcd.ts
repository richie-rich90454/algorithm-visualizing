/**
 * subresultant-gcd.ts - Polynomial GCD by the subresultant PRS.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Euclidean algorithm over integer polynomials suffers exponential
 * coefficient growth. This subresultant-family method computes a
 * pseudo-remainder at each step and divides it exactly by its content, keeping
 * coefficients small while staying entirely in the integers. The last
 * nonzero remainder, made primitive, is the gcd over the rationals.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d^2) integer operations for polynomials of degree at most d
 *   Space: O(d) coefficients per remainder
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row of the grid is one polynomial in the remainder sequence.
 *   - Each column is a coefficient, from the constant term upward.
 *   - The newly produced remainder is highlighted on each step.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Poly = bigint[];

const trim = (p: Poly): Poly => {
    const q = p.slice();
    while (q.length > 1 && q[q.length - 1] === 0n) q.pop();
    return q;
};
const isZero = (p: Poly): boolean => p.every((c) => c === 0n);
const degree = (p: Poly): number => trim(p).length - 1;
const leading = (p: Poly): bigint => trim(p)[trim(p).length - 1] ?? 0n;
const scale = (p: Poly, s: bigint): Poly => p.map((c) => c * s);
const gcdBig = (a: bigint, b: bigint): bigint => {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
};

/** Pseudo-remainder: lc(B)^(deg A - deg B + 1) * A mod B, with integer coefficients. */
function pseudoRemainder(a: Poly, b: Poly): Poly {
    let r = trim(a);
    const bp = trim(b);
    const lcB = leading(bp);
    const n = degree(bp);
    let guard = 0;
    while (!isZero(r) && degree(r) >= n && guard < 1000) {
        r = trim(r);
        const lcR = leading(r);
        const shift = degree(r) - n;
        const term: Poly = new Array(shift).fill(0n).concat(scale(bp, lcR));
        const scaled: Poly = scale(r, lcB);
        const next: Poly = [];
        for (let i = 0; i < Math.max(scaled.length, term.length); i += 1) {
            next.push((scaled[i] ?? 0n) - (term[i] ?? 0n));
        }
        r = trim(next);
        guard += 1;
    }
    return r;
}

function primitivePart(p: Poly): Poly {
    const q = trim(p);
    if (isZero(q)) return [0n];
    let content = 0n;
    for (const c of q) content = gcdBig(content, c);
    let result = q.map((c) => c / content);
    if (leading(result) < 0n) result = scale(result, -1n);
    return trim(result);
}

/** The primitive pseudo-remainder sequence, ending at the primitive gcd.
 *  Each pseudo-remainder is divided exactly by its content, the standard
 *  subresultant-family normalization that keeps coefficients small. */
function subresultantSequence(a: Poly, b: Poly): { sequence: Poly[]; gcd: Poly } {
    let r0 = trim(a);
    let r1 = trim(b);
    if (degree(r0) < degree(r1)) [r0, r1] = [r1, r0];
    if (isZero(r1)) return { sequence: [r0], gcd: primitivePart(r0) };

    const sequence: Poly[] = [r0, r1];
    let guard = 0;
    while (degree(r1) > 0 && guard < 200) {
        const prem = pseudoRemainder(r0, r1);
        if (isZero(prem)) break;
        const r2 = primitivePart(prem);
        sequence.push(r2);
        r0 = r1;
        r1 = r2;
        guard += 1;
    }
    return { sequence, gcd: primitivePart(r1) };
}

const showPoly = (p: Poly): string => {
    const q = trim(p);
    const terms: string[] = [];
    for (let i = q.length - 1; i >= 0; i -= 1) {
        const c = q[i] ?? 0n;
        if (c === 0n) continue;
        const sign = c < 0n ? "-" : terms.length > 0 ? "+" : "";
        const mag = c < 0n ? -c : c;
        const variable = i === 0 ? "" : i === 1 ? "x" : `x^${i}`;
        const coeff = mag === 1n && i > 0 ? "" : `${mag}`;
        terms.push(`${sign} ${coeff}${variable}`.trim());
    }
    return terms.join(" ") || "0";
};

function frameFor(
    sequence: Poly[],
    activeIndex: number,
    step: number,
    description: string,
    codeLine: number,
    gcdCoefficients?: string[],
): VisualFrame {
    const entities: VisualEntity[] = [];
    let cols = 1;
    for (let row = 0; row < sequence.length; row += 1) {
        const p = sequence[row] ?? [0n];
        for (let col = 0; col < p.length; col += 1) {
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: String(p[col] ?? 0n),
                value: String(p[col] ?? 0n),
                state: (row === activeIndex ? "active" : "idle") as EntityState,
                x: col,
                y: row,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
        cols = Math.max(cols, p.length);
    }
    return {
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "grid",
        meta: {
            rows: sequence.length,
            cols,
            sequence: sequence.map(showPoly),
            activeRow: activeIndex,
            gcdCoeffs: gcdCoefficients ?? [],
        },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number[]; b?: number[] } | null) ?? {};
    const a: Poly = (task.a ?? [3, 0, 1, 1]).map((n) => BigInt(n));
    const b: Poly = (task.b ?? [1, 1, 1]).map((n) => BigInt(n));
    const { sequence, gcd } = subresultantSequence(a, b);

    let step = 0;
    yield frameFor(sequence.slice(0, 2), 1, step++, `Starting with A = ${showPoly(a)} and B = ${showPoly(b)}.`, 0);

    for (let i = 2; i < sequence.length; i += 1) {
        yield frameFor(
            sequence.slice(0, i + 1),
            i,
            step++,
            `Primitive subresultant step ${i - 1}: remainder ${showPoly(sequence[i] ?? [0n])}.`,
            2,
        );
    }

    const finalSequence = sequence.slice();
    finalSequence.push(gcd);
    yield frameFor(finalSequence, finalSequence.length - 1, step, `Primitive gcd: ${showPoly(gcd)}.`, 5, gcd.map(String));
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Dividing integer polynomials normally creates huge fractions. Pseudo-remainders stay integral, and the subresultant sequence removes just enough of the growing factor at each step so coefficients stay small while the exact gcd is preserved.",
        invariants: [
            "Dividing a pseudo-remainder by its content is exact and leaves a primitive polynomial.",
            "Consecutive remainders have the same gcd as the original pair over the rationals.",
            "The degrees of the remainders strictly decrease.",
        ],
        correctness:
            "Pseudo-division multiplies by powers of the divisor's leading coefficient, which does not change the gcd over a field. Dividing by the content removes only a constant integer factor, so each remainder remains in the same gcd class. The degree drops at every step, so the last nonzero remainder is a gcd; taking its primitive part with positive leading coefficient gives the canonical integer answer.",
        complexityRationale:
            "With d the maximum degree, each pseudo-remainder costs O(d^2) big-integer operations and there are O(d) remainders, giving O(d^2) arithmetic; the exact divisions keep coefficient size polynomial rather than exponential.",
        uses: [
            "Computer algebra systems computing polynomial gcds over the integers",
            "Square-free factorization of polynomials",
            "Resultant and subresultant computation for elimination",
        ],
        references: [
            "Knuth, The Art of Computer Programming Vol. 2, section 4.6.1",
            "Geddes, Czapor and Labahn, Algorithms for Computer Algebra, chapter 7",
        ],
        workedExample:
            "For A = x^3 + x + 1 and B = x^2 + 1 in integer coefficients, pseudo-division yields a linear remainder, and the subresultant factor divides it exactly. The primitive part of the last nonzero remainder is the gcd (here 1 when the polynomials are coprime).",
    },
    id: "subresultant-gcd",
    name: "Subresultant Polynomial GCD",
    category: "math",
    complexity: { time: "O(d^2) integer operations", space: "O(d^2)" },
    defaultInput: { a: [3, 0, 1, 1], b: [1, 1, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "given integer polynomials A and B",
        "set R0 to the higher-degree polynomial and R1 to the other",
        "while R1 is not constant and not zero",
        "compute the integer pseudo-remainder prem(R0, R1)",
        "set R2 := prem(R0, R1) divided by its content",
        "shift R0 := R1 and R1 := R2",
        "make R1 primitive and report it as the gcd",
    ],
};

export default module;
