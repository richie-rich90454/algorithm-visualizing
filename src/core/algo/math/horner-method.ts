/**
 * horner-method.ts - Horner's Method for Polynomial Evaluation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Horner's method rewrites a polynomial a_0 + a_1*x + ... + a_n*x^n as the
 * nested expression a_0 + x*(a_1 + x*(a_2 + ... + x*a_n)). Evaluating from the
 * inside out uses exactly n multiplications and n additions, far fewer than
 * computing each power of x separately. The same nesting is synthetic
 * division when x is used to divide out a linear factor.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a degree-n polynomial
 *   Space: O(1) for the running accumulator
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each coefficient is a bar in an array, processed from highest degree down.
 *   - The coefficient being folded in is YELLOW (comparing).
 *   - Consumed coefficients are GREEN (sorted); the final frame reports p(x).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(
    coefficients: number[],
    states: Map<number, EntityState>,
    active: number,
): VisualEntity[] {
    return coefficients.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(i) ?? (i === active ? "comparing" : "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, degree: i, coefficient: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { coefficients?: number[]; x?: number } | null) ?? {};
    const coefficients = task.coefficients ?? [2, -3, 0, 4, 1];
    const x = typeof task.x === "number" ? task.x : 2;
    const n = coefficients.length;

    if (n === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "An empty coefficient list represents the zero polynomial.",
            codeLineNumber: 0,
            layout: "array",
            meta: { value: 0, x, multiplications: 0, additions: 0 },
        };
        return;
    }

    let acc = coefficients[n - 1]!;
    let multiplications = 0;
    let additions = 0;
    let step = 0;
    const states = new Map<number, EntityState>([[n - 1, "sorted" as EntityState]]);
    yield {
        stepNumber: step,
        entities: makeBars(coefficients, states, -1),
        edges: [],
        description: `Evaluating a degree-${n - 1} polynomial at x = ${x} with Horner's method.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { value: acc, x, multiplications, additions, degree: n - 1 },
    };
    step += 1;

    for (let i = n - 2; i >= 0; i -= 1) {
        const before = acc;
        acc = acc * x + (coefficients[i] ?? 0);
        multiplications += 1;
        additions += 1;
        states.set(i, "sorted" as EntityState);
        yield {
            stepNumber: step,
            entities: makeBars(coefficients, states, i),
            edges: [],
            description: `Fold coefficient ${coefficients[i]}: (${before}) * ${x} + ${coefficients[i]} = ${acc}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                value: acc,
                x,
                multiplications,
                additions,
                coefficient: coefficients[i],
                degree: i,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(coefficients, new Map(coefficients.map((_, i) => [i, "sorted" as EntityState])), -1),
        edges: [],
        description: `Horner's method gives p(${x}) = ${acc} using ${multiplications} multiplications.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { value: acc, x, multiplications, additions, degree: n - 1 },
    };
}

/** The Horner polynomial evaluation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than computing every power of x from scratch, Horner's method nests the polynomial so each new coefficient is folded in with one multiply and one add. Starting from the leading coefficient, the running value is always the value of the polynomial formed by the coefficients seen so far, evaluated at the same x.",
        invariants: [
            "After processing down to degree i, the accumulator equals the truncated polynomial a_i + a_{i+1}*x + ... + a_n*x^(n-i).",
            "Exactly one multiplication and one addition are performed per coefficient folded in.",
            "Consumed coefficients are never read again.",
            "The final accumulator equals the polynomial evaluated at x.",
        ],
        correctness:
            "Induct on the number of processed coefficients. The accumulator starts at a_n, which is the trailing polynomial of degree zero. Assuming the accumulator holds the trailing polynomial from i+1 onward, multiplying by x shifts every exponent up by one and adding a_i supplies the new constant term, so the invariant holds for i. At i = zero the accumulator is the whole polynomial, proving correctness.",
        complexityRationale:
            "The loop runs once for each of the n lower-degree coefficients, and each iteration does a single multiply and add, giving O(n) time. Only the accumulator and loop index are stored, so the space is O(1).",
        uses: [
            "Evaluating polynomials inside numerical libraries and graphics shaders",
            "Synthetic division of a polynomial by a linear factor",
            "Converting between positional number bases",
        ],
        references: [
            "Horner, A New Method of Solving Numerical Equations, 1819",
            "Knuth, The Art of Computer Programming Volume 2, Section 4.2.2",
        ],
        workedExample:
            "For coefficients 2, -3, 0, 4, 1 and x = 2, start with the leading coefficient 1. Fold in 4 to get 6, then 0 to get 12, then -3 to get 21, then 2 to get 44. Direct evaluation 2 - 6 + 0 + 32 + 16 also gives 44, using four multiplications and four additions in Horner's scheme.",
    },
    id: "horner-method",
    name: "Horner's Method",
    category: "math",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { coefficients: [2, -3, 0, 4, 1], x: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "set the accumulator to the leading coefficient",
        "for i from n-1 down to zero",
        "multiply the accumulator by x and add coefficient i",
        "record the new accumulator value",
        "done: return the accumulator as the polynomial value",
    ],
};

export default module;
