/**
 * regula-falsi.ts - Regula Falsi (Method of False Position)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Regula falsi keeps a bracket [a, b] around a root and replaces the secant
 * interpolation point with the point where the chord between (a, f(a)) and
 * (b, f(b)) crosses the axis. The subinterval that still brackets the root is
 * kept, so the root can never be lost. It is a bracketing cousin of the secant
 * method with guaranteed, if sometimes slow, convergence.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations) function evaluations, one new point per step
 *   Space: O(1) for the bracket endpoints
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Three bars show the left endpoint, the interpolated point, and right endpoint.
 *   - The interpolated point is yellow; the retained bracket is green at the end.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** The demo function: f(x) = x squared minus two. */
function f(x: number): number {
    return x * x - 2;
}

/** Build the bracket and interpolation bars for one step. */
function makeBars(a: number, xr: number, b: number, active: boolean): VisualEntity[] {
    const values = [a, xr, b];
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (active && index === 1) {
            state = "comparing";
        } else if (!active) {
            state = "sorted";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(5),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, role: index === 0 ? "a" : index === 1 ? "xr" : "b" },
        };
    });
}

/** Replay the false-position iteration on a fixed bracket. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number; iterations?: number } | null) ?? {};
    let a = typeof task.a === "number" ? task.a : 1;
    let b = typeof task.b === "number" ? task.b : 2;
    const iterations =
        typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 30;

    if (f(a) * f(b) > 0) {
        yield {
            stepNumber: 0,
            entities: makeBars(a, (a + b) / 2, b, false),
            edges: [],
            description: "The endpoints do not straddle a root; swap them or choose a new bracket.",
            codeLineNumber: 0,
            layout: "array",
            meta: { root: a, residual: Math.abs(f(a)), iteration: 0, converged: false },
        };
        return;
    }

    yield {
        stepNumber: 0,
        entities: makeBars(a, (a + b) / 2, b, true),
        edges: [],
        description: `Bracket [${a}, ${b}] straddles a root of f(x) = x^2 - 2.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { root: a, residual: Math.abs(f(a)), iteration: 0, converged: false },
    };

    let step = 1;
    let xr = a;
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const fa = f(a);
        const fb = f(b);
        if (fa === fb) {
            break;
        }
        xr = (a * fb - b * fa) / (fb - fa);
        const fxr = f(xr);
        if (fa * fxr < 0) {
            b = xr;
        } else {
            a = xr;
        }
        const converged = Math.abs(fxr) < 1e-12;
        yield {
            stepNumber: step,
            entities: makeBars(a, xr, b, true),
            edges: [],
            description: `Iteration ${iteration}: chord crosses at ${xr.toFixed(8)}; residual ${Math.abs(fxr).toExponential(2)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { root: xr, residual: Math.abs(fxr), iteration, converged },
        };
        step += 1;
        if (converged) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(a, xr, b, false),
        edges: [],
        description: `Root approximated as ${xr.toFixed(10)} after ${step - 1} iteration(s).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { root: xr, residual: Math.abs(f(xr)), iteration: step - 1, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Bisection only uses the midpoint of a bracket, ignoring how close each endpoint is to the root. False position instead draws a straight chord between the two function values and uses the chord's crossing point. It keeps whichever half still brackets the root, so the answer is always trapped inside the interval while converging faster than plain bisection on many functions.",
        invariants: [
            "The endpoints a and b always satisfy f(a) times f(b) less than or equal to zero.",
            "Each interpolation point lies between the current endpoints.",
            "The retained subinterval always contains at least one root.",
        ],
        correctness:
            "Because the new point is formed as a weighted average of a and b with weights based on the function values, it lies strictly between them. Replacing the endpoint whose function value shares the sign of f(xr) preserves the opposite-sign condition at the bracket, so a root is never discarded. The bracket width therefore shrinks and the method converges; for a simple root the convergence rate is superlinear when one endpoint stays fixed and linear otherwise.",
        complexityRationale:
            "Each iteration evaluates f once at the new point and does a constant number of arithmetic operations, giving O(iterations) time for a cheap function. Only the two bracket endpoints and the current estimate are stored, so space is O(1).",
        uses: [
            "Root finding in engineering formulas where a bracket is known",
            "Solving equilibrium equations in scientific computing",
            "A robust fallback when derivative-based methods diverge",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, Section 2.3",
            "Press et al., Numerical Recipes, Chapter 9",
        ],
        workedExample:
            "For f(x) = x^2 - 2 on [1, 2], the chord through (1, -1) and (2, 2) crosses at 1.3333. Since f(1.3333) is negative, the left endpoint moves up to 1.3333. Repeating narrows the bracket toward the square root of two, about 1.41421.",
    },
    id: "regula-falsi",
    name: "Regula Falsi",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { a: 1, b: 2, iterations: 30 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a bracket a, b with f(a) times f(b) negative",
        "for each allowed iteration",
        "set xr to the chord's horizontal intercept",
        "if f(a) times f(xr) is negative, set b to xr",
        "otherwise set a to xr",
        "stop when the residual f(xr) is tiny",
        "done: report the final root approximation",
    ],
};

export default module;
