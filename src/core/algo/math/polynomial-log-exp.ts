/**
 * polynomial-log-exp.ts – Polynomial Logarithm and Exponential
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The formal logarithm and exponential of a power series generalise the usual
 * series:
 *
 *   ln(A(x)) = ∫ A'(x) / A(x) dx
 *   exp(A(x)) = Σ A(x)^k / k!
 *
 * Both are built on the fundamental operations: the log uses the derivative,
 * the multiplicative inverse, and the integral; the exp uses the integral,
 * the derivative, and a differential-equation iteration. These are the final
 * bricks of the "polynomial toolkit".
 *
 * This educational version demonstrates the structure with naive polynomial
 * arithmetic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n²) naive; O(n log n) with NTT
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The input coefficients are shown as bars.
 *   - The derivative/integral steps are narrated.
 *   - The final log/exp coefficients are highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Everything is a composition of inverse/derivative/integral."
 *   - The pairing of an operation and its inverse is the teaching point.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a set of bar entities for an array of coefficients.
 *
 * @param coeffs The polynomial coefficients.
 * @param states Optional index → state overrides.
 * @returns Bar entities.
 */
function makeBars(coeffs: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return coeffs.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(2),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Multiply two polynomials (naive). */
function multiply(a: number[], b: number[]): number[] {
    const result = new Array<number>(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) {
            result[i + j] = (result[i + j] ?? 0) + (a[i] ?? 0) * (b[j] ?? 0);
        }
    }
    return result;
}

/** Polynomial derivative. */
function derivative(a: number[]): number[] {
    return a.slice(1).map((c, i) => c * (i + 1));
}

/** Polynomial integral (constant term 0). */
function integral(a: number[]): number[] {
    const result = [0];
    for (let i = 0; i < a.length; i += 1) {
        result.push((a[i] ?? 0) / (i + 1));
    }
    return result;
}

/**
 * The Polynomial Log/Exp generator.
 *
 * @param input `{ coeffs }` – the coefficients of A(x).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { coeffs?: number[] } | null) ?? {};
    const coeffs = task.coeffs ?? [1, 1, 0, 1];

    let step = 0;

    // Frame 0: the input polynomial.
    yield {
        stepNumber: step,
        entities: makeBars(coeffs),
        edges: [],
        description: `Formal log and exp of A(x) = ${coeffs.map((c, i) => `${c}x^${i}`).join(" + ")}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {},
    };
    step += 1;

    // ------------------------------------------------------------------
    // Derivative and integral narration.
    // ------------------------------------------------------------------
    const deriv = derivative(coeffs);
    yield {
        stepNumber: step,
        entities: makeBars(deriv),
        edges: [],
        description: `Derivative A'(x) = ${deriv.map((c, i) => `${c.toFixed(0)}x^${i}`).join(" + ")}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: {},
    };
    step += 1;

    // Compute a coarse inverse of A (mod x^n) via Newton (copied pattern).
    let inv = [1 / (coeffs[0] ?? 1)];
    let len = 1;
    while (len < coeffs.length) {
        len = Math.min(len * 2, coeffs.length);
        const A = coeffs.slice(0, len);
        const B = [...inv];
        while (B.length < len) {
            B.push(0);
        }
        const AB = multiply(A, B);
        const twoMinusAB = [2, ...AB.slice(1).map((v) => -v)];
        inv = multiply(B, twoMinusAB).slice(0, len);
    }

    // ln(A) = integral(A' · inv(A)).
    const quotient = multiply(deriv, inv).slice(0, coeffs.length);
    const logA = integral(quotient).slice(0, coeffs.length);

    yield {
        stepNumber: step,
        entities: makeBars(logA),
        edges: [],
        description: `ln(A(x)) = ∫ A'(x)/A(x) dx ≈ ${logA.map((c, i) => `${c.toFixed(2)}x^${i}`).join(" + ")}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {},
    };
    step += 1;

    // exp: iterate E ← E + (A − ln(E))·E a few times (naive Newton).
    let exp = [1];
    for (let round = 0; round < 3; round += 1) {
        // Approximate ln(exp) by its first few terms.
        const lenE = Math.min(exp.length, coeffs.length);
        const eInv = [1 / (exp[0] ?? 1)];
        let el = 1;
        while (el < lenE) {
            el = Math.min(el * 2, lenE);
            const B = [...eInv];
            while (B.length < el) {
                B.push(0);
            }
            const EB = multiply(exp.slice(0, el), B);
            const twoMinus = [2, ...EB.slice(1).map((v) => -v)];
            eInv.length = 0;
            eInv.push(...multiply(B, twoMinus).slice(0, el));
        }
        const lnE = integral(multiply(derivative(exp.slice(0, lenE)), eInv).slice(0, lenE)).slice(
            0,
            lenE,
        );
        const diff = coeffs.slice(0, lenE).map((c, i) => c - (lnE[i] ?? 0));
        exp = multiply(exp, [1, ...diff.slice(1)]).slice(0, lenE);
    }

    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < exp.length; i += 1) {
        finalStates.set(i, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeBars([...exp, ...new Array(coeffs.length - exp.length).fill(0)], finalStates),
        edges: [],
        description: `exp(A(x)) ≈ ${exp.map((c, i) => `${c.toFixed(2)}x^${i}`).join(" + ")}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { exp },
    };
}

/** The Polynomial Log/Exp module, registered with the engine. */
const module: AlgorithmModule = {
    id: "polynomial-log-exp",
    name: "Polynomial Log/Exp",
    category: "math",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // A(x) = 1 + x + x³, a nice test of both operations.
    defaultInput: { coeffs: [1, 1, 0, 1] },
    visualType: "array",
    run,
};

export default module;
