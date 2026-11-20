/**
 * householder-root-method.ts - Householder's Method of Arbitrary Order
 *
 * Finds a real root of a polynomial by applying Householder's iteration of a
 * chosen order p: x_{n+1} = x_n + p * (g^(p-1)(x_n) / g^(p)(x_n)), where
 * g = 1/f. Order 2 is Newton and order 3 is Halley; this module supports any
 * order p >= 2 through truncated Taylor (jet) arithmetic, so orders 4 and up
 * are the genuinely higher-order Householder iterations.
 *
 * Time: O(p^2 * d) per step for degree d; Space: O(p + d).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A truncated Taylor series (jet) of length order+1. */
type Jet = number[];

/** Build the jet of a polynomial f at x, storing f^(k)(x)/k! in slot k. */
function polynomialJet(coefficients: number[], x: number, order: number): Jet {
    const jet: Jet = new Array(order + 1).fill(0);
    const maxDegree = coefficients.length - 1;
    const facts: number[] = new Array(maxDegree + 1).fill(1);
    for (let i = 2; i <= maxDegree; i += 1) {
        facts[i] = (facts[i - 1] ?? 1) * i;
    }
    for (let j = 0; j <= maxDegree; j += 1) {
        const c = coefficients[j] ?? 0;
        for (let k = 0; k <= Math.min(j, order); k += 1) {
            const binom = (facts[j] ?? 1) / ((facts[k] ?? 1) * (facts[j - k] ?? 1));
            jet[k] = (jet[k] ?? 0) + c * binom * x ** (j - k);
        }
    }
    return jet;
}

/** Reciprocal jet b = 1/a via the standard coefficient recurrence. */
function reciprocalJet(a: Jet): Jet {
    const n = a.length - 1;
    const b: Jet = new Array(n + 1).fill(0);
    const a0 = a[0] ?? 0;
    b[0] = 1 / a0;
    for (let k = 1; k <= n; k += 1) {
        let sum = 0;
        for (let i = 1; i <= k; i += 1) {
            sum += (a[i] ?? 0) * (b[k - i] ?? 0);
        }
        b[k] = -b[0] * sum;
    }
    return b;
}

function factorial(n: number): number {
    let result = 1;
    for (let i = 2; i <= n; i += 1) {
        result *= i;
    }
    return result;
}

function evalPolynomial(coefficients: number[], x: number): number {
    let result = 0;
    for (let i = coefficients.length - 1; i >= 0; i -= 1) {
        result = result * x + (coefficients[i] ?? 0);
    }
    return result;
}

function makeEntities(coefficients: number[], activeDegree: number): VisualEntity[] {
    return coefficients.map((c, index) => ({
        id: `coef-${index}`,
        type: "bar" as const,
        label: `${c}`,
        value: c,
        state: (index === activeDegree ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { degree: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        coefficients?: number[];
        start?: number;
        order?: number;
        iterations?: number;
        tolerance?: number;
    } | null) ?? {};
    const coefficients = task.coefficients ?? [-5, -2, 0, 1];
    let x = typeof task.start === "number" ? task.start : 2;
    const order = Math.max(2, Math.min(6, Math.floor(task.order ?? 4)));
    const iterations = Math.max(1, Math.floor(task.iterations ?? 20));
    const tolerance = task.tolerance ?? 1e-12;

    let step = 0;
    let converged = false;
    let residual = evalPolynomial(coefficients, x);

    yield {
        stepNumber: step,
        entities: makeEntities(coefficients, 0),
        edges: [],
        description: `Householder iteration of order ${order} on degree ${coefficients.length - 1} polynomial from x = ${x}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, x, residual, order, converged: false },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations && !converged; iteration += 1) {
        const fjet = polynomialJet(coefficients, x, order);
        const gjet = reciprocalJet(fjet);
        const numerator = (gjet[order - 1] ?? 0) * factorial(order - 1);
        const denominator = (gjet[order] ?? 0) * factorial(order);
        const delta = denominator === 0 ? 0 : (order * numerator) / denominator;
        x += delta;
        residual = evalPolynomial(coefficients, x);
        converged = Math.abs(delta) < tolerance || Math.abs(residual) < tolerance;
        yield {
            stepNumber: step,
            entities: makeEntities(coefficients, Math.min(coefficients.length - 1, iteration % coefficients.length)),
            edges: [],
            description: `Iteration ${iteration}: order-${order} step moved x to ${x}, residual ${residual}.`,
            codeLineNumber: converged ? 4 : 3,
            layout: "array",
            meta: { iteration, x, residual, order, converged, delta },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(coefficients, -1),
        edges: [],
        description: converged
            ? `Converged to root x = ${x} with residual ${residual}.`
            : `Stopped after ${iterations} iterations near x = ${x}, residual ${residual}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { iteration: step - 1, x, residual, order, converged, root: x },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Newton's method uses the tangent line, and Halley's method bends it with curvature. Householder's method goes further: it builds the Taylor series of the reciprocal function one over f and reads off a rational correction that cancels ever higher powers of the error. Raising the order makes each step converge faster near a simple root.",
        invariants: [
            "The jet slot k stores the kth derivative of f divided by k factorial.",
            "The reciprocal jet is the Taylor series of one over f at the current iterate.",
            "The correction is order times the ratio of the (p-1)th and pth derivatives of one over f.",
        ],
        correctness:
            "Reverting the Taylor series of f around the iterate gives the exact error as an infinite series in f(x). Truncating that series after the pth power is exactly the Householder correction, so the error of the new iterate is proportional to the old error to the power p+1 for a simple root. Hence convergence is of order p+1.",
        complexityRationale:
            "Building a jet of order p for a degree d polynomial costs O(p times d); inverting the jet and evaluating the correction costs O(p squared). The number of iterations is small for a good start, giving O(p squared times d) per step and O(p + d) space.",
        uses: [
            "High-precision root polishing in computer algebra systems",
            "Computing roots of characteristic polynomials in eigenvalue algorithms",
            "Solving nonlinear equations where each function evaluation is expensive",
        ],
        references: [
            "Householder, The Numerical Treatment of a Single Nonlinear Equation, 1970",
            "Press et al., Numerical Recipes, chapter on roots of equations",
        ],
        workedExample:
            "For f(x) = x cubed minus 2x minus 5 with start x = 2 and order 4, the reciprocal jet yields a correction that brings the iterate to about 2.0946 in a handful of steps, at which point f(x) is essentially zero.",
    },
    id: "householder-root-method",
    name: "Householder's Root-Finding Method",
    category: "numerical-optimization",
    complexity: { time: "O(p^2 * d) per iteration", space: "O(p + d)" },
    defaultInput: { coefficients: [-5, -2, 0, 1], start: 2, order: 4, iterations: 20, tolerance: 1e-12 },
    visualType: "array",
    run,
    pseudocode: [
        "read polynomial coefficients, start, order p, and tolerance",
        "evaluate f and set the current iterate x to the start",
        "build the Taylor jet of f at x up to order p",
        "invert the jet to obtain the series for one over f",
        "set step to p times the ratio of derivative p-1 to derivative p",
        "add the step to x and reevaluate the residual",
        "stop when the step or residual is below tolerance",
        "report the final root estimate and residual",
    ],
};

export default module;
