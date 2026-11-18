/**
 * least-squares-normal-equations.ts - Least Squares via Normal Equations
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a tall matrix A and a vector b, least squares finds x that minimizes
 * the squared error of Ax versus b. Setting the gradient of that error to zero
 * gives the normal equations A transpose A x = A transpose b, a square system
 * that can be solved by Gaussian elimination with partial pivoting. The
 * resulting residual b - Ax is orthogonal to every column of A, which is the
 * geometric statement of the least-squares optimum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m n^2) to form the normal equations plus O(n^3) to solve them
 *   Space: O(m n + n^2) for A, the Gram matrix, and the augmented system
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The first grid shows the augmented data matrix A | b.
 *   - The next grids show the normal equations A^T A | A^T b and elimination.
 *   - The pivot row is yellow during elimination; the final solution is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    matrix: number[][],
    rows: number,
    cols: number,
    activeRow = -1,
    finalState = false,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            const value = matrix[i]?.[j] ?? 0;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: value.toFixed(4),
                value,
                state: finalState ? "sorted" : i === activeRow ? "comparing" : "idle",
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

function multiplyTranspose(a: number[][], b: number[], m: number, n: number): { ata: number[][]; atb: number[] } {
    const ata: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const atb = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let sum = 0;
            for (let k = 0; k < m; k += 1) sum += (a[k]?.[i] ?? 0) * (a[k]?.[j] ?? 0);
            ata[i]![j] = sum;
        }
        let rhs = 0;
        for (let k = 0; k < m; k += 1) rhs += (a[k]?.[i] ?? 0) * (b[k] ?? 0);
        atb[i] = rhs;
    }
    return { ata, atb };
}

/** Back-substitution on the upper-triangular augmented system produced above. */
function backSubstitute(aug: number[][], n: number): number[] | null {
    for (let i = 0; i < n; i += 1) {
        if (Math.abs(aug[i]?.[i] ?? 0) < 1e-12) return null;
    }
    const x = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
        let sum = aug[i]?.[n] ?? 0;
        for (let j = i + 1; j < n; j += 1) sum -= (aug[i]?.[j] ?? 0) * (x[j] ?? 0);
        x[i] = sum / (aug[i]?.[i] ?? 1);
    }
    return x;
}

function residualNorm(a: number[][], b: number[], x: number[], m: number, n: number): number {
    let sum = 0;
    for (let i = 0; i < m; i += 1) {
        let fit = 0;
        for (let j = 0; j < n; j += 1) fit += (a[i]?.[j] ?? 0) * (x[j] ?? 0);
        sum += (fit - (b[i] ?? 0)) ** 2;
    }
    return sum;
}

/** Least squares via normal equations generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number[][]; b?: number[] } | null) ?? {};
    const a = Array.isArray(task.a)
        ? task.a.map((row) => [...row])
        : [
              [1, 0],
              [1, 1],
              [1, 2],
              [1, 3],
          ];
    const b = Array.isArray(task.b) ? [...task.b] : [1, 2, 4, 5];
    const m = a.length;
    const n = m > 0 ? (a[0]?.length ?? 0) : 0;
    let step = 0;

    if (m === 0 || n === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty matrix - nothing to fit.",
            codeLineNumber: 6,
            layout: "grid",
            meta: { rows: 1, cols: 1, phase: "done", x: [], residual: 0 },
        };
        return;
    }

    const dataWithB = a.map((row, i) => [...row, b[i] ?? 0]);
    yield {
        stepNumber: step,
        entities: makeCells(dataWithB, m, n + 1),
        edges: [],
        description: `Fit ${n} parameter(s) to ${m} observations: the data matrix A is augmented with b.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: m, cols: n + 1, phase: "data", x: [], residual: residualNorm(a, b, new Array(n).fill(0), m, n) },
    };
    step += 1;

    const { ata, atb } = multiplyTranspose(a, b, m, n);
    const aug = ata.map((row, i) => [...row, atb[i] ?? 0]);
    yield {
        stepNumber: step,
        entities: makeCells(aug, n, n + 1),
        edges: [],
        description: "Form the normal equations A transpose A x equals A transpose b.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: n, cols: n + 1, phase: "normal-equations", x: [], residual: residualNorm(a, b, new Array(n).fill(0), m, n) },
    };
    step += 1;

    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let i = col + 1; i < n; i += 1) {
            if (Math.abs(aug[i]?.[col] ?? 0) > Math.abs(aug[pivot]?.[col] ?? 0)) pivot = i;
        }
        if (pivot !== col) {
            const temp = aug[col];
            aug[col] = aug[pivot]!;
            aug[pivot] = temp!;
        }
        const pivotValue = aug[col]?.[col] ?? 0;
        for (let i = col + 1; i < n; i += 1) {
            const factor = pivotValue === 0 ? 0 : (aug[i]?.[col] ?? 0) / pivotValue;
            for (let j = col; j <= n; j += 1) {
                const cell = aug[i];
                if (cell) cell[j] = (cell[j] ?? 0) - factor * (aug[col]?.[j] ?? 0);
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(aug, n, n + 1, col),
            edges: [],
            description: `Eliminate below column ${col} using the largest available pivot.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: n, cols: n + 1, phase: "eliminate", pivot: col, x: [], residual: 0 },
        };
        step += 1;
    }

    const x = backSubstitute(aug, n);
    if (!x) {
        yield {
            stepNumber: step,
            entities: makeCells(aug, n, n + 1),
            edges: [],
            description: "The normal matrix is singular, so the least-squares solution is not unique.",
            codeLineNumber: 6,
            layout: "grid",
            meta: { rows: n, cols: n + 1, phase: "done", x: [], residual: 0, singular: true },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: makeCells(aug, n, n + 1, -1, true),
        edges: [],
        description: `Solution x = [${x.map((value) => value.toFixed(5)).join(", ")}] with squared residual ${residualNorm(a, b, x, m, n).toExponential(3)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: n,
            cols: n + 1,
            phase: "done",
            x,
            residual: residualNorm(a, b, x, m, n),
            singular: false,
        },
    };
}

/** The least squares normal equations module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The best fit makes the errors orthogonal to the columns of A. Writing that condition out produces a small square system called the normal equations. Solve it and the fitted parameters minimize the total squared error, just as the foot of a perpendicular is the closest point on a line to a given point.",
        invariants: [
            "The Gram matrix A transpose A is symmetric and positive semidefinite.",
            "Partial pivoting selects the largest available entry in the current column before elimination.",
            "At the optimum the residual b minus A x is orthogonal to every column of A.",
        ],
        correctness:
            "The squared error f(x) equals (Ax - b) transpose (Ax - b). Its gradient is 2 A transpose (A x - b). Setting the gradient to zero gives A transpose A x equals A transpose b. When A has full column rank the Gram matrix is positive definite, so this system has a unique solution, and because f is a convex quadratic that stationary point is its global minimum. The orthogonality of the residual to the columns of A is exactly the vanishing gradient.",
        complexityRationale:
            "Forming A transpose A multiplies an n by m by an m by n matrix and costs O(m n^2). Gaussian elimination on the n by n normal matrix costs O(n^3). Storing A, the Gram matrix, and the augmented system uses O(m n + n^2) space.",
        uses: [
            "Linear regression and curve fitting",
            "Parameter estimation in signal processing",
            "Solving overdetermined systems in experimental science",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, Chapter 5",
            "Strang, Linear Algebra and Its Applications, Section 4.4",
        ],
        workedExample:
            "Fit a line to the points (0,1), (1,2), (2,4), (3,5). The normal equations are 4a + 6b = 12 and 6a + 14b = 25, giving a = 0.9 and b = 1.4. The residuals 0.1, -0.3, 0.3, -0.1 sum to zero and are orthogonal to the column of x values, confirming the minimum.",
    },
    id: "least-squares-normal-equations",
    name: "Least Squares via Normal Equations",
    category: "numerical-optimization",
    complexity: { time: "O(m n^2 + n^3)", space: "O(m n + n^2)" },
    defaultInput: {
        a: [
            [1, 0],
            [1, 1],
            [1, 2],
            [1, 3],
        ],
        b: [1, 2, 4, 5],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "augment the data matrix A with the observation vector b",
        "form the Gram matrix A transpose A and vector A transpose b",
        "build the augmented normal system with right-hand side",
        "for each column choose the largest pivot and eliminate below",
        "back-substitute to obtain the parameter vector x",
        "compute the squared residual of the fit",
        "done: report the parameters and residual",
    ],
};

export default module;
