/**
 * halley-method.ts - Halley's Method for Root Finding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Halley's method is a root-finding iteration that uses both the first and
 * second derivatives. Whereas Newton takes a step based on the tangent, Halley
 * fits a hyperbola and converges cubically for a simple root, roughly doubling
 * the number of correct digits per iteration compared with Newton. The update
 * is x minus two times f times f-prime divided by two f-prime squared minus f
 * times f-double-prime.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(iterations) derivative evaluations
 *   Space: O(iterations) for the iterate trace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Points plot each iterate at its position on the function curve.
 *   - The final iterate is green; the last frame reports convergence.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

export interface HalleyResult {
    root: number;
    trace: number[];
    values: number[];
    converged: boolean;
}

/** Find a root with Halley's iteration, guarding against a zero denominator. */
export function halley(
    f: (x: number) => number,
    fp: (x: number) => number,
    fpp: (x: number) => number,
    x0: number,
    iterations = 50,
    tolerance = 1e-12,
): HalleyResult {
    const limit = Math.max(1, Math.floor(iterations));
    const trace: number[] = [x0];
    const values: number[] = [f(x0)];
    let x = x0;
    let converged = Math.abs(values[0] ?? Infinity) < tolerance;

    for (let i = 0; i < limit && !converged; i += 1) {
        const fx = f(x);
        const d1 = fp(x);
        const d2 = fpp(x);
        const denominator = 2 * d1 * d1 - fx * d2;
        if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-15) {
            break;
        }
        const next = x - (2 * fx * d1) / denominator;
        if (!Number.isFinite(next)) {
            break;
        }
        x = next;
        trace.push(x);
        values.push(f(x));
        converged = Math.abs(f(x)) < tolerance;
    }
    return { root: x, trace, values, converged };
}

function makePoints(result: HalleyResult): VisualEntity[] {
    return result.trace.map((x, index) => ({
        id: `iterate-${index}`,
        type: "node" as const,
        label: `x${index}=${x.toFixed(6)}`,
        value: x,
        state: (index === result.trace.length - 1 && result.converged ? "sorted" : "idle") as "sorted" | "idle",
        x,
        y: result.values[index] ?? 0,
        width: 0,
        height: 0,
        metadata: { iteration: index, value: result.values[index] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { start?: number; iterations?: number; tolerance?: number; polynomial?: string } | null) ?? {};
    const start = typeof task.start === "number" ? task.start : 1.5;
    const iterations = Math.min(50, Math.max(1, Math.floor(Number(task.iterations ?? 20)) || 20));
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-12;
    const useCube = task.polynomial !== "square";
    const f = useCube ? (x: number): number => x * x * x - 2 : (x: number): number => x * x - 2;
    const fp = useCube ? (x: number): number => 3 * x * x : (x: number): number => 2 * x;
    const fpp = useCube ? (x: number): number => 6 * x : (): number => 2;
    const result = halley(f, fp, fpp, start, iterations, tolerance);
    const label = useCube ? "x cubed minus 2" : "x squared minus 2";

    yield {
        stepNumber: 0,
        entities: makePoints({ ...result, trace: [result.trace[0] ?? start], values: [result.values[0] ?? 0] }),
        edges: [],
        description: `Find a root of ${label} with Halley's method from x=${start}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { polynomial: label, start, iteration: 0, root: start, residual: result.values[0] ?? 0, converged: false },
    };

    for (let i = 1; i < result.trace.length; i += 1) {
        const point = result.trace[i] ?? 0;
        yield {
            stepNumber: i,
            entities: makePoints({ ...result, trace: result.trace.slice(0, i + 1), values: result.values.slice(0, i + 1) }),
            edges: [],
            description: `Iteration ${i}: x=${point.toFixed(10)}, residual ${(result.values[i] ?? 0).toExponential(3)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { polynomial: label, start, iteration: i, root: point, residual: result.values[i] ?? 0, converged: false },
        };
    }

    yield {
        stepNumber: result.trace.length,
        entities: makePoints(result),
        edges: [],
        description: result.converged
            ? `Converged to root ${result.root.toFixed(12)} after ${result.trace.length - 1} iteration(s).`
            : `Stopped without convergence; last residual ${(result.values[result.values.length - 1] ?? 0).toExponential(3)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { polynomial: label, start, iteration: result.trace.length - 1, root: result.root, residual: result.values[result.values.length - 1] ?? 0, converged: result.converged },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Newton's method follows the tangent line to a curve; Halley's method follows a hyperbola that matches the function, its slope, and its curvature at the current point. Using that extra information makes each step land much closer to the root. For a simple root the error is roughly cubed each iteration, so the number of correct digits can triple instead of merely double.",
        invariants: [
            "Each iterate uses the function value, first derivative, and second derivative at the current point.",
            "The iteration stops when the residual is below tolerance or the denominator is too small to be reliable.",
            "For a simple root the error shrinks cubically near the solution.",
        ],
        correctness:
            "Halley's step is derived from solving the first-order Taylor model for the Newton correction and applying one Newton refinement, giving the stated rational update. For a smooth function with a simple root and a nonzero denominator, the error satisfies e next proportional to e cubed, so convergence is cubic. Tests check convergence on x cubed minus two and x squared minus two against known exact roots and an independent bisection reference, and confirm that a zero denominator at a stationary point stops cleanly.",
        complexityRationale:
            "Every iteration evaluates f, f-prime, and f-double-prime a constant number of times, so time is O(iterations) in the number of derivatives. The iterate trace grows by one point per iteration, giving O(iterations) space.",
        uses: [
            "High-precision root polishing in numerical libraries",
            "Solving nonlinear equations where derivatives are available",
            "Computing logarithms and roots in arbitrary-precision arithmetic",
        ],
        references: [
            "Halley, Methodus Nova Accurata et Facilis Inveniendi Radices Aequationum, 1694",
            "Householder, The Numerical Treatment of a Single Nonlinear Equation, 1970",
        ],
        workedExample:
            "For f(x)=x^3-2 starting at x=1.5, the first Halley step uses f=1.375, f-prime=6.75, and f-double-prime=9 to compute a denominator of about 72.8 and a new x near 1.2599. The next step already gives more than ten correct digits of the cube root of two.",
    },
    id: "halley-method",
    name: "Halley's Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(iterations)" },
    defaultInput: { polynomial: "cube", start: 1.5, iterations: 20, tolerance: 1e-12 },
    visualType: "point",
    run,
    pseudocode: [
        "choose a start, tolerance, and iteration limit",
        "evaluate f, f prime, and f double prime at the current x",
        "form the denominator two f prime squared minus f times f double prime",
        "set x to x minus two f f prime over that denominator",
        "repeat until the residual is below the tolerance",
        "stop early if the denominator is zero or non-finite",
        "done: report the root and convergence verdict",
    ],
};

export default module;
