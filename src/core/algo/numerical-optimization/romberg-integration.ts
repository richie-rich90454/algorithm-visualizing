/**
 * romberg-integration.ts - Romberg Integration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Romberg integration computes a definite integral by combining the
 * composite trapezoidal rule with Richardson extrapolation. It starts with a
 * single trapezoid, repeatedly halves the step size, and stores each refined
 * trapezoidal estimate in the first column of a triangular table. Each later
 * column cancels the leading error term of the previous one, since halving the
 * step divides the trapezoidal error by four. The bottom-right entry is a very
 * accurate estimate obtained from relatively few function evaluations.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^k) function evaluations for k refinement levels
 *   Space: O(k^2) for the triangular Romberg table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each table entry R[k][j] is a grid cell with row k and column j.
 *   - The active column is highlighted while extrapolation runs.
 *   - meta carries the full table, the estimate, and the exact value when known.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export type FunctionName = "x^2" | "sin" | "exp" | "cos";

/** Evaluate one of the built-in teaching functions. */
export function evaluate(name: FunctionName, x: number): number {
    switch (name) {
        case "sin":
            return Math.sin(x);
        case "exp":
            return Math.exp(x);
        case "cos":
            return Math.cos(x);
        case "x^2":
        default:
            return x * x;
    }
}

/** Closed-form integrals of the built-in functions, for verifying accuracy. */
export function exactIntegral(name: FunctionName, a: number, b: number): number {
    switch (name) {
        case "sin":
            return -Math.cos(b) + Math.cos(a);
        case "exp":
            return Math.exp(b) - Math.exp(a);
        case "cos":
            return Math.sin(b) - Math.sin(a);
        case "x^2":
        default:
            return (b * b * b - a * a * a) / 3;
    }
}

/** Build the full Romberg table; entry [k][j] is valid for j <= k. */
export function rombergTable(f: (x: number) => number, a: number, b: number, levels: number): number[][] {
    const table: number[][] = [];
    for (let k = 0; k < levels; k += 1) {
        const h = (b - a) / Math.pow(2, k);
        let trapezoid = 0;
        if (k === 0) {
            trapezoid = (h / 2) * (f(a) + f(b));
        } else {
            const previous = table[k - 1]?.[0] ?? 0;
            let sum = 0;
            for (let i = 1; i <= Math.pow(2, k - 1); i += 1) {
                sum += f(a + (2 * i - 1) * h);
            }
            trapezoid = previous / 2 + h * sum;
        }
        const row: number[] = [trapezoid];
        for (let j = 1; j <= k; j += 1) {
            const previousRow = table[k - 1] as number[];
            const factor = Math.pow(4, j) - 1;
            row.push((row[j - 1] as number) + ((row[j - 1] as number) - (previousRow[j - 1] as number)) / factor);
        }
        table.push(row);
    }
    return table;
}

/** Build grid cells for the table, revealing rows up to visible. */
function makeCells(table: number[][], visible: number, activeColumn: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let k = 0; k < table.length; k += 1) {
        for (let j = 0; j <= k; j += 1) {
            const shown = k <= visible;
            let state: EntityState = "unvisited";
            if (shown) {
                state = j === activeColumn ? "comparing" : j === 0 ? "active" : "sorted";
            }
            entities.push({
                id: `cell-${k}-${j}`,
                type: "cell" as const,
                label: shown ? (table[k]?.[j] as number).toFixed(8) : "?",
                value: shown ? (table[k]?.[j] as number) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: k, col: j, indexK: k, indexJ: j, shown },
            });
        }
    }
    return entities;
}

/** The Romberg integration generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { func?: FunctionName; a?: number; b?: number; levels?: number } | null) ?? {};
    const name: FunctionName = task.func && ["x^2", "sin", "exp", "cos"].includes(task.func) ? task.func : "x^2";
    const a = typeof task.a === "number" ? task.a : 0;
    const b = typeof task.b === "number" ? task.b : 1;
    const levels = Math.min(10, Math.max(1, Math.floor(Number(task.levels ?? 5)) || 5));
    const f = (x: number): number => evaluate(name, x);
    const table = rombergTable(f, a, b, levels);
    const estimate = table[levels - 1]?.[levels - 1] ?? 0;
    const exact = exactIntegral(name, a, b);
    const cols = levels;

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeCells(table, -1, -1),
        edges: [],
        description: `Romberg integration of ${name} on [${a}, ${b}] with ${levels} refinement levels; table starts empty.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: levels, cols, level: 0, estimate: 0, exact, error: 0, func: name },
    };

    for (let k = 0; k < levels; k += 1) {
        const trapezoid = table[k]?.[0] ?? 0;
        yield {
            stepNumber: step++,
            entities: makeCells(table, k, 0),
            edges: [],
            description: `Level ${k}: composite trapezoid with ${Math.pow(2, k)} panel(s) gives R[${k}][0] = ${trapezoid.toFixed(9)}.`,
            codeLineNumber: k === 0 ? 1 : 3,
            layout: "grid",
            meta: { rows: levels, cols, level: k, estimate: trapezoid, exact, error: Math.abs(trapezoid - exact), func: name },
        };

        for (let j = 1; j <= k; j += 1) {
            const value = table[k]?.[j] ?? 0;
            yield {
                stepNumber: step++,
                entities: makeCells(table, k, j),
                edges: [],
                description: `Richardson step R[${k}][${j}] = ${value.toFixed(9)} cancels the leading error using R[${k - 1}][${j - 1}].`,
                codeLineNumber: 5,
                layout: "grid",
                meta: { rows: levels, cols, level: k, column: j, estimate: value, exact, error: Math.abs(value - exact), func: name },
            };
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(table, levels - 1, levels - 1),
        edges: [],
        description: `Romberg estimate ${estimate.toFixed(12)} for ${name} on [${a}, ${b}]; exact value ${exact.toFixed(12)}, error ${Math.abs(estimate - exact).toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: levels, cols, level: levels, estimate, exact, error: Math.abs(estimate - exact), func: name, bottomRow: table[levels - 1] ?? [] },
    };
}

/** The Romberg integration module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A trapezoidal estimate improves steadily as the panels get smaller, and its error shrinks by a predictable factor of four each time the step size is halved. Romberg keeps those successive estimates in a table and combines pairs of them to cancel the leading error term. Repeating the cancellation across the columns turns a modest number of function evaluations into a very accurate answer.",
        invariants: [
            "R[k][0] is the composite trapezoidal rule with 2^k equal panels.",
            "Column j cancels the error term of order h^(2j) from column j-1.",
            "Every extrapolation uses only entries already computed in the same or an earlier row.",
        ],
        correctness:
            "The composite trapezoidal rule has an asymptotic error expansion in even powers of the step size h: I = T(h) + c1 h^2 + c2 h^4 + ... . Halving h scales the h^(2j) term by 1/4^j, so the combination T(h/2) + (T(h/2) - T(h))/(4^j - 1) eliminates that term exactly to leading order. Applying the same combination column by column cancels c1, then c2, and so on, which makes the bottom-right entry converge rapidly for smooth functions.",
        complexityRationale:
            "Level k evaluates the function at 2^k new midpoints, so all levels through k cost O(2^k) evaluations. Filling the triangular table costs O(k^2) arithmetic and storage for k levels.",
        uses: [
            "High-accuracy definite integration in scientific computing",
            "A teaching bridge between the trapezoidal rule and Richardson extrapolation",
            "Numerical quadrature when function evaluations are cheap and smoothness holds",
        ],
        references: [
            "Romberg, Vereinfachte numerische Integration, 1955",
            "Burden and Faires, Numerical Analysis, Chapter 4",
        ],
        workedExample:
            "Integrating x squared on [0, 1] with four levels gives trapezoid estimates 0.5, 0.375, 0.343750, and 0.335938. The first extrapolation from 0.375 and 0.5 cancels the h-squared error to give 0.333333, already exact to six digits; the true integral is 1/3.",
    },
    id: "romberg-integration",
    name: "Romberg Integration",
    category: "numerical-optimization",
    complexity: { time: "O(2^k)", space: "O(k^2)" },
    defaultInput: { func: "x^2", a: 0, b: 1, levels: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the single-panel trapezoid R zero zero",
        "for each level k halve the step size",
        "sum new midpoint values for the refined trapezoid",
        "store the refined trapezoid in column zero",
        "for each later column j up to k extrapolate",
        "subtract the previous row and divide by four to the j minus one",
        "add that correction to the current entry",
        "done: report the bottom-right estimate and its error",
    ],
};

export default module;
