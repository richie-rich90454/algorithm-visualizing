/**
 * secant-method.ts - The Secant Method for Root Finding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The secant method finds a root of a function using two starting guesses and
 * no derivative. Each step draws a line through the two most recent points on
 * the curve and takes its intercept with the horizontal axis as the next
 * guess. It converges faster than bisection but does not keep a bracket around
 * the root.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * cost of f)
 *   Space: O(1) beyond the stored guesses
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The most recent guesses are shown as bars.
 *   - The newest guess is yellow while it is computed.
 *   - The final approximation is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** The fixed demo function: f(x) = x squared minus two. */
function f(x: number): number {
    return x * x - 2;
}

/** Build the guess bars for the current iteration. */
function makeBars(
    values: number[],
    active: Set<number> = new Set(),
    state: EntityState = "idle",
): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: active.has(index) ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The secant method generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number; iterations?: number } | null) ?? {};
    let x0 = typeof task.a === "number" ? task.a : 1;
    let x1 = typeof task.b === "number" ? task.b : 2;
    const iterations =
        typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 8;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([x0, x1]),
        edges: [],
        description: `Finding a root of f(x) = x^2 - 2 from guesses ${x0} and ${x1}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, root: x1, error: Math.abs(f(x1)), converged: false },
    };
    step += 1;

    let converged = false;
    let used = 0;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const f0 = f(x0);
        const f1 = f(x1);
        if (f0 === f1 || !Number.isFinite(f0) || !Number.isFinite(f1)) {
            break;
        }
        const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
        if (!Number.isFinite(x2)) {
            break;
        }
        used = iteration + 1;
        converged = Math.abs(x2 - x1) < 1e-12;
        yield {
            stepNumber: step,
            entities: makeBars([x0, x1, x2], new Set([2])),
            edges: [],
            description: `Iteration ${used}: secant through (${x0.toFixed(4)}, ${f0.toFixed(4)}) and (${x1.toFixed(4)}, ${f1.toFixed(4)}) gives ${x2.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { iteration: used, root: x2, error: Math.abs(f(x2)), converged },
        };
        step += 1;
        x0 = x1;
        x1 = x2;
        if (converged) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars([x1], new Set(), "sorted"),
        edges: [],
        description: `Root approximated as ${x1.toFixed(8)} after ${used} iteration(s); residual ${Math.abs(f(x1)).toExponential(2)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { iteration: used, root: x1, error: Math.abs(f(x1)), converged },
    };
}

/** The secant method module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Take two guesses and look at the function values there. Draw a straight line between those two points; where the line crosses the horizontal axis is usually a better guess. Drop the older guess, keep the newer two, and repeat.",
        invariants: [
            "Each new estimate is the x-intercept of the line through the last two function values.",
            "The two most recent guesses are retained for the next secant line.",
            "The residual f(x) shrinks as the estimate approaches a simple root.",
        ],
        correctness:
            "Near a simple root the secant step is a Newton step with the derivative replaced by a divided difference. Expanding the error shows that the new error is proportional to the product of the previous two errors, so convergence is superlinear with order about 1.618 whenever the guesses start close enough to the root.",
        complexityRationale:
            "Each iteration evaluates the function twice and does a constant amount of arithmetic, so the cost is O(iterations) for a cheap f. Only two guesses and their values are stored, giving O(1) space.",
        uses: [
            "Solving nonlinear equations without analytic derivatives",
            "Root finding in engineering simulation software",
            "Initializing more robust bracketing methods",
        ],
        references: [
            "Press et al., Numerical Recipes, Chapter 9",
            "Burden and Faires, Numerical Analysis, Section 2.4",
        ],
        workedExample:
            "From x0 = 1 and x1 = 2 for f(x) = x^2 - 2, the secant line gives x2 = 1.3333, then x3 = 1.4000, then x4 = 1.4142, which is the square root of two to four decimal places.",
    },
    id: "secant-method",
    name: "Secant Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { a: 1, b: 2, iterations: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "choose two starting guesses and evaluate the function",
        "for each allowed iteration",
        "compute the slope between the last two points",
        "set the next guess to the line's horizontal intercept",
        "discard the oldest guess and keep the newer pair",
        "stop when successive guesses are nearly equal",
        "done: report the final root approximation",
    ],
};

export default module;
