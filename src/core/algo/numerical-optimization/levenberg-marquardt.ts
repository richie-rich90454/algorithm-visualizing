/**
 * levenberg-marquardt.ts - Levenberg-Marquardt Nonlinear Least Squares
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Levenberg-Marquardt solves nonlinear least-squares problems by blending
 * Gauss-Newton with gradient descent. At each iterate it solves the damped
 * normal equations (J^T J + lambda * diag(J^T J)) delta = -J^T r, where r is the
 * residual vector and J its Jacobian. A small lambda gives a fast Gauss-Newton
 * step; a large lambda gives a short, safe descent step. After each trial the
 * cost is recomputed: a decrease accepts the step and shrinks lambda, while an
 * increase rejects it and grows lambda. This module fits the one-parameter
 * model y = exp(a * x) to synthetic data and converges to the known parameter.
 * The linear algebra is a small exact Gaussian elimination, so results are
 * deterministic; the model is intentionally tiny for teaching.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * (m * d^2 + d^3)) for m residuals and d parameters
 *   Space: O(d^2 + m * d) for the damped matrix and the Jacobian
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per observation shows its current residual magnitude.
 *   - A decreasing step is green, a rejected step is red.
 *   - The metadata carries the parameter history, costs, and damping history.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LMInput {
    aTrue?: number;
    iterations?: number;
    lambda?: number;
    xs?: number[];
}

/** Solve a small dense linear system by Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] | null {
    const n = b.length;
    const aug = a.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(aug[r]![col]!) > Math.abs(aug[pivot]![col]!)) pivot = r;
        }
        if (Math.abs(aug[pivot]![col]!) < 1e-14) return null;
        if (pivot !== col) {
            const tmp = aug[col]!;
            aug[col] = aug[pivot]!;
            aug[pivot] = tmp;
        }
        const pv = aug[col]![col]!;
        for (let r = col + 1; r < n; r += 1) {
            const factor = aug[r]![col]! / pv;
            for (let c = col; c <= n; c += 1) {
                aug[r]![c] = aug[r]![c]! - factor * aug[col]![c]!;
            }
        }
    }
    const x = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
        let sum = aug[i]![n]!;
        for (let j = i + 1; j < n; j += 1) sum -= aug[i]![j]! * x[j]!;
        x[i] = sum / aug[i]![i]!;
    }
    return x;
}

/** Residual and derivative for the model y = exp(a * x). */
function residual(a: number, x: number, y: number): number {
    return Math.exp(a * x) - y;
}
function derivative(a: number, x: number): number {
    return x * Math.exp(a * x);
}

/** Build residual bars for a frame. */
function makeBars(residuals: number[], accepted: boolean): VisualEntity[] {
    return residuals.map((r, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: Math.abs(r).toExponential(2),
        value: Math.abs(r),
        state: (accepted ? "sorted" : "error") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, residual: r },
    }));
}

/** The Levenberg-Marquardt generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LMInput | null) ?? {};
    const xs = Array.isArray(task.xs) && task.xs.length > 0 ? task.xs : [0, 0.5, 1, 1.5, 2];
    const aTrue = typeof task.aTrue === "number" ? task.aTrue : 0.6;
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.min(40, Math.floor(task.iterations))) : 12;
    let lambda = typeof task.lambda === "number" && task.lambda > 0 ? task.lambda : 0.01;
    const ys = xs.map((x) => Math.exp(aTrue * x));

    let a = 0;
    const cost = (p: number): number => xs.reduce((s, x, i) => s + residual(p, x, ys[i] ?? 0) ** 2, 0);
    const residuals = (p: number): number[] => xs.map((x, i) => residual(p, x, ys[i] ?? 0));

    let currentCost = cost(a);
    const params: number[] = [a];
    const costs: number[] = [currentCost];
    const lambdas: number[] = [lambda];
    let accepted = true;
    let step = 0;

    yield {
        stepNumber: step++,
        entities: makeBars(residuals(a), accepted),
        edges: [],
        description: `Fit y = exp(a x) to ${xs.length} points generated with a = ${aTrue}; start a = ${a}, cost ${currentCost.toExponential(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { xs, ys, aTrue, a, cost: currentCost, lambda, params: [...params], costs: [...costs], lambdas: [...lambdas], accepted },
    };

    for (let iter = 0; iter < iterations; iter += 1) {
        // Build the Jacobian and gradient of the residual vector.
        const J = xs.map((x) => derivative(a, x));
        const r = residuals(a);
        let jtj = 0;
        for (const j of J) jtj += j * j;
        let jtr = 0;
        for (let i = 0; i < J.length; i += 1) jtr += J[i]! * r[i]!;

        // Damped normal equation in one parameter: (jtj + lambda * jtj) delta = -jtr.
        const solved = solve([[jtj * (1 + lambda)]], [-jtr]);
        const delta = solved?.[0] ?? 0;
        const candidate = a + delta;
        const candidateCost = cost(candidate);

        if (candidateCost < currentCost) {
            a = candidate;
            currentCost = candidateCost;
            lambda = Math.max(1e-9, lambda / 3);
            accepted = true;
        } else {
            lambda *= 10;
            accepted = false;
        }

        params.push(a);
        costs.push(currentCost);
        lambdas.push(lambda);

        yield {
            stepNumber: step++,
            entities: makeBars(residuals(a), accepted),
            edges: [],
            description: accepted
                ? `Iteration ${iter + 1}: step accepted, a = ${a.toFixed(6)}, cost ${currentCost.toExponential(3)}, lambda shrinks to ${lambda.toExponential(2)}.`
                : `Iteration ${iter + 1}: step rejected, a stays ${a.toFixed(6)}, lambda grows to ${lambda.toExponential(2)}.`,
            codeLineNumber: accepted ? 5 : 6,
            layout: "array",
            meta: { xs, ys, aTrue, a, cost: currentCost, lambda, params: [...params], costs: [...costs], lambdas: [...lambdas], accepted },
        };
    }

    yield {
        stepNumber: step++,
        entities: makeBars(residuals(a), true),
        edges: [],
        description: `Converged to a = ${a.toFixed(8)} (true ${aTrue}) with cost ${currentCost.toExponential(3)} after ${iterations} iteration(s).`,
        codeLineNumber: 7,
        layout: "array",
        meta: { xs, ys, aTrue, a, cost: currentCost, lambda, params: [...params], costs: [...costs], lambdas: [...lambdas], accepted: true, finalError: Math.abs(a - aTrue) },
    };
}

/** The Levenberg-Marquardt module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Gauss-Newton takes big, fast steps but can overshoot when the current guess is poor; gradient descent takes small, reliable steps but crawls near the answer. Levenberg-Marquardt blends them with a damping knob. When a trial step improves the fit, the knob loosens and the method behaves like Gauss-Newton; when it makes things worse, the knob tightens and the method falls back to a cautious downhill step.",
        invariants: [
            "The cost is the sum of squared residuals and never increases on an accepted step.",
            "A rejected step leaves the parameter and the cost unchanged.",
            "The damping parameter is positive and only shrinks after success or grows after failure.",
        ],
        correctness:
            "The Gauss-Newton direction solves J^T J delta = -J^T r, which is the Newton step for the Gauss-Newton approximation of the least-squares Hessian. Adding lambda times the diagonal makes the matrix positive definite and shortens the step, guaranteeing a descent direction for lambda greater than zero because delta is minus the scaled gradient. Accepting only cost-reducing steps therefore makes the sequence monotone, and the damping adaptation drives lambda toward zero near a minimum where the model is accurate, recovering fast local convergence.",
        complexityRationale:
            "Per iteration the module evaluates m residuals and derivatives, forms J^T J and J^T r in O(m d) for d parameters, and solves a d by d system in O(d^3), giving O(m d^2 + d^3) per step. Storing the Jacobian and the damped matrix uses O(m d + d^2) space.",
        uses: [
            "Curve fitting and parameter estimation in experimental science",
            "Camera calibration and bundle adjustment in computer vision",
            "Training small nonlinear models with classical optimization",
        ],
        references: [
            "Levenberg, A Method for the Solution of Certain Nonlinear Problems, 1944",
            "Marquardt, An Algorithm for Least-Squares Estimation of Nonlinear Parameters, 1963",
            "Numerical Recipes, 3rd edition, Section 15.5",
        ],
        workedExample:
            "Fitting y = exp(0.6 x) at x = 0, 0.5, 1, 1.5, 2 starting from a = 0, the first Gauss-Newton-like step moves a upward and reduces the cost. Each accepted step shrinks lambda, so later steps grow larger until a approaches 0.6 and the residuals fall to nearly zero.",
    },
    id: "levenberg-marquardt",
    name: "Levenberg-Marquardt Optimization",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * (m d^2 + d^3))", space: "O(m d + d^2)" },
    defaultInput: { aTrue: 0.6, xs: [0, 0.5, 1, 1.5, 2], iterations: 12, lambda: 0.01 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the model, the data, and an initial parameter and damping",
        "compute the residual vector and its cost",
        "form the Jacobian of residuals with respect to parameters",
        "build J transpose J and J transpose r",
        "solve the damped system for the parameter step",
        "if the cost falls accept the step and shrink lambda",
        "otherwise reject the step and grow lambda",
        "done: report the fitted parameter and final cost",
    ],
};

export default module;
