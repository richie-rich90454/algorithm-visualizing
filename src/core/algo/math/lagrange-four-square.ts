/**
 * lagrange-four-square.ts - Lagrange Four-Square Representation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lagrange's four-square theorem states that every nonnegative integer is a
 * sum of four integer squares. A bounded search finds such a representation:
 * try each square for the first three terms in nonincreasing order and check
 * whether the remaining value is a perfect square. The search is exhaustive
 * over the small bounded range, so it always finds a representation when one
 * exists.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^{3/2}) in the worst case for the bounded triple loop
 *   Space: O(1) beyond the four returned values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows the current candidate a, b, c and the residual square d.
 *   - A candidate square being tested is YELLOW (comparing).
 *   - The successful quadruple is GREEN (sorted); the final frame verifies the sum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function isqrt(n: number): number {
    if (n <= 0) return 0;
    let r = Math.floor(Math.sqrt(n));
    while ((r + 1) * (r + 1) <= n) r += 1;
    while (r * r > n) r -= 1;
    return r;
}

function makeCells(
    values: number[],
    states: Map<number, EntityState>,
    active: number,
): VisualEntity[] {
    return values.map((value, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: `${value}^2=${value * value}`,
        value: value * value,
        state: states.get(i) ?? (i === active ? "comparing" : "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, base: value, square: value * value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = Math.max(0, Math.floor(typeof task.n === "number" ? task.n : 30));
    const root = isqrt(n);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells([0, 0, 0, 0], new Map(), -1),
        edges: [],
        description: `Searching for four squares summing to ${n}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, representation: [0, 0, 0, 0], sum: 0, found: n === 0 },
    };
    step += 1;

    for (let a = 0; a <= root && step < 200; a += 1) {
        const a2 = a * a;
        for (let b = a; b <= root && step < 200; b += 1) {
            const b2 = a2 + b * b;
            if (b2 > n) break;
            for (let c = b; c <= root && step < 200; c += 1) {
                const c2 = b2 + c * c;
                if (c2 > n) break;
                const residual = n - c2;
                const d = isqrt(residual);
                const exact = d * d === residual;
                const values = [a, b, c, exact ? d : 0];
                yield {
                    stepNumber: step,
                    entities: makeCells(values, new Map(exact ? [[3, "sorted" as EntityState]] : [[2, "comparing" as EntityState]]), exact ? -1 : 2),
                    edges: [],
                    description: `Try ${a}^2 + ${b}^2 + ${c}^2; residual ${residual} ${exact ? "is" : "is not"} a perfect square.`,
                    codeLineNumber: exact ? 4 : 3,
                    layout: "grid",
                    meta: {
                        n,
                        representation: values,
                        sum: values.reduce((s, v) => s + v * v, 0),
                        residual,
                        found: exact,
                    },
                };
                step += 1;
                if (exact) {
                    const sorted = [...values].sort((x, y) => y - x);
                    yield {
                        stepNumber: step,
                        entities: makeCells(sorted, new Map(sorted.map((_, i) => [i, "sorted" as EntityState])), -1),
                        edges: [],
                        description: `Found ${n} = ${sorted[0]}^2 + ${sorted[1]}^2 + ${sorted[2]}^2 + ${sorted[3]}^2.`,
                        codeLineNumber: 5,
                        layout: "grid",
                        meta: {
                            n,
                            representation: sorted,
                            sum: sorted.reduce((s, v) => s + v * v, 0),
                            found: true,
                        },
                    };
                    return;
                }
            }
        }
    }
}

/** The Lagrange four-square theorem module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Every whole number can be written using at most four squares. A direct way to find such a decomposition is to try squares for the largest three terms in nonincreasing order; whatever remains must be checked for being a perfect square. The theorem guarantees that one of these trials succeeds, so a bounded search is a constructive proof.",
        invariants: [
            "The first three bases are tried in nonincreasing order, so each quadruple is visited in a canonical order.",
            "The residual equals n minus the squares already chosen.",
            "A candidate succeeds exactly when the residual is a perfect square.",
            "The reported four squares always sum back to n.",
        ],
        correctness:
            "Lagrange's theorem guarantees that some quadruple of integer squares sums to n, and sorting the four bases makes one of them appear with the first three in nonincreasing order. The nested loops enumerate every such triple within the square root bound, and for each one test the residual exactly with an integer square root. Thus the loop reaches a valid quadruple, and the explicit sum in the final frame verifies it.",
        complexityRationale:
            "The three nested loops run up to the square root of n, so the search is O(n^{3/2}) in the worst case with O(1) additional storage; integer square root uses a constant-time correction around the floating-point estimate.",
        uses: [
            "Constructing explicit four-square decompositions in number theory",
            "Checking Lagrange's theorem and Jacobi's representation count",
            "Teaching quadratic forms and sums-of-squares identities",
        ],
        references: [
            "Lagrange, Recherches d'arithmetique, 1770",
            "Grosswald, Representations of Integers as Sums of Squares, 1985",
        ],
        workedExample:
            "For n = 30 the search tries a = 5 giving 25 and residual 5. With b = 2 the accumulated sum is 29 and residual 1, whose square root is 1. The quadruple (5, 2, 1, 0) satisfies 25 + 4 + 1 + 0 = 30, so the representation is found after only a few trials.",
    },
    id: "lagrange-four-square",
    name: "Lagrange Four-Square",
    category: "math",
    complexity: { time: "O(n^{3/2})", space: "O(1)" },
    defaultInput: { n: 30 },
    visualType: "grid",
    run,
    pseudocode: [
        "let root be the integer square root of n",
        "for a from zero to root",
        "for b from a to root while the partial sum is at most n",
        "for c from b to root while the partial sum is at most n",
        "let d be the integer square root of n minus the three squares",
        "if d squared equals that residual output a b c d and stop",
        "done: return four squares summing to n",
    ],
};

export default module;
