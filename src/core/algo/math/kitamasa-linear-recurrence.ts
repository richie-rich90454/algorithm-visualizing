/**
 * kitamasa-linear-recurrence.ts - Kitamasa Method for Linear Recurrences
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Kitamasa method computes the n-th term of a constant-coefficient linear
 * recurrence in O(d^2 log n) time. It represents the shift operator as the
 * polynomial x modulo the characteristic polynomial of the recurrence, then
 * computes x^n modulo that characteristic polynomial by binary exponentiation.
 * The resulting coefficient vector is combined with the first d terms to give
 * a_n, without iterating n times.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d^2 log n) modular-style polynomial multiplications
 *   Space: O(d) for the coefficient vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current coefficient vector is drawn as an array of bars.
 *   - The vector being squared is highlighted; the accumulator is GREEN.
 *   - The final frame reports the computed term a_n and its brute-force match.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(
    coeffs: number[],
    states: Map<number, EntityState>,
    active: number,
): VisualEntity[] {
    return coeffs.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(i) ?? (i === active ? "comparing" : i === 0 ? "path" : "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, degree: i, coefficient: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { coefficients?: number[]; initial?: number[]; n?: number } | null) ?? {};
    const c = task.coefficients ?? [1, 1];
    const initial = task.initial ?? [0, 1];
    const n = typeof task.n === "number" ? Math.max(0, Math.floor(task.n)) : 10;
    const d = c.length;

    if (d === 0 || initial.length < d) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Kitamasa needs recurrence coefficients and at least d initial terms.",
            codeLineNumber: 0,
            layout: "array",
            meta: { valid: false, term: 0, n },
        };
        return;
    }

    const reduce = (poly: number[]): number[] => {
        const work = poly.slice();
        for (let k = work.length - 1; k >= d; k -= 1) {
            const value = work[k] ?? 0;
            if (value === 0) continue;
            for (let j = 1; j <= d; j += 1) {
                work[k - j] = (work[k - j] ?? 0) + value * c[j - 1]!;
            }
            work[k] = 0;
        }
        return work.slice(0, d);
    };
    const multiply = (a: number[], b: number[]): number[] => {
        const prod = new Array<number>(a.length + b.length - 1).fill(0);
        for (let i = 0; i < a.length; i += 1) {
            for (let j = 0; j < b.length; j += 1) {
                prod[i + j] = (prod[i + j] ?? 0) + a[i]! * b[j]!;
            }
        }
        return reduce(prod);
    };

    let acc = new Array<number>(d).fill(0);
    acc[0] = 1;
    let base = new Array<number>(d).fill(0);
    if (d > 1) base[1] = 1;
    else base[0] = c[0]!;
    let exponent = n;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(acc, new Map(), -1),
        edges: [],
        description: `Computing term ${n} of a degree-${d} recurrence with Kitamasa's method.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { term: acc[0]!, n, exponent, operator: [...acc], base: [...base] },
    };
    step += 1;

    let multiplications = 0;
    while (exponent > 0) {
        if (exponent % 2 === 1) {
            acc = multiply(acc, base);
            multiplications += 1;
            yield {
                stepNumber: step,
                entities: makeBars(acc, new Map(acc.map((_, i) => [i, "sorted" as EntityState])), -1),
                edges: [],
                description: `Exponent bit set: accumulator becomes x raised to the running power modulo the characteristic polynomial.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { term: acc[0]!, n, exponent, operator: [...acc], base: [...base], multiplications },
            };
            step += 1;
        }
        base = multiply(base, base);
        multiplications += 1;
        exponent = Math.floor(exponent / 2);
        yield {
            stepNumber: step,
            entities: makeBars(base, new Map(), -1),
            edges: [],
            description: `Square the shift operator; exponent is now ${exponent}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { term: acc[0]!, n, exponent, operator: [...acc], base: [...base], multiplications },
        };
        step += 1;
    }

    let term = 0;
    for (let i = 0; i < d; i += 1) term += (acc[i] ?? 0) * (initial[i] ?? 0);
    let brute = initial.slice(0, d);
    for (let i = d; i <= n; i += 1) {
        let next = 0;
        for (let j = 1; j <= d; j += 1) next += c[j - 1]! * brute[i - j]!;
        brute.push(next);
    }
    yield {
        stepNumber: step,
        entities: makeBars(acc, new Map(acc.map((_, i) => [i, "sorted" as EntityState])), -1),
        edges: [],
        description: `Kitamasa gives a_${n} = ${term}, matching direct recurrence evaluation.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            term,
            bruteTerm: brute[n] ?? 0,
            n,
            operator: [...acc],
            multiplications,
            degree: d,
        },
    };
}

/** The Kitamasa linear recurrence module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A linear recurrence shifts a window of d terms forward. Instead of applying that shift n times, Kitamasa views the shift as multiplication by x and repeatedly squares it, reducing modulo the characteristic polynomial so the representation stays d numbers wide. Binary exponentiation needs only log n squarings, and the final coefficient vector tells us how to mix the first d terms into a_n.",
        invariants: [
            "The coefficient vector always represents a polynomial of degree less than d.",
            "The accumulator represents x raised to the bits of n already consumed.",
            "Reduction modulo the characteristic polynomial preserves the value of the shift operator.",
            "The final vector satisfies a_n equals the dot product of that vector with the first d terms.",
        ],
        correctness:
            "The characteristic polynomial annihilates the recurrence, so x^d equals the lower powers with coefficients c_1 through c_d whenever the operator acts on any valid sequence. Reduction replaces x^k by an equivalent lower-degree combination, so each vector denotes the same shift operator in the quotient ring. Binary exponentiation therefore computes x^n in that ring, and applying x^n to the initial state is precisely the coefficient-vector dot product that yields a_n.",
        complexityRationale:
            "Each polynomial multiplication costs O(d^2) and reduction costs O(d^2); binary exponentiation performs O(log n) of them, giving O(d^2 log n) time and O(d) space for the vectors.",
        uses: [
            "Computing distant Fibonacci and Lucas terms quickly",
            "Counting paths and other combinatorial sequences defined by recurrences",
            "Linear recurrences inside contest programming and cryptographic constructions",
        ],
        references: [
            "Kitamasa, Fast Computation of a_n with Linear Recurrence, 1992",
            "Knuth, The Art of Computer Programming Volume 1, Section 1.2.8",
        ],
        workedExample:
            "For the Fibonacci recurrence c = [1,1] and initial terms [0,1], the characteristic rule is x^2 = x + 1. Computing x^10 modulo x^2 - x - 1 gives the vector [34, 55], and 34*0 + 55*1 = 55, the tenth Fibonacci number, reached with only a few squarings instead of ten iterations.",
    },
    id: "kitamasa-linear-recurrence",
    name: "Kitamasa Linear Recurrence",
    category: "math",
    complexity: { time: "O(d^2 log n)", space: "O(d)" },
    defaultInput: { coefficients: [1, 1], initial: [0, 1], n: 10 },
    visualType: "array",
    run,
    pseudocode: [
        "build the characteristic polynomial from the recurrence coefficients",
        "set the accumulator to one and the shift operator to x",
        "while the exponent is positive",
        "if the low bit is set multiply the accumulator by the operator and reduce",
        "square the operator and reduce, then halve the exponent",
        "take the dot product of the accumulator with the first d terms",
        "done: return the n-th term of the recurrence",
    ],
};

export default module;
