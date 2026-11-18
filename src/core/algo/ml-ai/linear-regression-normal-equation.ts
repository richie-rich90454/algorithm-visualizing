/**
 * linear-regression-normal-equation.ts - Least Squares via Normal Equations
 *
 * Fits y = w0 + w1*x by forming the 2x2 normal equations (X^T X) w = X^T y
 * and solving them with Gaussian elimination and partial pivoting. The closed
 * form is a special case, but elimination shows the general linear-system
 * machinery used for many features.
 *
 * Time:  O(n) to accumulate sums, O(1) to solve the 2x2 system
 * Space: O(n) for the point entities
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LRInput {
    xs?: number[];
    ys?: number[];
}

/** Build the augmented matrix rows [[n, sx, sy], [sx, sxx, sxy]]. */
function makeCells(matrix: number[][], pivotRow: number, solved: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < 3; c += 1) {
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: (matrix[r]?.[c] ?? 0).toFixed(2),
                value: matrix[r]?.[c] ?? 0,
                state: (solved ? "sorted" : r === pivotRow && c === 0 ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LRInput | null) ?? {};
    const xs = Array.isArray(task.xs) ? [...task.xs] : [1, 2, 3, 4, 5, 6];
    const ys = Array.isArray(task.ys) ? [...task.ys] : [2.1, 3.9, 6.2, 8.1, 9.8, 12.2];
    const n = Math.min(xs.length, ys.length);
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (let i = 0; i < n; i += 1) {
        const x = xs[i] ?? 0;
        const y = ys[i] ?? 0;
        sx += x;
        sy += y;
        sxx += x * x;
        sxy += x * y;
    }

    const augmented = [
        [n, sx, sy],
        [sx, sxx, sxy],
    ];
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(augmented, -1, false),
        edges: [],
        description: `Accumulated normal equations from ${n} points: n=${n}, sum x=${sx}, sum x^2=${sxx}.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: 2, cols: 3, sx, sy, sxx, sxy },
    };
    step += 1;

    const det = n * sxx - sx * sx;
    if (Math.abs(det) < 1e-12) {
        yield {
            stepNumber: step,
            entities: makeCells(augmented, 0, false),
            edges: [],
            description: "The normal matrix is singular (all x values identical); no unique line exists.",
            codeLineNumber: 2,
            layout: "matrix",
            meta: { rows: 2, cols: 3, singular: true, sx, sy, sxx, sxy },
        };
        return;
    }

    // Gaussian elimination with partial pivoting on the 2x3 augmented matrix.
    const M = augmented.map((row) => [...row]);
    for (let col = 0; col < 2; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < 2; r += 1) {
            if (Math.abs(M[r]?.[col] ?? 0) > Math.abs(M[pivot]?.[col] ?? 0)) {
                pivot = r;
            }
        }
        if (pivot !== col) {
            const tmp = M[col];
            M[col] = M[pivot];
            M[pivot] = tmp;
        }
        yield {
            stepNumber: step,
            entities: makeCells(M, col, false),
            edges: [],
            description: `Column ${col}: pivot chosen at row ${pivot} with value ${(M[col]?.[col] ?? 0).toFixed(2)}.`,
            codeLineNumber: 3,
            layout: "matrix",
            meta: { rows: 2, cols: 3, pivotRow: pivot, pivotCol: col },
        };
        step += 1;

        const pivotValue = M[col]?.[col] ?? 1;
        for (let c = col; c < 3; c += 1) {
            M[col]![c] = (M[col]![c] ?? 0) / pivotValue;
        }
        const below = M[1 - col];
        const factor = below?.[col] ?? 0;
        if (col === 0 && below) {
            for (let c = 0; c < 3; c += 1) {
                below[c] = (below[c] ?? 0) - factor * (M[col]![c] ?? 0);
            }
            yield {
                stepNumber: step,
                entities: makeCells(M, -1, false),
                edges: [],
                description: `Eliminated the first column: row 2 now has leading entry ${(below[1] ?? 0).toFixed(2)}.`,
                codeLineNumber: 4,
                layout: "matrix",
                meta: { rows: 2, cols: 3, factor },
            };
            step += 1;
        }
    }

    // After elimination the rows are [1, a, p], [0, 1, q] (or swapped order).
    const row0 = M[0] ?? [0, 0, 0];
    const row1 = M[1] ?? [0, 0, 0];
    let w1: number;
    let w0: number;
    if (Math.abs(row0[1] ?? 0) < 1e-12) {
        w1 = row0[2] ?? 0;
        w0 = (row1[2] ?? 0) - (row1[0] ?? 0) * w1;
    } else {
        w1 = row1[2] ?? 0;
        w0 = (row0[2] ?? 0) - (row0[1] ?? 0) * w1;
    }

    const residuals: number[] = [];
    let mse = 0;
    for (let i = 0; i < n; i += 1) {
        const residual = w0 + w1 * (xs[i] ?? 0) - (ys[i] ?? 0);
        residuals.push(residual);
        mse += residual * residual;
    }
    mse = n > 0 ? mse / n : 0;

    yield {
        stepNumber: step,
        entities: makeCells(M, -1, true),
        edges: [],
        description: `Solved the system: intercept ${w0.toFixed(4)}, slope ${w1.toFixed(4)}, mean squared error ${mse.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "matrix",
        meta: { rows: 2, cols: 3, w0, w1, mse, residuals },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A least-squares line makes the sum of squared vertical errors as small as possible. Setting the two partial derivatives of that error to zero gives a pair of linear equations in the intercept and slope, called the normal equations. Solving the pair is the same as inverting a small matrix.",
        invariants: [
            "The normal equations are n*w0 + sum(x)*w1 = sum(y) and sum(x)*w0 + sum(x^2)*w1 = sum(x*y).",
            "Partial pivoting never changes the solution of the linear system.",
            "At the optimum the residuals sum to zero and are orthogonal to the x values.",
        ],
        correctness:
            "The squared-error objective is convex, so any point where both partial derivatives vanish is the global minimum. The normal equations are exactly those two derivative conditions, and Gaussian elimination with pivoting solves an invertible 2x2 system uniquely, so the returned coefficients are the least-squares fit.",
        complexityRationale:
            "Four running sums are accumulated in one pass over n points, costing O(n) time, and eliminating a 2x2 system is constant work. Only the entities are stored, so space is O(n).",
        uses: [
            "Fitting trend lines and calibration curves",
            "The closed-form baseline for linear regression",
            "The building block of polynomial and multiple regression",
        ],
        references: [
            "Gauss, Theoria Combinationis Observationum Erroribus Minimis Obnoxiae, 1821",
            "Strang, Linear Algebra and Its Applications, Chapter 4",
        ],
        workedExample:
            "For points (1,2), (2,4), (3,5), we have n=3, sum x=6, sum y=11, sum x^2=14, sum x*y=25. The normal equations are 3w0+6w1=11 and 6w0+14w1=25; elimination gives w1=1.5 and w0=2/3, so the fitted line is y = 0.667 + 1.5x.",
    },
    id: "linear-regression-normal-equation",
    name: "Linear Regression (Normal Equation)",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { xs: [1, 2, 3, 4, 5, 6], ys: [2.1, 3.9, 6.2, 8.1, 9.8, 12.2] },
    visualType: "matrix",
    run,
    pseudocode: [
        "accumulate n, sum x, sum y, sum x squared, sum x times y",
        "form the augmented normal matrix with rows n, sum x, sum y and sum x, sum x squared, sum x times y",
        "if the determinant is zero report no unique solution",
        "for each column pick the largest pivot and swap rows",
        "normalize the pivot row and eliminate the row below",
        "back-substitute to obtain intercept and slope",
        "compute residuals and mean squared error",
        "done: report the fitted line parameters",
    ],
};

export default module;
