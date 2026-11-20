/**
 * steffensen-method.ts - Steffensen's Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Steffensen's method turns a merely linearly convergent fixed-point
 * iteration into a quadratically convergent root finder. It applies Aitken's
 * delta-squared process to the map g(x) = x + f(x), producing an update that
 * needs no derivative yet converges about as fast as Newton's method near a
 * simple root.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations) function evaluations, two per step
 *   Space: O(iterations) for the emitted iterate bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per iterate, with the most recent one highlighted.
 *   - The final frame marks all iterates as sorted and reports the root.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SteffensenInput {
    x0?: number;
    iterations?: number;
}

/** Demo target: f(x) = x squared minus two. */
function f(x: number): number {
    return x * x - 2;
}

function makeBars(iterates: number[], done: boolean): VisualEntity[] {
    return iterates.map((value, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === iterates.length - 1) {
            state = "comparing";
        }
        return {
            id: `iterate-${index}`,
            type: "bar" as const,
            label: value.toFixed(6),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, role: "iterate" },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SteffensenInput | null) ?? {};
    let x = typeof task.x0 === "number" && Number.isFinite(task.x0) ? task.x0 : 1;
    const iterations = typeof task.iterations === "number"
        ? Math.max(1, Math.min(100, Math.floor(task.iterations)))
        : 12;
    const iterates: number[] = [x];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(iterates, false),
        edges: [],
        description: `Starting Steffensen's method at x = ${x.toFixed(6)} for f(x) = x^2 - 2.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { root: x, residual: Math.abs(f(x)), iteration: 0, converged: false },
    };
    step += 1;

    let converged = false;
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const fx = f(x);
        const gx = x + fx;
        const fg = f(gx);
        const denominator = fg - fx;
        if (Math.abs(denominator) < 1e-15) {
            converged = true;
            break;
        }
        const next = x - (fx * fx) / denominator;
        x = next;
        iterates.push(x);
        const residual = Math.abs(f(x));
        converged = residual < 1e-13;
        yield {
            stepNumber: step,
            entities: makeBars(iterates, false),
            edges: [],
            description: `Step ${iteration}: f(x) = ${fx.toFixed(6)}, f(x+f(x)) = ${fg.toFixed(6)}; new iterate ${x.toFixed(10)}.`,
            codeLineNumber: converged ? 6 : 4,
            layout: "array",
            meta: { root: x, residual, iteration, converged, values: iterates.slice() },
        };
        step += 1;
        if (converged) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(iterates, true),
        edges: [],
        description: `Root approximated as ${x.toFixed(10)} after ${iterates.length - 1} step(s); residual ${Math.abs(f(x)).toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { root: x, residual: Math.abs(f(x)), iteration: iterates.length - 1, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A fixed-point iteration x plus f(x) converges only linearly, creeping toward a root. Steffensen watches two successive steps and fits their error behavior, then jumps directly to where the iteration was heading. The jump uses the same differences as Aitken's process but applies them to a root-finding map, so no derivative is required.",
        invariants: [
            "Each step evaluates f at x and again at x plus f(x).",
            "The update is the current x minus the square of f(x) over the difference of the two evaluations.",
            "Near a simple root the error is squared at every step, giving quadratic convergence.",
        ],
        correctness:
            "Writing g(x) = x + f(x), the fixed points of g are exactly the roots of f. Applying Aitken's delta-squared process to the sequence x, g(x), g(g(x)) gives x minus (g(x) minus x) squared over (g(g(x)) minus twice g(x) plus x). Substituting g(x) = x + f(x) and g(g(x)) = x + f(x) + f(x + f(x)) reduces this to x minus f(x) squared over (f(x + f(x)) minus f(x)), the Steffensen update. Because Aitken cancels the linear error term, the remaining error is quadratic when the root is simple.",
        complexityRationale:
            "Every iteration evaluates f twice and performs a handful of arithmetic operations, so time is O(iterations) for a cheap function. The emitted iterate list is the only growing structure; the working state is a handful of scalars, so the algorithmic space is O(1).",
        uses: [
            "Derivative-free root finding when only function values are available",
            "Accelerating contractive fixed-point schemes in scientific code",
            "A teaching bridge between fixed-point iteration and Newton's method",
        ],
        references: [
            "Steffensen, On the Secant Formula, 1933",
            "Press et al., Numerical Recipes, Chapter 9",
        ],
        workedExample:
            "Starting at x = 1 for f(x) = x^2 - 2 gives f(1) = minus 1 and f(0) = minus 2. The update is 1 minus 1 over (minus 2 minus minus 1) = 2, a single step reaching the square root of two to about four digits, far faster than plain fixed-point iteration.",
    },
    id: "steffensen-method",
    name: "Steffensen's Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { x0: 1, iterations: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a starting estimate x and a function f with a root",
        "for each allowed iteration",
        "compute fx equal to f(x)",
        "compute fg equal to f(x plus fx)",
        "set the denominator to fg minus fx",
        "if the denominator is tiny, stop",
        "replace x by x minus fx squared over the denominator",
        "stop when the residual f(x) is tiny",
        "done: report the final root approximation",
    ],
};

export default module;
