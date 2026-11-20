/**
 * fixed-point-iteration.ts - Fixed-Point Iteration x = g(x)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A fixed point of g is a value r with r = g(r). Starting from an initial
 * guess, fixed-point iteration repeatedly sets x_{n+1} = g(x_n). When g is a
 * contraction near r the iterates converge, and the difference between two
 * successive iterates bounds the remaining error.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(I) for I iterations until convergence or the iteration cap
 *   Space: O(I) to keep the iterate history for display
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each iterate is a point at (iteration, x_n) on a number-line plot.
 *   - Earlier points are idle, the newest is active, and converged ones green.
 *   - Metadata reports the current estimate and the successive difference.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type FnKind = "cos" | "sqrt" | "linear" | "exp-neg";

interface FixedPointInput {
    fn?: FnKind;
    x0?: number;
    a?: number;
    b?: number;
    tolerance?: number;
    maxIterations?: number;
}

function makeG(kind: FnKind, a: number, b: number): (x: number) => number {
    switch (kind) {
        case "sqrt":
            return (x) => (x + a / x) / 2;
        case "linear":
            return (x) => a * x + b;
        case "exp-neg":
            return (x) => Math.exp(-x);
        case "cos":
        default:
            return (x) => Math.cos(x);
    }
}

function makeEntities(history: number[], converged: boolean): VisualEntity[] {
    return history.map((value, index) => {
        let state: EntityState = "idle";
        if (converged) state = "sorted";
        else if (index === history.length - 1) state = "active";
        return {
            id: `point-${index}`,
            type: "node" as const,
            label: value.toFixed(5),
            value,
            state,
            x: index,
            y: value,
            width: 0,
            height: 0,
            metadata: { index, iteration: index, value },
        };
    });
}

/** The fixed-point iteration generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FixedPointInput | null) ?? {};
    const kind: FnKind = task.fn ?? "cos";
    const a = Number(task.a ?? 2);
    const b = Number(task.b ?? 0.5);
    const tolerance = Math.max(1e-14, Number(task.tolerance ?? 1e-10));
    const maxIterations = Math.min(200, Math.max(1, Math.floor(Number(task.maxIterations ?? 60)) || 60));
    let x = Number(task.x0 ?? 1);
    if (!Number.isFinite(x)) x = 1;
    if ((kind === "sqrt" || kind === "exp-neg") && x <= 0) x = 1;
    const g = makeG(kind, a, b);
    const history: number[] = [x];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(history, false),
        edges: [],
        description: `Starting fixed-point search from x = ${x.toFixed(6)}; iterate until successive values differ by less than ${tolerance}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { kind, estimate: x, difference: 0, iterations: 0, converged: false },
    };
    step += 1;

    let converged = false;
    let difference = Number.POSITIVE_INFINITY;
    for (let n = 1; n <= maxIterations; n += 1) {
        const next = g(x);
        difference = Math.abs(next - x);
        x = next;
        history.push(x);
        converged = difference < tolerance;
        yield {
            stepNumber: step,
            entities: makeEntities(history, converged),
            edges: [],
            description: `Iteration ${n}: x = ${x.toFixed(8)}, change ${difference.toExponential(2)}${converged ? " - converged" : ""}.`,
            codeLineNumber: converged ? 3 : 1,
            layout: "point",
            meta: {
                kind,
                estimate: x,
                difference,
                iterations: n,
                converged,
                residual: Math.abs(g(x) - x),
            },
        };
        step += 1;
        if (converged || !Number.isFinite(x)) break;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(history, converged),
        edges: [],
        description: converged
            ? `Converged to x ≈ ${x.toFixed(10)} after ${history.length - 1} iteration(s).`
            : `Stopped at the ${maxIterations}-iteration cap; last estimate ${x.toFixed(10)}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: {
            kind,
            estimate: x,
            difference,
            iterations: history.length - 1,
            converged,
            residual: Math.abs(g(x) - x),
            done: true,
        },
    };
}

/** The fixed-point iteration module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Rearrange the equation you want to solve into the form x = g(x), then keep feeding an estimate back into g. If g pulls nearby values closer together, the sequence settles on the fixed point. The change between two successive estimates tells you how much further you probably have to go.",
        invariants: [
            "Each new estimate is exactly g applied to the previous estimate.",
            "The recorded change is the absolute difference of two successive estimates.",
            "When g is a contraction, the error is at most the change times a constant factor.",
        ],
        correctness:
            "The contraction mapping theorem says a map with Lipschitz constant L < 1 has a unique fixed point, and the iteration error after n steps is at most L^n times the initial error. Successive iterates differ by at most (1 + L) times the error, so a small change certifies a small residual when L is bounded away from one.",
        complexityRationale:
            "Each step evaluates g once, so I steps cost O(I) time and storing the history costs O(I) space. Convergence is linear with rate L, which can be slow when L is close to one.",
        uses: [
            "Solving implicit equations in scientific computing",
            "Newton's method viewed as the fixed point x - f(x)/f'(x)",
            "Iterative solvers for nonlinear systems and economics equilibria",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, Chapter 2",
            "Higham, Accuracy and Stability of Numerical Algorithms, Chapter 2",
        ],
        workedExample:
            "For x = cos(x) starting at 1, the iterates are 0.5403, 0.8576, 0.6543, and continue to oscillate inward toward 0.739085, the unique fixed point, where the change falls below tolerance.",
    },
    id: "fixed-point-iteration",
    name: "Fixed-Point Iteration",
    category: "numerical-optimization",
    complexity: { time: "O(I)", space: "O(I)" },
    defaultInput: { fn: "cos", x0: 1, tolerance: 1e-10, maxIterations: 60 },
    visualType: "point",
    run,
    pseudocode: [
        "choose an initial guess x0 and tolerance",
        "set x_next = g(x)",
        "compute the absolute change between x_next and x",
        "replace x with x_next",
        "repeat while the change exceeds the tolerance",
        "done: report the fixed-point estimate",
    ],
};

export default module;
