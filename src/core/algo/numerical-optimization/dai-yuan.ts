/**
 * dai-yuan.ts - Dai-Yuan Nonlinear Conjugate Gradient
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Dai-Yuan conjugate gradient method minimizes a smooth function by
 * combining the current steepest descent direction with the previous search
 * direction. Its distinctive feature is the update coefficient: the squared
 * norm of the new gradient divided by the old direction's curvature, rather
 * than the ratio of gradient norms used by Fletcher-Reeves. On a positive
 * definite quadratic with exact line search it converges in at most n steps,
 * and it keeps the search direction a descent direction for general smooth
 * objectives.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n^2) per iteration for the matrix vector products
 *   Space: O(n) for the iterate, gradient, and search direction
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One bar per coordinate shows the current iterate.
 *   - The coordinate that changed most in the last step is yellow.
 *   - meta records alpha, beta, the gradient norm, and the objective value.
 *
 * This module minimizes a dense positive definite quadratic of dimension at
 * most four; the objective and gradient are evaluated exactly in double
 * precision.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    matrix?: number[][];
    vector?: number[];
    maxIterations?: number;
    tolerance?: number;
}

const DEFAULT_MATRIX = [
    [4, 1],
    [1, 3],
];
const DEFAULT_VECTOR = [1, 2];

/** Multiply a dense matrix by a vector. */
function matVec(matrix: number[][], x: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, a, j) => sum + a * (x[j] ?? 0), 0));
}

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
}

/** Gaussian elimination with partial pivoting; an independent way to get the answer. */
function solve(matrix: number[][], vector: number[]): number[] {
    const n = vector.length;
    const a = matrix.map((row, i) => [...row, vector[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(a[r]?.[col] ?? 0) > Math.abs(a[pivot]?.[col] ?? 0)) {
                pivot = r;
            }
        }
        const temp = a[col];
        a[col] = a[pivot]!;
        a[pivot] = temp!;
        const factor = a[col]?.[col] ?? 1;
        for (let c = col; c <= n; c += 1) {
            a[col]![c] = (a[col]![c] ?? 0) / factor;
        }
        for (let r = 0; r < n; r += 1) {
            if (r === col) {
                continue;
            }
            const scale = a[r]?.[col] ?? 0;
            for (let c = col; c <= n; c += 1) {
                a[r]![c] = (a[r]![c] ?? 0) - scale * (a[col]![c] ?? 0);
            }
        }
    }
    return a.map((row) => row[n] ?? 0);
}

/** Build bars for an iterate, highlighting the largest recent change. */
function makeBars(x: number[], changed: number, done: boolean): VisualEntity[] {
    return x.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: done ? ("sorted" as EntityState) : index === changed ? ("comparing" as EntityState) : ("idle" as EntityState),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const candidate = Array.isArray(task.matrix) ? task.matrix : DEFAULT_MATRIX;
    const n = Math.max(1, Math.min(4, candidate.length));
    const matrix = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => {
            const value = candidate[i]?.[j];
            return typeof value === "number" && Number.isFinite(value) ? value : i === j ? 1 : 0;
        }),
    );
    const vector = Array.from({ length: n }, (_, i) => {
        const value = task.vector?.[i];
        return typeof value === "number" && Number.isFinite(value) ? value : (DEFAULT_VECTOR[i] ?? 0);
    });
    const maxIterations = typeof task.maxIterations === "number" && Number.isFinite(task.maxIterations)
        ? Math.max(1, Math.min(20, Math.round(task.maxIterations)))
        : 8;
    const tolerance = typeof task.tolerance === "number" && Number.isFinite(task.tolerance)
        ? Math.max(1e-14, Math.min(1e-2, task.tolerance))
        : 1e-10;

    const answer = solve(matrix, vector);
    let x = new Array<number>(n).fill(0);
    let g = matVec(matrix, x).map((value, i) => value - (vector[i] ?? 0));
    let p = g.map((value) => -value);
    const alphas: number[] = [];
    const betas: number[] = [];
    const gradients: number[] = [Math.sqrt(dot(g, g))];
    let iteration = 0;
    let changed = -1;
    let converged = dot(g, g) <= tolerance * tolerance;

    const objective = (point: number[]) => {
        const ax = matVec(matrix, point);
        return 0.5 * dot(point, ax) - dot(point, vector);
    };

    const meta = (done: boolean) => {
        return {
            dimension: n,
            matrix: matrix.map((row) => row.join(",")),
            vector,
            solution: [...answer],
            x: [...x],
            gradient: [...g],
            gradientNorm: Math.sqrt(dot(g, g)),
            objective: objective(x),
            alphas: [...alphas],
            betas: [...betas],
            gradients,
            maxCoordinateError: Math.max(...x.map((value, i) => Math.abs(value - (answer[i] ?? 0)))),
            iteration,
            converged: done ? converged : false,
            done,
        };
    };

    yield {
        stepNumber: 0,
        entities: makeBars(x, changed, false),
        edges: [],
        description: `Minimizing the ${n}-dimensional quadratic from x = 0 with the Dai-Yuan conjugate gradient update.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(false),
    };

    let step = 1;
    while (!converged && iteration < maxIterations) {
        const curvature = dot(p, matVec(matrix, p));
        const alpha = curvature > 0 ? dot(g, g) / curvature : 0;
        const next = x.map((value, i) => value + alpha * (p[i] ?? 0));
        changed = next.reduce((best, value, i) =>
            Math.abs(value - (x[i] ?? 0)) > Math.abs((next[best] ?? 0) - (x[best] ?? 0)) ? i : best, 0);
        const gNew = matVec(matrix, next).map((value, i) => value - (vector[i] ?? 0));
        const y = gNew.map((value, i) => value - (g[i] ?? 0));
        const curvatureY = dot(p, y);
        const beta = curvatureY > 0 ? dot(gNew, gNew) / curvatureY : 0;
        x = next;
        g = gNew;
        p = g.map((value, i) => -value + beta * (p[i] ?? 0));
        alphas.push(alpha);
        betas.push(beta);
        gradients.push(Math.sqrt(dot(g, g)));
        iteration += 1;
        converged = Math.sqrt(dot(g, g)) <= tolerance;
        yield {
            stepNumber: step,
            entities: makeBars(x, changed, false),
            edges: [],
            description: `Iteration ${iteration}: alpha = ${alpha.toFixed(6)}, Dai-Yuan beta = ${beta.toFixed(6)}, gradient norm ${Math.sqrt(dot(g, g)).toExponential(2)}.`,
            codeLineNumber: converged || iteration === maxIterations ? 6 : 4,
            layout: "array",
            meta: meta(false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, -1, true),
        edges: [],
        description: converged
            ? `Converged in ${iteration} iteration(s) with residual ${Math.sqrt(dot(g, g)).toExponential(2)}; solution matches Gaussian elimination.`
            : `Stopped after ${iteration} iteration(s) above the tolerance; residual ${Math.sqrt(dot(g, g)).toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: meta(true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A pure steepest descent step can zigzag badly in a narrow valley. Conjugate gradient remembers a little of the previous direction so that new steps do not undo old progress. Dai and Yuan chose a particular reminder factor: the new gradient norm squared divided by how much the old direction bent the objective. On a quadratic bowl that choice finishes in at most as many steps as there are variables.",
        invariants: [
            "The step length alpha minimizes the quadratic exactly along the current direction.",
            "The Dai-Yuan coefficient is the new squared gradient norm divided by the old direction dotted with the gradient change.",
            "For a positive definite matrix each direction has positive curvature.",
        ],
        correctness:
            "For a quadratic with positive definite Hessian A, an exact line search gives alpha equal to g dot g over p dot A p. Dai and Yuan derived beta equal to g new dot g new over p dot the gradient change, which makes successive directions A conjugate for a quadratic, so each iteration reduces the error in a new eigendirection and at most n iterations reach the exact minimizer. The gradient recurrence then terminates at the Gaussian elimination solution, which the module reports and the test verifies independently.",
        complexityRationale:
            "An iteration forms two matrix vector products and a handful of dot products, each O(n^2) for a dense n by n matrix. The iterate, gradient, and search direction occupy O(n) space, with an O(n) record of step coefficients for the visualization.",
        uses: [
            "Solving large sparse positive definite linear systems",
            "Unconstrained optimization with a nonlinear conjugate gradient loop",
            "Training and parameter fitting where storing a Hessian is impractical",
        ],
        references: [
            "Dai and Yuan, A Nonlinear Conjugate Gradient Method with a Strong Global Convergence Property, 1999",
            "Nocedal and Wright, Numerical Optimization, chapter on conjugate gradient methods",
        ],
        workedExample:
            "For A equal to [[4,1],[1,3]] and b equal to (1,2), the first gradient is (-1,-2) and the first direction is (1,2). Exact line search gives alpha 0.25, so x becomes (0.25,0.5). The gradient change is (1.5,1.75) and the new gradient is (0.5,-0.25), so Dai-Yuan beta is 0.3125 over 5, which is 0.0625; with an exact line search this coincides with Fletcher-Reeves. The next step reaches the exact solution (1/11, 7/11).",
    },
    id: "dai-yuan",
    name: "Dai-Yuan Conjugate Gradient",
    category: "numerical-optimization",
    complexity: { time: "O(n^2) per iteration", space: "O(n)" },
    defaultInput: { matrix: DEFAULT_MATRIX, vector: DEFAULT_VECTOR, maxIterations: 8, tolerance: 1e-10 },
    visualType: "array",
    run,
    pseudocode: [
        "start at x = 0 with gradient g = A x - b",
        "set the first search direction p to minus g",
        "set alpha to (g dot g) over (p dot A p)",
        "move x by alpha times p and refresh g",
        "set Dai-Yuan beta to (g new dot g new) over (p dot (g new - g))",
        "set p to minus g new plus beta times p",
        "repeat until the gradient norm is below tolerance",
        "done: report the iterate and the residual",
    ],
};

export default module;
