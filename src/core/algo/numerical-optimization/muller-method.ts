/**
 * muller-method.ts - Muller's Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Muller's method finds a root by fitting a parabola through three current
 * points and stepping to the nearer root of that parabola. Where the secant
 * method uses a line through two points, the quadratic fit lets it approach
 * roots from complex directions and converge superlinearly without any
 * derivative evaluations.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations) function evaluations, one new point per step
 *   Space: O(1) working memory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars: the three interpolation points and the new estimate.
 *   - The new estimate is highlighted until the final sorted frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MullerInput {
    x0?: number;
    x1?: number;
    x2?: number;
    iterations?: number;
}

/** Demo target: f(x) = x squared minus two. */
function f(x: number): number {
    return x * x - 2;
}

function makeBars(points: number[], estimate: number, done: boolean): VisualEntity[] {
    const values = [...points, estimate];
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === values.length - 1) {
            state = "comparing";
        } else if (index === 2) {
            state = "active";
        }
        return {
            id: `value-${index}`,
            type: "bar" as const,
            label: value.toFixed(6),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, role: index === 3 ? "estimate" : "point" },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MullerInput | null) ?? {};
    let x0 = typeof task.x0 === "number" && Number.isFinite(task.x0) ? task.x0 : 1;
    let x1 = typeof task.x1 === "number" && Number.isFinite(task.x1) ? task.x1 : 2;
    let x2 = typeof task.x2 === "number" && Number.isFinite(task.x2) ? task.x2 : 3;
    const iterations = typeof task.iterations === "number"
        ? Math.max(1, Math.min(100, Math.floor(task.iterations)))
        : 12;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([x0, x1, x2], x2, false),
        edges: [],
        description: `Fitting a parabola through ${x0}, ${x1}, and ${x2} for f(x) = x^2 - 2.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { root: x2, residual: Math.abs(f(x2)), iteration: 0, converged: false },
    };
    step += 1;

    let estimate = x2;
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const f0 = f(x0);
        const f1 = f(x1);
        const f2 = f(x2);
        const h1 = x1 - x0;
        const h2 = x2 - x1;
        if (Math.abs(h1) < 1e-15 || Math.abs(h2) < 1e-15) {
            break;
        }
        const d1 = (f1 - f0) / h1;
        const d2 = (f2 - f1) / h2;
        const a = (d2 - d1) / (h1 + h2);
        const b = d2 + a * h2;
        const c = f2;
        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0 || Math.abs(a) < 1e-15) {
            break;
        }
        const root = Math.sqrt(discriminant);
        const plus = b + root;
        const minus = b - root;
        const denominator = Math.abs(plus) >= Math.abs(minus) ? plus : minus;
        if (Math.abs(denominator) < 1e-15) {
            break;
        }
        estimate = x2 - (2 * c) / denominator;
        x0 = x1;
        x1 = x2;
        x2 = estimate;
        const residual = Math.abs(f(estimate));
        const converged = residual < 1e-13;
        yield {
            stepNumber: step,
            entities: makeBars([x0, x1, x2], estimate, false),
            edges: [],
            description: `Iteration ${iteration}: quadratic coefficients a=${a.toFixed(6)}, b=${b.toFixed(6)}, c=${c.toFixed(6)}; new point ${estimate.toFixed(10)}.`,
            codeLineNumber: converged ? 8 : 6,
            layout: "array",
            meta: { root: estimate, residual, iteration, converged, discriminant },
        };
        step += 1;
        if (converged) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars([x0, x1, x2], estimate, true),
        edges: [],
        description: `Muller's method returns ${estimate.toFixed(10)} with residual ${Math.abs(f(estimate)).toExponential(2)}.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { root: estimate, residual: Math.abs(f(estimate)), iteration: step - 1, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two points determine a line, which is all the secant method needs. Three points determine a parabola, and a parabola can curve around a root instead of approaching along a straight chord. Muller's method keeps three latest points, fits that parabola each step, and jumps to the parabola root closest to the newest point.",
        invariants: [
            "The three interpolation points stay distinct until convergence.",
            "The quadratic passes exactly through the three current function values.",
            "Between steps the newest point becomes the oldest, sliding the window forward.",
        ],
        correctness:
            "Divided differences of the three points give the unique quadratic interpolant through them. Solving that quadratic with the quadratic formula yields up to two candidate roots; choosing the sign that makes the denominator largest avoids catastrophic cancellation and selects the root nearer the current point. Each iteration replaces the oldest point by the new root, so the window always brackets the most recent behavior. Near a simple root the quadratic model matches the function to second order, giving a superlinear convergence rate of about 1.84, faster than the secant method.",
        complexityRationale:
            "Each step computes three divided differences, solves one quadratic, and evaluates f once at the new point, all constant work, so time is O(iterations). The method keeps only three points and their function values, so space is O(1).",
        uses: [
            "Root finding where derivative formulas are unavailable",
            "Locating complex roots of analytic functions",
            "Solving characteristic equations in engineering analysis",
        ],
        references: [
            "Muller, A Method for Solving Algebraic Equations Using an Automatic Computer, 1956",
            "Press et al., Numerical Recipes, Chapter 9",
        ],
        workedExample:
            "For f(x) = x^2 - 2 on the points 1, 2, 3 the function values are minus 1, 2, 7. The fitted parabola gives a equal to 1, b equal to 6, and c equal to 7, so the near root is 3 minus 14 over (6 plus the square root of 8), about 1.4142, essentially the square root of two in one step.",
    },
    id: "muller-method",
    name: "Muller's Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { x0: 1, x1: 2, x2: 3, iterations: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "choose three starting points x0, x1, x2",
        "for each allowed iteration",
        "compute divided differences of the three function values",
        "form the quadratic coefficients a, b, c of the interpolating parabola",
        "compute the discriminant b squared minus four a c",
        "choose the quadratic root with the larger-magnitude denominator",
        "shift the window by replacing the oldest point with the new root",
        "stop when the residual is tiny",
        "done: report the final root approximation",
    ],
};

export default module;
