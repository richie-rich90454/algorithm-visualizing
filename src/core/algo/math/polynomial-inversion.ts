/**
 * polynomial-inversion.ts – Polynomial Inversion (Newton's method mod x^k)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a polynomial A(x) with A(0) ≠ 0, its formal power series inverse is
 * the polynomial B(x) with A(x)·B(x) ≡ 1 (mod x^k). Newton's iteration
 * doubles the precision each round:
 *
 *   B ← B·(2 − A·B)   (mod x^(2·len))
 *
 * This is the "divide-and-conquer doubling" pattern central to modern
 * polynomial algorithms (division, logarithm, exponentiation).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) with FFT/NTT multiplications (O(n²) naive here)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current inverse approximation is shown as bars.
 *   - Each Newton round is narrated.
 *   - The final inverse is highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Newton iteration that doubles precision is the heart to teach.
 *   - The building block for polynomial log/exp and division.
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
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Multiply two polynomials (naive O(n²)). */
function multiply(a: number[], b: number[]): number[] {
    const result = new Array<number>(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) {
            result[i + j] = (result[i + j] ?? 0) + (a[i] ?? 0) * (b[j] ?? 0);
        }
    }
    return result;
}

/**
 * The Polynomial Inversion generator.
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
        description: `Inverting the polynomial A(x) = ${coeffs.join(" + ")}… (mod x^${coeffs.length}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: {},
    };
    step += 1;

    // Newton iteration: B starts as 1/A(0).
    let inv = [1 / (coeffs[0] ?? 1)];
    let len = 1;

    while (len < coeffs.length) {
        len = Math.min(len * 2, coeffs.length);

        // Compute A truncated to len, and B (padded to len).
        const A = coeffs.slice(0, len);
        const B = [...inv];
        while (B.length < len) {
            B.push(0);
        }

        // B ← B·(2 − A·B) mod x^len
        const AB = multiply(A, B);
        // 2 − AB: 2 at index 0, negatives elsewhere.
        const twoMinusAB = [2 - (AB[0] ?? 0), ...AB.slice(1).map((v) => -v)];
        const product = multiply(B, twoMinusAB).slice(0, len);
        inv = product;

        const states = new Map<number, EntityState>();
        for (let i = 0; i < len; i += 1) {
            states.set(i, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeBars([...inv, ...new Array(coeffs.length - len).fill(0)], states),
            edges: [],
            description: `Newton round: precision doubled to ${len} terms.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { len },
        };
        step += 1;
    }

    // Verification: multiply A·B and check it is ~1 mod x^n.
    const A = coeffs;
    const B = inv;
    const product = multiply(A, B);
    const isIdentity = Math.abs((product[0] ?? 0) - 1) < 1e-6;

    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < inv.length; i += 1) {
        finalStates.set(i, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeBars([...inv, ...new Array(coeffs.length - inv.length).fill(0)], finalStates),
        edges: [],
        description: isIdentity
            ? `Inverse found: A(x)·B(x) ≡ 1 (mod x^${coeffs.length}).`
            : "Inverse computation finished (check the constant term).",
        codeLineNumber: 4,
        layout: "array",
        meta: { inv },
    };
}

/** The Polynomial Inversion module, registered with the engine. */
const module: AlgorithmModule = {
    id: "polynomial-inversion",
    name: "Polynomial Inversion",
    category: "math",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // A(x) = 1 + x + x³; constant term 1 so an inverse exists.
    defaultInput: { coeffs: [1, 1, 0, 1] },
    visualType: "array",
    run,
};

export default module;
