/**
 * chambolle-pock.ts - Chambolle-Pock Primal-Dual Algorithm
 *
 * Chambolle-Pock solves convex problems of the form minimize F(Kx) + G(x) by
 * alternating a proximal step on the convex conjugate of F with a proximal step
 * on G. An extrapolated point feeds the dual update, which is the change that
 * gives the method its fast convergence. The only requirement is that the step
 * sizes satisfy tau * sigma * norm(K)^2 < 1.
 *
 * The teaching problem is a diagonal least-squares fit with an L1 penalty. It
 * has a closed-form soft-threshold solution, so the iterate can be checked
 * against the exact answer at every replay.
 *
 * Time O(iterations * n); space O(n) for the primal and dual vectors.
 *
 * Visualization: bars show the primal variable and the dual variable. Yellow
 * marks the dual update, green marks the final primal solution.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CpInput {
    a?: number[];
    b?: number[];
    lambda?: number;
    iterations?: number;
}

/** Soft thresholding: the prox operator of tau times the absolute value. */
function soft(value: number, threshold: number): number {
    if (value > threshold) return value - threshold;
    if (value < -threshold) return value + threshold;
    return 0;
}

/** Closed-form minimizer of the diagonal penalized least-squares problem. */
function exactSolution(a: number[], b: number[], lambda: number): number[] {
    return a.map((ai, index) => {
        const bi = b[index] ?? 0;
        if (Math.abs(ai) < 1e-12) return 0;
        return (Math.sign(ai * bi) * Math.max(Math.abs(ai * bi) - lambda, 0)) / (ai * ai);
    });
}

function objective(a: number[], b: number[], lambda: number, x: number[]): number {
    return a.reduce((sum, ai, index) => {
        const residual = ai * (x[index] ?? 0) - (b[index] ?? 0);
        return sum + 0.5 * residual * residual + lambda * Math.abs(x[index] ?? 0);
    }, 0);
}

function makeBars(values: number[], prefix: string, state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `${prefix}-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { kind: prefix, index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CpInput | null) ?? {};
    const a = Array.isArray(task.a) && task.a.length > 0 ? task.a.map((value) => Number(value) || 0) : [1, 2, 0.5, 3];
    const b = Array.isArray(task.b) && task.b.length === a.length ? task.b.map((value) => Number(value) || 0) : [2, -1, 4, 1];
    const lambda = Math.max(0, Number(task.lambda ?? 0.8) || 0);
    const iterations = Math.max(1, Math.min(2000, Math.floor(Number(task.iterations ?? 200)) || 200));
    const normK = Math.max(...a.map((value) => Math.abs(value)), 1e-6);
    const tau = 0.9 / normK;
    const sigma = 0.9 / normK;
    const exact = exactSolution(a, b, lambda);
    let x = a.map(() => 0);
    let xbar = [...x];
    let y = a.map(() => 0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: [...makeBars(x, "x", "idle"), ...makeBars(y, "y", "idle")],
        edges: [],
        description: `Solving a ${a.length}-variable penalized least-squares problem with lambda ${lambda.toFixed(2)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, objective: objective(a, b, lambda, x), primal: [...x], dual: [...y], exact, tau, sigma },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        y = y.map((value, index) => {
            const ai = a[index] ?? 0;
            return (value + sigma * ai * (xbar[index] ?? 0) - sigma * (b[index] ?? 0)) / (1 + sigma);
        });
        const next = x.map((value, index) => soft(value - tau * (a[index] ?? 0) * (y[index] ?? 0), tau * lambda));
        xbar = next.map((value, index) => 2 * value - (x[index] ?? 0));
        x = next;

        if (iteration <= 3 || iteration % Math.max(10, Math.floor(iterations / 8)) === 0 || iteration === iterations) {
            yield {
                stepNumber: step,
                entities: [...makeBars(x, "x", iteration === iterations ? "sorted" : "idle"), ...makeBars(y, "y", "comparing")],
                edges: [],
                description: `Iteration ${iteration}: objective ${objective(a, b, lambda, x).toFixed(5)}, primal norm ${Math.hypot(...x).toFixed(3)}.`,
                codeLineNumber: iteration === iterations ? 7 : 3,
                layout: "array",
                meta: {
                    iteration,
                    objective: objective(a, b, lambda, x),
                    primal: [...x],
                    dual: [...y],
                    exact,
                    tau,
                    sigma,
                    completed: iteration === iterations,
                },
            };
            step += 1;
        }
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A primal-dual method keeps two coupled guesses: the primal variable being optimized and a dual variable that enforces the linear operator. The dual step looks at an extrapolated primal point, which stabilizes the pair, and the primal step then applies the proximal map of the regularizer. With the step sizes chosen so their product stays below one over the operator norm squared, the two guesses converge together.",
        invariants: [
            "The step sizes satisfy tau times sigma times the squared operator norm, which is less than one here.",
            "The dual update is the proximal map of the conjugate of the quadratic data term.",
            "The primal update is soft thresholding, which promotes sparse solutions.",
        ],
        correctness:
            "For a convex differentiable data term and a convex regularizer, a saddle point of the Lagrangian characterizes an optimizer of the original problem. The two proximal steps are resolvents of the subdifferentials of those convex functions, and the extrapolation makes the combined operator firmly nonexpansive when the step-size condition holds. The iterates therefore converge to a saddle point, whose primal component minimizes the penalized objective. For the diagonal test problem that minimizer is exactly the soft-threshold formula.",
        complexityRationale:
            "Both updates touch each coordinate a fixed number of times, so an iteration costs O(n) work and O(n) memory for the primal, extrapolated, and dual vectors. Total time is O(iterations * n).",
        uses: [
            "Total variation image denoising and deconvolution",
            "Sparse regression and compressed sensing reconstruction",
            "Regularized inverse problems in medical imaging",
        ],
        references: [
            "Chambolle and Pock, A First-Order Primal-Dual Algorithm for Convex Problems, 2011",
            "Boyd and Vandenberghe, Convex Optimization, Chapter 5",
        ],
        workedExample:
            "With a = [1, 2], b = [2, -1], and lambda = 0.5, the exact primal solution is [1.5, -0.25] because a times b has magnitude 2 and 2, both above the threshold 0.5. Starting from zero, the primal-dual iterates climb toward those two values while the dual variables settle near the residuals.",
    },
    id: "chambolle-pock",
    name: "Chambolle-Pock Primal-Dual Algorithm",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n)", space: "O(n)" },
    defaultInput: { a: [1, 2, 0.5, 3], b: [2, -1, 4, 1], lambda: 0.8, iterations: 200 },
    visualType: "array",
    run,
    pseudocode: [
        "choose primal and dual step sizes satisfying the norm condition",
        "initialize primal, extrapolated, and dual vectors to zero",
        "for each iteration update the dual with the extrapolated primal",
        "apply the conjugate proximal map of the data term",
        "apply soft thresholding to get the new primal vector",
        "set the extrapolated point to twice the new primal minus the old",
        "compute the penalized objective for this iterate",
        "done: report the converged primal vector and its objective",
    ],
};

export default module;
