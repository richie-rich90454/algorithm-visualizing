/**
 * kaczmarz-method.ts - Kaczmarz Method (Algebraic Reconstruction)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Kaczmarz method solves a linear system Ax = b one equation at a time.
 * Starting from an initial guess, it cycles through the rows and projects the
 * current iterate orthogonally onto the hyperplane defined by that row: the
 * step moves x by the residual of that equation divided by the squared norm of
 * the row, in the direction of the row. When the rows are visited repeatedly,
 * the iterates converge to a solution; for an inconsistent system they settle
 * near a weighted least-squares solution. The method needs only one row at a
 * time, which is why it is popular for huge, sparse tomography problems.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n) for rows of length n
 *   Space: O(n) for the iterate plus O(m*n) for the stored system
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each component of x is a bar; its height encodes the current value.
 *   - The bar touched by the active row is yellow, converged bars are green.
 *   - meta carries the iterate, the active row, and the residual norm.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface KaczmarzStep {
    iteration: number;
    row: number;
    x: number[];
    residual: number;
}

export interface KaczmarzResult {
    x: number[];
    residual: number;
    history: KaczmarzStep[];
}

/** Squared Euclidean norm of a vector. */
function normSquared(vector: number[]): number {
    return vector.reduce((sum, value) => sum + value * value, 0);
}

/** Residual norm of the system at a given iterate. */
export function residualNorm(matrix: number[][], b: number[], x: number[]): number {
    let sum = 0;
    for (let i = 0; i < matrix.length; i += 1) {
        const row = matrix[i] ?? [];
        let dot = 0;
        for (let j = 0; j < x.length; j += 1) {
            dot += (row[j] ?? 0) * (x[j] as number);
        }
        const difference = dot - (b[i] ?? 0);
        sum += difference * difference;
    }
    return Math.sqrt(sum);
}

/** Run cyclic Kaczmarz projections, recording one entry per row visit. */
export function kaczmarz(matrix: number[][], b: number[], iterations: number, initial?: number[]): KaczmarzResult {
    const n = b.length;
    const x = initial ? [...initial] : Array.from({ length: n }, () => 0);
    const history: KaczmarzStep[] = [];
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const rowIndex = iteration % matrix.length;
        const row = matrix[rowIndex] ?? [];
        const denom = normSquared(row);
        if (denom <= 1e-15) {
            continue;
        }
        let dot = 0;
        for (let j = 0; j < n; j += 1) {
            dot += (row[j] ?? 0) * (x[j] as number);
        }
        const factor = ((b[rowIndex] as number) - dot) / denom;
        for (let j = 0; j < n; j += 1) {
            x[j] = (x[j] as number) + factor * (row[j] ?? 0);
        }
        history.push({ iteration, row: rowIndex, x: [...x], residual: residualNorm(matrix, b, x) });
    }
    return { x, residual: residualNorm(matrix, b, x), history };
}

/** Build bar entities for the current iterate. */
function makeBars(x: number[], activeCoordinates: number[] | null): VisualEntity[] {
    return x.map((value, index) => {
        const state: EntityState = activeCoordinates && activeCoordinates[index] !== 0 ? "comparing" : Math.abs(value) > 1e-6 ? "sorted" : "idle";
        return {
            id: `x-${index}`,
            type: "bar" as const,
            label: `x${index}=${value.toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value },
        };
    });
}

/** The Kaczmarz generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; b?: number[]; iterations?: number } | null) ?? {};
    const matrix: number[][] = Array.isArray(task.matrix) && task.matrix.length > 0
        ? task.matrix.map((row) => [...row])
        : [[2, 1], [1, 3]];
    const b: number[] = Array.isArray(task.b) && task.b.length > 0 ? [...task.b] : [5, 10];
    const iterations = Math.min(300, Math.max(1, Math.floor(Number(task.iterations ?? 18)) || 18));
    const n = b.length;
    const result = kaczmarz(matrix, b, iterations);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(Array.from({ length: n }, () => 0), null),
        edges: [],
        description: `Kaczmarz method on a ${matrix.length} by ${n} system starting from the zero vector; ${iterations} row projections.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: matrix.length, cols: n, iteration: 0, row: -1, residual: residualNorm(matrix, b, Array(n).fill(0)), x: Array(n).fill(0) },
    };

    for (const record of result.history) {
        const row = matrix[record.row] ?? [];
        yield {
            stepNumber: step++,
            entities: makeBars(record.x, row),
            edges: [],
            description: `Projection ${record.iteration}: row ${record.row} drives its equation to zero; iterate (${record.x.map((value) => value.toFixed(3)).join(", ")}), residual ${record.residual.toExponential(2)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { rows: matrix.length, cols: n, iteration: record.iteration, row: record.row, residual: record.residual, x: [...record.x] },
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(result.x, null),
        edges: [],
        description: `Final solution (${result.x.map((value) => value.toFixed(6)).join(", ")}); residual norm ${result.residual.toExponential(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { rows: matrix.length, cols: n, iteration: result.history.length, residual: result.residual, x: result.x, note: "cyclic row projections; consistent systems converge" },
    };
}

/** The Kaczmarz method module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of each linear equation as a hyperplane and the solution as the point where all the hyperplanes meet. Start anywhere and, one equation at a time, move the current guess straight onto the next hyperplane. Projecting onto a row fixes that equation exactly while disturbing the others a little, and cycling through all rows repeatedly spirals in on the common intersection.",
        invariants: [
            "After projecting onto row i, that equation is satisfied exactly by the new iterate.",
            "Each step is an orthogonal projection, so it never increases the distance to the true solution for a consistent system.",
            "Rows with zero norm are skipped to avoid division by zero.",
        ],
        correctness:
            "The update x <- x + (b_i - a_i dot x)/||a_i||^2 * a_i is the orthogonal projection of x onto the hyperplane a_i dot x = b_i, so it makes row i exact. For a consistent system the true solution lies on every hyperplane and is a fixed point of every projection, and each projection reduces the squared distance to it by exactly the squared residual divided by ||a_i||^2. Cycling through all rows therefore drives the distance to zero, giving convergence. For inconsistent systems the iterates converge to a weighted least-squares solution.",
        complexityRationale:
            "One projection takes a dot product and an axpy over n components, O(n), so iterations visits cost O(iterations * n). Storing the iterate is O(n) apart from the O(m*n) system itself.",
        uses: [
            "Computed tomography and image reconstruction from projections",
            "Solving huge sparse linear systems row by row",
            "Randomized Kaczmarz variants in machine learning and signal processing",
        ],
        references: [
            "Kaczmarz, Angenaherte Losung von Systemen linearer Gleichungen, 1937",
            "Strohmer and Vershynin, A Randomized Kaczmarz Algorithm with Exponential Convergence, 2009",
        ],
        workedExample:
            "For the system 2x + y = 5 and x + 3y = 10, starting at (0,0), projecting onto the first row gives (2, 1). Projecting onto the second row gives about (1.4, 2.87). Repeating the cycle converges to (1, 3), which satisfies both equations exactly.",
    },
    id: "kaczmarz-method",
    name: "Kaczmarz Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n)", space: "O(m*n)" },
    defaultInput: { matrix: [[2, 1], [1, 3]], b: [5, 10], iterations: 18 },
    visualType: "array",
    run,
    pseudocode: [
        "start from an initial guess for x",
        "for each iteration pick the next row in cyclic order",
        "compute the residual of that row at the current x",
        "divide by the squared norm of the row",
        "move x along the row by that scaled residual",
        "satisfy the chosen equation exactly",
        "repeat over all rows until the residual is small",
        "done: report the solution and residual norm",
    ],
};

export default module;
