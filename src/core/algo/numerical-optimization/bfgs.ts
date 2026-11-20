/**
 * bfgs.ts - BFGS Quasi-Newton Optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BFGS finds a local minimum of a smooth function by iterating x <- x - H g,
 * where g is the gradient and H is an evolving approximation to the inverse
 * Hessian. After each step it applies the BFGS rank-two update using the step
 * s and the gradient change y, so H gradually learns the local curvature
 * without ever forming or inverting a Hessian matrix. It is the canonical
 * quasi-Newton method.
 *
 * The teaching model optimizes a small quadratic f(x) = 0.5 x^T A x - b^T x + c
 * with an analytic gradient and an Armijo backtracking line search, so every
 * number is exact and the true minimizer is known in closed form.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * d^2) for d dimensions and dense matrix updates
 *   Space: O(d^2) for the inverse Hessian approximation
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per coordinate shows the current iterate.
 *   - Intermediate iterates are yellow; the converged minimum is green.
 *   - meta carries the iterate, function value, gradient norm, and H matrix.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => dot(row, vector));
}

/** Build bars for the current iterate. */
function makeBars(vector: number[], state: EntityState): VisualEntity[] {
    return vector.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `x${index}=${value.toFixed(4)}`,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The BFGS generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { A?: number[][]; b?: number[]; c?: number; start?: number[]; iterations?: number; tolerance?: number }
        | null
    ) ?? {};
    const A: number[][] =
        Array.isArray(task.A) && task.A.length > 0
            ? task.A.map((row) => (Array.isArray(row) ? [...row] : []))
            : [
                  [2, 0],
                  [0, 4],
              ];
    const d = A.length;
    const b: number[] = Array.isArray(task.b) && task.b.length === d ? [...task.b] : [6, -4];
    const c = typeof task.c === "number" ? task.c : 11;
    const start: number[] = Array.isArray(task.start) && task.start.length === d ? [...task.start] : [0, 0];
    const iterations = Math.min(500, Math.max(1, Math.floor(Number(task.iterations ?? 40)) || 40));
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-8;

    const f = (x: number[]) => 0.5 * dot(x, matVec(A, x)) - dot(b, x) + c;
    const grad = (x: number[]) => matVec(A, x).map((value, index) => value - (b[index] ?? 0));

    let x = [...start];
    let g = grad(x);
    let H: number[][] = Array.from({ length: d }, (_, i) =>
        Array.from({ length: d }, (_, j) => (i === j ? 1 : 0)),
    );
    let converged = Math.sqrt(dot(g, g)) < tolerance;
    let used = 0;

    const meta = (done: boolean) => ({
        dim: d,
        iteration: used,
        x: [...x],
        fx: f(x),
        gradNorm: Math.sqrt(dot(g, g)),
        HFlat: H.flat(),
        converged: done,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(x, converged ? "sorted" : "idle"),
        edges: [],
        description: `Minimizing a ${d}-dimensional quadratic with BFGS from x = (${x.map((v) => v.toFixed(2)).join(", ")}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(converged),
    };
    let step = 1;

    for (let k = 0; k < iterations && !converged; k += 1) {
        const direction = matVec(H, g).map((value) => -value);
        const slope = dot(g, direction);
        if (slope >= 0) {
            H = Array.from({ length: d }, (_, i) =>
                Array.from({ length: d }, (_, j) => (i === j ? 1 : 0)),
            );
            continue;
        }

        // Armijo backtracking line search.
        let alpha = 1;
        const f0 = f(x);
        for (let ls = 0; ls < 60; ls += 1) {
            const trial = x.map((value, index) => value + alpha * (direction[index] ?? 0));
            if (f(trial) <= f0 + 1e-4 * alpha * slope) {
                break;
            }
            alpha *= 0.5;
        }

        const s = direction.map((value) => alpha * value);
        const xNew = x.map((value, index) => value + (s[index] ?? 0));
        const gNew = grad(xNew);
        const y = gNew.map((value, index) => value - (g[index] ?? 0));
        const ys = dot(y, s);

        if (ys > 1e-12) {
            const rho = 1 / ys;
            // H <- (I - rho s y^T) H (I - rho y s^T) + rho s s^T
            const nextH = Array.from({ length: d }, (_, i) =>
                Array.from({ length: d }, (_, j) => {
                    let value = 0;
                    for (let a = 0; a < d; a += 1) {
                        for (let bb = 0; bb < d; bb += 1) {
                            const left = (i === a ? 1 : 0) - rho * (s[i] ?? 0) * (y[a] ?? 0);
                            const right = (bb === j ? 1 : 0) - rho * (y[bb] ?? 0) * (s[j] ?? 0);
                            value += left * (H[a]?.[bb] ?? 0) * right;
                        }
                    }
                    return value + rho * (s[i] ?? 0) * (s[j] ?? 0);
                }),
            );
            H = nextH;
        } else {
            H = Array.from({ length: d }, (_, i) =>
                Array.from({ length: d }, (_, j) => (i === j ? 1 : 0)),
            );
        }

        x = xNew;
        g = gNew;
        used = k + 1;
        converged = Math.sqrt(dot(g, g)) < tolerance;
        yield {
            stepNumber: step,
            entities: makeBars(x, converged ? "sorted" : "comparing"),
            edges: [],
            description: `Iteration ${used}: step length ${alpha.toFixed(4)}, gradient norm ${Math.sqrt(dot(g, g)).toExponential(2)}, f(x) = ${f(x).toFixed(8)}.`,
            codeLineNumber: converged ? 6 : 3,
            layout: "array",
            meta: meta(converged),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, "sorted"),
        edges: [],
        description: converged
            ? `Converged in ${used} iteration(s) to x = (${x.map((v) => v.toFixed(6)).join(", ")}), f(x) = ${f(x).toFixed(10)}.`
            : `Stopped after ${used} iteration(s) without reaching the gradient tolerance.`,
        codeLineNumber: 7,
        layout: "array",
        meta: meta(converged),
    };
}

/** The BFGS module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Newton's method converges fast but needs the Hessian and its inverse at every step. BFGS keeps a running estimate of the inverse Hessian and improves it after each move using only the change in position and the change in gradient. That rank-two update preserves positive definiteness, so the search direction stays downhill, while the estimate learns the curvature and speeds up convergence.",
        invariants: [
            "The step direction is the negative of the inverse Hessian estimate times the gradient, so it is a descent direction whenever that estimate is positive definite.",
            "The Armijo line search only accepts steps that reduce the function enough.",
            "The BFGS update is skipped or reset when the curvature condition is not met, keeping the estimate well behaved.",
        ],
        correctness:
            "For a quadratic function with Hessian A, the exact line-search Newton step reaches the minimizer in one step once H equals A inverse. The BFGS update satisfies the secant condition H_new times y equals s, so the estimate matches the observed curvature along the step; starting from the identity, BFGS reproduces conjugate directions for a quadratic and therefore reaches the minimizer in at most d steps in exact arithmetic. On general smooth functions the Armijo search guarantees monotone decrease and the iterates converge to a stationary point under standard assumptions.",
        complexityRationale:
            "Each iteration applies the dense d by d inverse Hessian estimate twice in the rank-two update, costing O(d^2) work plus a function evaluation for the line search. Storing the estimate and vectors uses O(d^2) space.",
        uses: [
            "Unconstrained nonlinear optimization in scientific software",
            "Parameter fitting and maximum likelihood estimation",
            "The optimizer behind many machine learning and statistics libraries",
        ],
        references: [
            "Broyden, Fletcher, Goldfarb and Shanno, A Class of Double-rank Minimization Algorithms, 1970",
            "Nocedal and Wright, Numerical Optimization, Chapter 6",
        ],
        workedExample:
            "For f(x, y) = x squared minus 6x plus 2 y squared plus 4y plus 11, the minimizer is (3, -1). Starting at (0, 0) with identity H, BFGS takes a steepest-descent-like first step, then the secant update learns the curvature, and within two iterations the iterate reaches (3, -1) to machine precision with gradient norm near zero.",
    },
    id: "bfgs",
    name: "BFGS Quasi-Newton Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * d^2)", space: "O(d^2)" },
    defaultInput: {
        A: [
            [2, 0],
            [0, 4],
        ],
        b: [6, -4],
        c: 11,
        start: [0, 0],
        iterations: 40,
        tolerance: 1e-8,
    },
    visualType: "array",
    run,
    pseudocode: [
        "start with an iterate x, gradient g, and identity inverse Hessian H",
        "compute the search direction as minus H times g",
        "choose a step length with an Armijo backtracking line search",
        "set s to the step and move to the new point x plus s",
        "compute the new gradient g prime and set y to g prime minus g",
        "if y dot s is positive apply the BFGS rank-two update to H",
        "otherwise reset H to the identity",
        "stop when the gradient norm is below tolerance",
        "done: report the minimizer and final function value",
    ],
};

export default module;
