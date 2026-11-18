/**
 * richardson-extrapolation.ts - Richardson Extrapolation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Many numerical formulas return an estimate A(h) whose error has a known
 * leading term proportional to h to the p. Richardson extrapolation removes
 * that leading error by combining two estimates computed with step sizes h and
 * h/2: R = A(h/2) + (A(h/2) - A(h)) / (2^p - 1). Repeating the combination down
 * the columns of a triangular table cancels successive error terms and yields
 * a much more accurate answer, which is the idea behind Romberg integration.
 * This module applies the method to a forward-difference derivative, and also
 * supports an exponential and a polynomial function with known exact
 * derivatives so the improvement is measurable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(levels^2) combinations plus O(levels) function evaluations
 *   Space: O(levels^2) for the triangular extrapolation table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The extrapolation table is shown as a grid of cells.
 *   - The newly computed cell is yellow, the final answer is green.
 *   - The metadata carries the full table, the estimate, and the exact value.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface RichardsonInput {
    func?: "sin" | "exp" | "poly";
    x?: number;
    h?: number;
    levels?: number;
}

/** The built-in test functions and their exact first derivatives. */
function valueAndExact(kind: string, x: number): { f: (t: number) => number; exact: number; name: string } {
    if (kind === "exp") {
        return { f: Math.exp, exact: Math.exp(x), name: "exp" };
    }
    if (kind === "poly") {
        return { f: (t: number) => t * t * t - 2 * t + 1, exact: 3 * x * x - 2, name: "x^3 - 2x + 1" };
    }
    return { f: Math.sin, exact: Math.cos(x), name: "sin" };
}

/** Build grid cells for the triangular extrapolation table. */
function makeCells(table: number[][], levels: number, activeRow: number, activeCol: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < levels; i += 1) {
        for (let j = 0; j <= i; j += 1) {
            const v = table[i]?.[j] ?? 0;
            const state = done ? "sorted" : i === activeRow && j === activeCol ? "comparing" : "idle";
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: Number.isFinite(v) ? v.toFixed(6) : "n/a",
                value: v,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

/** The Richardson extrapolation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RichardsonInput | null) ?? {};
    const kind = task.func === "exp" || task.func === "poly" ? task.func : "sin";
    const x = typeof task.x === "number" ? task.x : 1;
    const h0 = typeof task.h === "number" && task.h > 0 ? task.h : 0.1;
    const levels = typeof task.levels === "number" ? Math.max(2, Math.min(6, Math.floor(task.levels))) : 4;
    const { f, exact, name } = valueAndExact(kind, x);

    const table: number[][] = Array.from({ length: levels }, () => new Array<number>(levels).fill(0));
    let step = 0;

    const frame = (description: string, line: number, activeRow: number, activeCol: number, done = false): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(table, levels, activeRow, activeCol, done),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            func: name,
            x,
            h: h0,
            levels,
            exact,
            table: JSON.stringify(table.map((row) => row.slice(0, levels).map((v) => (Number.isFinite(v) ? v : 0)))),
            estimate: done ? (table[levels - 1]?.[levels - 1] ?? 0) : 0,
            raw: table[0]?.[0] ?? 0,
        },
    });

    yield frame(`Approximating the derivative of ${name} at x = ${x} with forward differences of order h = ${h0}.`, 0, -1, -1);

    // First column: forward-difference estimates at successively halved step sizes.
    for (let i = 0; i < levels; i += 1) {
        const h = h0 / 2 ** i;
        table[i]![0] = (f(x + h) - f(x)) / h;
        yield frame(`A(${h.toExponential(3)}) = ${table[i]![0]!.toFixed(6)} has leading error O(h).`, 1, i, 0);
    }

    // Higher columns: cancel the error term of order 2^j.
    for (let j = 1; j < levels; j += 1) {
        const factor = 2 ** j - 1;
        for (let i = j; i < levels; i += 1) {
            table[i]![j] = table[i]![j - 1]! + (table[i]![j - 1]! - table[i - 1]![j - 1]!) / factor;
            yield frame(
                `R[${i}][${j}] combines two order-${j} estimates to cancel the next error term: ${table[i]![j]!.toFixed(8)}.`,
                2,
                i,
                j,
            );
        }
    }

    const estimate = table[levels - 1]![levels - 1]!;
    const rawError = Math.abs((table[0]![0] ?? 0) - exact);
    const finalError = Math.abs(estimate - exact);
    yield frame(
        `Richardson estimate ${estimate.toFixed(10)} vs exact ${exact.toFixed(10)}; error fell from ${rawError.toExponential(2)} to ${finalError.toExponential(2)}.`,
        3,
        levels - 1,
        levels - 1,
        true,
    );
}

/** The Richardson extrapolation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If a formula's error shrinks in a predictable way as the step size shrinks, two imperfect answers can be combined into a better one. Compute the answer at h and at h/2, then extrapolate the error series to the limit where h is zero. Doing this repeatedly across a triangular table cancels one error term per column, which is exactly how Romberg integration gains accuracy from the trapezoidal rule.",
        invariants: [
            "The first column holds forward differences at step sizes h, h/2, h/4, and so on.",
            "Each higher column cancels the leading error term of the column before it.",
            "The diagonal entry is the highest-order estimate available for the given number of levels.",
        ],
        correctness:
            "Write A(h) = L + c1 h^p + c2 h^(2p) + ... . Doubling the resolution gives A(h/2) = L + c1 h^p / 2^p + c2 h^(2p) / 2^(2p) + ... . Forming A(h/2) plus (A(h/2) - A(h)) over (2^p - 1) cancels the c1 term exactly because the coefficient satisfies (2^-p - 1)/(2^p - 1) = -2^-p. The result has leading error O(h^(2p)). Repeating the same argument one column at a time cancels c2, c3, and further terms, so each column raises the order by p.",
        complexityRationale:
            "There are levels forward-difference evaluations and about levels squared / 2 extrapolation entries, each a constant-time arithmetic step, giving O(levels^2) time. The triangular table stores O(levels^2) numbers.",
        uses: [
            "Romberg integration from coarse trapezoidal estimates",
            "High-accuracy numerical differentiation",
            "Error removal in grid-based partial differential equation solvers",
        ],
        references: [
            "Numerical Recipes, 3rd edition, Section 4.3",
            "Richardson, IX. The Deferred Approach to the Limit, 1927",
        ],
        workedExample:
            "For sin at x = 1 with h = 0.1, the forward difference is about 0.5361 while the exact derivative cos(1) is about 0.5403. Halving h gives about 0.5383. Richardson with p = 1 combines them as 0.5383 + (0.5383 - 0.5361) / 1, about 0.5404, cutting the error by roughly a factor of twenty.",
    },
    id: "richardson-extrapolation",
    name: "Richardson Extrapolation",
    category: "numerical-optimization",
    complexity: { time: "O(levels^2)", space: "O(levels^2)" },
    defaultInput: { func: "sin", x: 1, h: 0.1, levels: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose the base step h and the number of levels",
        "for each level compute the forward difference at h over two to the level",
        "store these estimates in the first table column",
        "for each later column j from one to levels minus one",
        "combine two estimates from column j minus one using factor two to the j minus one",
        "store the result in the triangular table",
        "compare the final diagonal with the exact derivative",
        "done: report the extrapolated estimate and its error",
    ],
};

export default module;
