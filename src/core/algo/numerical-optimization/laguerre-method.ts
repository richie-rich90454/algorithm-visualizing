/**
 * laguerre-method.ts - Laguerre's Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Laguerre's method finds a root of a degree-n polynomial using the value,
 * the first derivative, and the second derivative at the current estimate.
 * It uses the degree n to build a step that is reliable even from a poor
 * starting point and converges cubically for a simple real root.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * iterations) for a degree-n polynomial with naive evaluation
 *   Space: O(1) working memory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Three bars: the current estimate, the polynomial value, and the next estimate.
 *   - The next estimate is highlighted until the final sorted frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LaguerreInput {
    x0?: number;
    iterations?: number;
}

/** Demo polynomial p(x) = x^3 - 2x - 5 and its derivatives. */
function p(x: number): number {
    return x * x * x - 2 * x - 5;
}

function dp(x: number): number {
    return 3 * x * x - 2;
}

function ddp(x: number): number {
    return 6 * x;
}

const DEGREE = 3;

function makeBars(x: number, value: number, next: number, done: boolean): VisualEntity[] {
    const values = [x, value, next];
    return values.map((v, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === 2) {
            state = "comparing";
        } else if (index === 0) {
            state = "active";
        }
        return {
            id: `value-${index}`,
            type: "bar" as const,
            label: v.toFixed(6),
            value: v,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, role: index === 0 ? "x" : index === 1 ? "p" : "next" },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LaguerreInput | null) ?? {};
    let x = typeof task.x0 === "number" && Number.isFinite(task.x0) ? task.x0 : 2;
    const iterations = typeof task.iterations === "number"
        ? Math.max(1, Math.min(100, Math.floor(task.iterations)))
        : 12;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(x, p(x), x, false),
        edges: [],
        description: `Starting Laguerre's method at x = ${x.toFixed(6)} for p(x) = x^3 - 2x - 5.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { root: x, residual: Math.abs(p(x)), iteration: 0, converged: false },
    };
    step += 1;

    let converged = false;
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const value = p(x);
        const first = dp(x);
        const second = ddp(x);
        if (Math.abs(value) < 1e-15) {
            converged = true;
            break;
        }
        const g = first / value;
        const h = g * g - second / value;
        const radicand = (DEGREE - 1) * (DEGREE * h - g * g);
        if (radicand < 0) {
            break;
        }
        const root = Math.sqrt(radicand);
        const plus = g + root;
        const minus = g - root;
        const denominator = Math.abs(plus) >= Math.abs(minus) ? plus : minus;
        if (Math.abs(denominator) < 1e-15) {
            break;
        }
        const stepSize = DEGREE / denominator;
        const next = x - stepSize;
        x = next;
        const residual = Math.abs(p(x));
        converged = residual < 1e-13;
        yield {
            stepNumber: step,
            entities: makeBars(x, p(x), x, false),
            edges: [],
            description: `Step ${iteration}: G=${g.toFixed(6)}, H=${h.toFixed(6)}; step size ${stepSize.toFixed(6)} gives x=${x.toFixed(10)}.`,
            codeLineNumber: converged ? 7 : 6,
            layout: "array",
            meta: { root: x, residual, iteration, converged, g, h, degree: DEGREE },
        };
        step += 1;
        if (converged) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, p(x), x, true),
        edges: [],
        description: `Laguerre's method returns ${x.toFixed(10)} with residual ${Math.abs(p(x)).toExponential(2)}.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { root: x, residual: Math.abs(p(x)), iteration: step - 1, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Newton's method uses the slope of a polynomial to guess the next step; Laguerre also uses how quickly that slope is changing and the polynomial's degree. Those extra facts let it choose a step that typically lands close to a root even from a distant start. It is unusually robust among polynomial root finders and usually triples the number of correct digits per step near a simple root.",
        invariants: [
            "Each step evaluates the polynomial and its first two derivatives at the same point.",
            "The radicand must be nonnegative for the real-valued step used here.",
            "The sign of the denominator is chosen to maximize its magnitude and avoid cancellation.",
        ],
        correctness:
            "Let G equal p' over p and H equal G squared minus p'' over p. For a polynomial with a root at r of multiplicity one, the logarithmic derivative of p near x can be expanded so that n over (x minus r) is approximately G plus or minus the square root of (n minus one) times (n H minus G squared). Solving for x minus r gives the Laguerre step n over that denominator. Because the expansion matches the root term exactly and the remaining terms are small near a simple root, the error after one step is proportional to the cube of the previous error, giving cubic convergence; even far from a root the step stays bounded and usually moves toward a root.",
        complexityRationale:
            "Each iteration evaluates p, p', and p'' and does constant arithmetic. With naive polynomial evaluation each evaluation is O(n) for degree n, so time is O(n times iterations). Only a handful of scalar values are kept, so space is O(1).",
        uses: [
            "Finding all roots of high-degree polynomials",
            "Computing eigenvalues as roots of characteristic polynomials",
            "Control theory and filter design where transfer-function roots matter",
        ],
        references: [
            "Laguerre, Sur la methode de Newton pour la resolution des equations, 1880",
            "Press et al., Numerical Recipes, Chapter 9",
        ],
        workedExample:
            "For p(x) = x^3 - 2x - 5 at x = 2, the value is minus 1, the derivative is 10, and the second derivative is 12. Then G is minus 10 and H is 112, so the step size is about minus 0.0946 and the next estimate is 2.0946, already close to the real root near 2.09455.",
    },
    id: "laguerre-method",
    name: "Laguerre's Method",
    category: "numerical-optimization",
    complexity: { time: "O(n * iterations)", space: "O(1)" },
    defaultInput: { x0: 2, iterations: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a starting estimate x for a degree-n polynomial p",
        "for each allowed iteration",
        "set G to p'(x) divided by p(x)",
        "set H to G squared minus p''(x) divided by p(x)",
        "compute the radicand (n-1) times (n H minus G squared)",
        "choose the sign of G plus or minus the root of the radicand with larger magnitude",
        "set the step to n divided by that denominator",
        "replace x by x minus the step and stop when p(x) is tiny",
        "done: report the final polynomial root",
    ],
};

export default module;
