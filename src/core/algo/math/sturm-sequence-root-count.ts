/**
 * sturm-sequence-root-count.ts - Sturm's Theorem Root Counting.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a real polynomial and an interval (a,b], Sturm's theorem counts the
 * number of distinct real roots in that interval. It builds the Sturm sequence
 * p0 = f, p1 = f', p(k+1) = -remainder(p(k-1), p(k)), then subtracts the number
 * of sign changes of the sequence at b from the number at a.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d^3) polynomial divisions for degree d
 *   Space: O(d^2) for the Sturm polynomials
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid lists each Sturm polynomial with its value at a and at b.
 *   - The sign column drives the running sign-variation count.
 *   - The final frame reports the number of roots in (a,b].
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SturmInput {
    coefficients?: number[];
    a?: number;
    b?: number;
}

function trim(poly: number[]): number[] {
    const copy = poly.slice();
    while (copy.length > 1 && Math.abs(copy[0] ?? 0) < 1e-12) {
        copy.shift();
    }
    return copy;
}

function derivative(poly: number[]): number[] {
    if (poly.length <= 1) {
        return [0];
    }
    return trim(poly.slice(0, -1).map((c, i) => c * (poly.length - 1 - i)));
}

/** Return the remainder of polynomial division of a by b. */
function remainder(a: number[], b: number[]): number[] {
    let r = a.slice();
    const divisor = trim(b);
    const lead = divisor[0] ?? 0;
    while (r.length >= divisor.length && Math.abs(r[0] ?? 0) >= 1e-12) {
        const factor = (r[0] ?? 0) / lead;
        for (let i = 0; i < divisor.length; i += 1) {
            r[i] = (r[i] ?? 0) - factor * (divisor[i] ?? 0);
        }
        r = trim(r);
    }
    return r;
}

function evaluate(poly: number[], x: number): number {
    let value = 0;
    for (const coefficient of poly) {
        value = value * x + coefficient;
    }
    return value;
}

function signChanges(values: number[]): number {
    const signs = values.filter((v) => Math.abs(v) > 1e-10).map((v) => (v > 0 ? 1 : -1));
    let changes = 0;
    for (let i = 1; i < signs.length; i += 1) {
        if (signs[i] !== signs[i - 1]) {
            changes += 1;
        }
    }
    return changes;
}

function makeEntities(
    sequence: number[][],
    a: number,
    b: number,
    done: boolean,
    shown: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < shown; i += 1) {
        const poly = sequence[i] ?? [];
        const atA = evaluate(poly, a);
        const atB = evaluate(poly, b);
        const values: Array<[string, number]> = [
            ["p" + i + "(a)", atA],
            ["p" + i + "(b)", atB],
        ];
        values.forEach(([name, value], col) => {
            entities.push({
                id: `cell-${i}-${col}`,
                type: "cell" as const,
                label: `${name}=${Number.isFinite(value) ? value.toPrecision(6) : value}`,
                value,
                state: (done ? "sorted" : value > 0 ? "active" : "comparing") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SturmInput | null) ?? {};
    const coefficients = Array.isArray(task.coefficients) && task.coefficients.length >= 2
        ? task.coefficients.slice()
        : [1, -6, 11, -6];
    const a = typeof task.a === "number" ? task.a : 0;
    const b = typeof task.b === "number" ? task.b : 4;

    const sequence: number[][] = [trim(coefficients)];
    const firstDerivative = derivative(coefficients);
    if (firstDerivative.length > 1 || Math.abs(firstDerivative[0] ?? 0) > 0) {
        sequence.push(firstDerivative);
    }
    while (sequence.length > 1) {
        const previous = sequence[sequence.length - 2] ?? [];
        const current = sequence[sequence.length - 1] ?? [];
        if (current.length <= 1 && Math.abs(current[0] ?? 0) < 1e-12) {
            break;
        }
        const rem = remainder(previous, current);
        if (rem.length <= 1 && Math.abs(rem[0] ?? 0) < 1e-12) {
            break;
        }
        sequence.push(rem.map((c) => -c));
    }

    yield {
        stepNumber: 0,
        entities: makeEntities(sequence, a, b, false, 1),
        edges: [],
        description: `Built p0, the polynomial whose real roots in (${a}, ${b}] we will count.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: sequence.length, cols: 2, a, b, shown: 1, length: sequence.length },
    };

    for (let i = 1; i < sequence.length; i += 1) {
        yield {
            stepNumber: i,
            entities: makeEntities(sequence, a, b, false, i + 1),
            edges: [],
            description: `Added Sturm polynomial p${i} as the negated remainder of p${i - 2} divided by p${i - 1}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: sequence.length, cols: 2, a, b, shown: i + 1, length: sequence.length },
        };
    }

    const atA = sequence.map((poly) => evaluate(poly, a));
    const atB = sequence.map((poly) => evaluate(poly, b));
    const variationsA = signChanges(atA);
    const variationsB = signChanges(atB);
    const count = variationsA - variationsB;
    yield {
        stepNumber: sequence.length,
        entities: makeEntities(sequence, a, b, true, sequence.length),
        edges: [],
        description: `Done: sign variations are ${variationsA} at ${a} and ${variationsB} at ${b}, so (${a}, ${b}] holds ${count} distinct real root(s).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: sequence.length,
            cols: 2,
            a,
            b,
            shown: sequence.length,
            variationsA,
            variationsB,
            count,
        },
    };
}

const module: AlgorithmModule = {
    id: "sturm-sequence-root-count",
    name: "Sturm Root Counting",
    category: "math",
    complexity: { time: "O(d^3)", space: "O(d^2)" },
    defaultInput: { coefficients: [1, -6, 11, -6], a: 0, b: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "set p0 to the polynomial f and p1 to its derivative",
        "while the next remainder is nonzero",
        "set p(k+1) to minus the remainder of p(k-1) divided by p(k)",
        "count sign variations of the sequence at a and at b",
        "return the difference in sign variations as the root count",
    ],
    education: {
        intuition:
            "A Sturm sequence is a chain of polynomials derived by repeated polynomial remainders. As x increases, the signs of the sequence at x change only when x passes a root of the original polynomial, and each root flips exactly one sign variation. Counting those flips between two endpoints therefore counts roots without solving for them.",
        invariants: [
            "p0 is the original polynomial and p1 its derivative.",
            "Each later polynomial is the negated remainder of the previous two.",
            "Consecutive polynomials share no common real root.",
            "The sign variation count changes only when a root of p0 is crossed.",
        ],
        correctness:
            "Sturm's theorem proves that the variation count V(x) drops by exactly one at each distinct real root when moving left to right, and is constant elsewhere. Evaluating at a and b and taking V(a) minus V(b) therefore gives the number of distinct real roots in the half-open interval (a,b]. Sign ignoring zeros handles roots that coincide with an endpoint.",
        complexityRationale:
            "For degree d there are at most d Sturm polynomials, and each polynomial remainder costs O(d squared) work, giving O(d cubed) time. Storing the sequence uses O(d squared) coefficients.",
        uses: [
            "Counting real roots of a polynomial without approximating them",
            "Bracketing roots before bisection or Newton refinement",
            "Computer algebra systems and real algebraic geometry",
        ],
        references: [
            "Basu, Pollack and Roy, Algorithms in Real Algebraic Geometry, Sturm sequences",
            "Wikipedia, Sturm's theorem",
        ],
        workedExample:
            "For f(x)=(x-1)(x-2)(x-3)=x cubed minus 6x squared plus 11x minus 6 on (0,4], the Sturm sequence has three more sign changes at 0 than at 4, correctly reporting the three roots 1, 2 and 3.",
    },
};

export default module;
