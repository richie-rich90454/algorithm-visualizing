/**
 * qr-least-squares.ts - Least Squares by QR Factorization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * To solve the overdetermined least-squares problem min ||A x - b||, factor A
 * into an orthonormal matrix Q and an upper-triangular matrix R using modified
 * Gram-Schmidt. Because Q has orthonormal columns, the problem reduces to the
 * square triangular system R x = Q transpose b, which is solved by back
 * substitution. This avoids squaring the condition number, as the normal
 * equations would.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m n^2) for the factorization plus O(n^2) back substitution
 *   Space: O(m n) for Q and R
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the coefficient matrix A with the right-hand side b.
 *   - The column currently being orthogonalized is highlighted yellow.
 *   - meta carries Q, R, the solution, and the residual norm.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LeastSquaresInput {
    matrix?: number[][];
    rhs?: number[];
}

function makeCells(matrix: number[][], rhs: number[], activeColumn: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const rows = matrix.length;
    const cols = (matrix[0]?.length ?? 0) + 1;
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const isRhs = col === cols - 1;
            const value = isRhs ? (rhs[row] ?? 0) : (matrix[row]?.[col] ?? 0);
            let state: EntityState = "idle";
            if (done) {
                state = "sorted";
            } else if (!isRhs && col === activeColumn) {
                state = "active";
            } else if (isRhs) {
                state = "visited";
            }
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: value.toFixed(2),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, rhs: isRhs, value },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LeastSquaresInput | null) ?? {};
    const matrix: number[][] = Array.isArray(task.matrix) && task.matrix.length > 0
        ? task.matrix.map((row) => (Array.isArray(row) ? row.map((value) => Number(value) || 0) : []))
        : [
              [1, 1],
              [1, 2],
              [1, 3],
          ];
    const rhs: number[] = Array.isArray(task.rhs) && task.rhs.length === matrix.length
        ? task.rhs.map((value) => Number(value) || 0)
        : [1, 2, 2];
    const m = matrix.length;
    const n = matrix[0]?.length ?? 0;

    const q: number[][] = Array.from({ length: m }, () => Array.from({ length: n }, () => 0));
    const r: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(matrix, rhs, -1, false),
        edges: [],
        description: `Factoring a ${m} by ${n} matrix with modified Gram-Schmidt.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: m, cols: n + 1, m, n, solution: [], residual: 0, done: false },
    };
    step += 1;

    // Modified Gram-Schmidt: each original column becomes a Q column.
    for (let col = 0; col < n; col += 1) {
        const vector = Array.from({ length: m }, (_, row) => matrix[row]?.[col] ?? 0);
        for (let previous = 0; previous < col; previous += 1) {
            let projection = 0;
            for (let row = 0; row < m; row += 1) {
                projection += (q[row]?.[previous] ?? 0) * (vector[row] ?? 0);
            }
            r[previous]![col] = projection;
            for (let row = 0; row < m; row += 1) {
                vector[row] = (vector[row] ?? 0) - projection * (q[row]?.[previous] ?? 0);
            }
        }
        let norm = 0;
        for (let row = 0; row < m; row += 1) {
            norm += (vector[row] ?? 0) * (vector[row] ?? 0);
        }
        norm = Math.sqrt(norm);
        r[col]![col] = norm;
        for (let row = 0; row < m; row += 1) {
            q[row]![col] = norm > 1e-14 ? (vector[row] ?? 0) / norm : 0;
        }
        yield {
            stepNumber: step,
            entities: makeCells(matrix, rhs, col, false),
            edges: [],
            description: `Column ${col}: orthogonalized against earlier columns, then normalized to length ${norm.toFixed(4)}.`,
            codeLineNumber: col === 0 ? 2 : 3,
            layout: "grid",
            meta: { rows: m, cols: n + 1, m, n, solution: [], residual: 0, done: false, column: col, qFlat: q.flat(), rFlat: r.flat() },
        };
        step += 1;
    }

    // Form Q transpose b.
    const qtb: number[] = Array.from({ length: n }, (_, col) => {
        let sum = 0;
        for (let row = 0; row < m; row += 1) {
            sum += (q[row]?.[col] ?? 0) * (rhs[row] ?? 0);
        }
        return sum;
    });
    yield {
        stepNumber: step,
        entities: makeCells(matrix, rhs, -1, false),
        edges: [],
        description: `Projected b onto the Q basis: Q transpose b = [${qtb.map((value) => value.toFixed(3)).join(", ")}].`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: m, cols: n + 1, m, n, solution: [], residual: 0, done: false, qtb },
    };
    step += 1;

    // Back substitution on R x = Q transpose b.
    const x: number[] = Array.from({ length: n }, () => 0);
    for (let row = n - 1; row >= 0; row -= 1) {
        let sum = qtb[row] ?? 0;
        for (let col = row + 1; col < n; col += 1) {
            sum -= (r[row]?.[col] ?? 0) * (x[col] ?? 0);
        }
        x[row] = Math.abs(r[row]?.[row] ?? 0) > 1e-14 ? sum / (r[row]?.[row] ?? 1) : 0;
        yield {
            stepNumber: step,
            entities: makeCells(matrix, rhs, -1, false),
            edges: [],
            description: `Back substitution sets x[${row}] = ${x[row]?.toFixed(6)}.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: { rows: m, cols: n + 1, m, n, solution: [...x], residual: 0, done: false },
        };
        step += 1;
    }

    let residual = 0;
    for (let row = 0; row < m; row += 1) {
        let predicted = 0;
        for (let col = 0; col < n; col += 1) {
            predicted += (matrix[row]?.[col] ?? 0) * (x[col] ?? 0);
        }
        residual += (predicted - (rhs[row] ?? 0)) ** 2;
    }
    residual = Math.sqrt(residual);
    yield {
        stepNumber: step,
        entities: makeCells(matrix, rhs, -1, true),
        edges: [],
        description: `Least-squares solution x = [${x.map((value) => value.toFixed(6)).join(", ")}] with residual norm ${residual.toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: m, cols: n + 1, m, n, solution: x, residual, done: true, qFlat: q.flat(), rFlat: r.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of solving the normal equations, which square the condition number, rewrite the design matrix as an orthonormal basis times a triangular matrix. Orthonormal columns let us project the target onto that basis with a simple transpose, and the triangular factor is then solved by back substitution. This is the same geometry as fitting a line, but numerically steadier.",
        invariants: [
            "The columns of Q are mutually orthonormal and span the column space of A.",
            "R is upper triangular and A equals Q times R.",
            "The residual A x minus b is orthogonal to every column of A.",
        ],
        correctness:
            "Modified Gram-Schmidt produces Q with orthonormal columns and an upper-triangular R satisfying A = QR. Then the residual norm of A x minus b equals the norm of R x minus Q transpose b, because multiplying by Q transpose preserves norms and Q transpose Q is the identity. Minimizing the latter over x gives the triangular system R x = Q transpose b, whose back-substitution solution is therefore the least-squares minimizer.",
        complexityRationale:
            "Orthogonalizing n columns of length m against the previous columns costs O(m n squared), forming Q transpose b costs O(m n), and back substitution costs O(n squared), giving O(m n squared) time overall. Storing Q and R uses O(m n) space.",
        uses: [
            "Fitting regression models in scientific computing",
            "Solving overdetermined systems in computer vision and robotics",
            "Numerical linear algebra libraries as the stable alternative to normal equations",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, 4th edition, chapter 5",
            "Trefethen and Bau, Numerical Linear Algebra, lecture 7",
        ],
        workedExample:
            "For A with rows [1,1], [1,2], [1,3] and b = [1,2,2], Gram-Schmidt builds the constant column [1,1,1] normalized and a second column orthogonal to it. Projecting b gives Q transpose b, and back substitution yields the intercept and slope of the best-fit line.",
    },
    id: "qr-least-squares",
    name: "QR Least Squares",
    category: "numerical-optimization",
    complexity: { time: "O(m n^2)", space: "O(m n)" },
    defaultInput: {
        matrix: [
            [1, 1],
            [1, 2],
            [1, 3],
        ],
        rhs: [1, 2, 2],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "let Q and R be empty matrices",
        "for each column a of A",
        "subtract its projections onto the columns of Q already built",
        "normalize the result and store it as the next Q column",
        "record the projection coefficients in R",
        "compute q as Q transpose times b",
        "solve R x equals q by back substitution",
        "done: report x and the residual norm",
    ],
};

export default module;
