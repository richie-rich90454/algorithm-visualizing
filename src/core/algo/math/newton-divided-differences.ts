/**
 * newton-divided-differences.ts - Newton Interpolation by Divided Differences
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given distinct sample points, Newton's method builds the unique interpolating
 * polynomial in a form where each new term reuses the previous work. The
 * coefficients are the divided differences f[x0], f[x0,x1], and so on. They can
 * be computed in place with a triangular table and evaluated by Horner's rule
 * in the Newton basis.
 *
 * The simulation uses exact double arithmetic on the supplied samples and is
 * limited to at most 16 points so the divided-difference table stays visible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) to build the table, O(n) per evaluation
 *   Space: O(n) for the in-place coefficient table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars display the divided-difference table as it is filled in.
 *   - Each frame adds one diagonal of the table.
 *   - The final frame reports the Newton coefficients and the query value.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface NewtonInput {
    points?: Array<[number, number]>;
    query?: number;
}

const MAX_POINTS = 16;

/** Bars for a flat list of table values. */
function makeBars(values: number[], highlightTo: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `dd-${index}`,
        type: "bar" as const,
        label: value.toFixed(2),
        value,
        state: index <= highlightTo ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Evaluate the Newton polynomial at x. */
function evaluate(xs: number[], coefficients: number[], x: number): number {
    let result = coefficients[coefficients.length - 1] ?? 0;
    for (let k = coefficients.length - 2; k >= 0; k -= 1) {
        result = result * (x - xs[k]!) + coefficients[k]!;
    }
    return result;
}

/** The divided-differences generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as NewtonInput | null) ?? {};
    const raw = Array.isArray(task.points) ? task.points : [[0, 1], [1, 3], [2, 7]];
    const seen = new Set<number>();
    const points: Array<[number, number]> = [];
    for (const pair of raw.slice(0, MAX_POINTS)) {
        const x = Number(pair?.[0]);
        const y = Number(pair?.[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || seen.has(x)) continue;
        seen.add(x);
        points.push([x, y]);
    }
    if (points.length < 2) points.push([0, 0], [1, 1]);

    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const n = points.length;
    const coefficients = [...ys];
    const table: number[][] = [ys.map((y) => y)];
    const query = typeof task.query === "number" && Number.isFinite(task.query) ? task.query : xs[0]!;

    const metaBase = {
        n,
        xs,
        ys,
        coefficients: [...coefficients],
        query,
        value: 0,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(ys, -1),
        edges: [],
        description: `Loaded ${n} distinct sample points; the zeroth divided differences are the y values.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaBase },
    };
    step += 1;

    for (let order = 1; order < n; order += 1) {
        for (let i = n - 1; i >= order; i -= 1) {
            const denominator = xs[i]! - xs[i - order]!;
            coefficients[i] = denominator === 0 ? 0 : (coefficients[i]! - coefficients[i - 1]!) / denominator;
        }
        table.push(coefficients.slice(order));
        const flat = table.flat();
        yield {
            stepNumber: step,
            entities: makeBars(flat, flat.length - 1),
            edges: [],
            description: `Order ${order} divided differences computed; the diagonal now has ${n - order} new coefficients.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { ...metaBase, coefficients: [...coefficients], table: flat },
        };
        step += 1;
    }

    const value = evaluate(xs, coefficients, query);
    yield {
        stepNumber: step,
        entities: makeBars(coefficients, coefficients.length - 1),
        edges: [],
        description: `Newton form ready: f(${query}) is approximately ${value.toFixed(4)} from the ${n} coefficients.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...metaBase, coefficients: [...coefficients], query, value },
    };
}

/** The Newton divided-differences module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Fitting a polynomial through sample points can be done one point at a time. Newton's divided differences measure how much the estimate changes when another point is added, and those changes become the coefficients of a nested polynomial. Adding a new sample only extends the table instead of redoing the whole fit.",
        invariants: [
            "All sample x coordinates are distinct, so every divided difference is defined.",
            "The coefficient at order k equals the divided difference over the first k plus one points.",
            "The Newton polynomial passes through every original sample point.",
        ],
        correctness:
            "The divided difference f[x0,...,xk] is defined recursively from two lower-order differences, and the in-place table computes exactly that recurrence by sweeping backward so earlier-order values remain intact. The Newton basis polynomial of degree k agrees with the unique interpolant on the first k plus one points by induction: adding the term with coefficient f[x0,...,xk] forces agreement at the next sample while preserving the earlier ones.",
        complexityRationale:
            "The triangular table has roughly n squared over two entries and each takes constant work, so building the coefficients is O(n^2). Evaluating the nested Newton form uses n multiplications and additions, O(n) time, and the in-place table needs O(n) space.",
        uses: [
            "Interpolating tabulated scientific data",
            "Numerical differentiation and integration formulas",
            "A numerically stable basis for adding interpolation points",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, Chapter 3",
            "Higham, Accuracy and Stability of Numerical Algorithms, Chapter 4",
        ],
        workedExample:
            "For points (0,1), (1,3), and (2,7), the first divided differences are 2 and 4, and the second is (4 minus 2) over (2 minus 0) which equals 1. The Newton polynomial is 1 plus 2x plus 1 times x times (x minus 1), and at x equals 1.5 it gives 4.75.",
    },
    id: "newton-divided-differences",
    name: "Newton Divided Differences",
    category: "math",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        points: [[0, 1], [1, 3], [2, 7]],
        query: 1.5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "store the sample x and y values",
        "copy the y values into a divided-difference array",
        "for each order from one to n minus one",
        "sweep backward and divide differences by x spacing",
        "read the Newton coefficients from the array",
        "evaluate the nested form at the query point",
        "done: report coefficients and interpolated value",
    ],
};

export default module;
