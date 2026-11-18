/**
 * brent-method.ts - Brent's Method for Root Finding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Brent's method finds a root of a function inside a sign-changing bracket. It
 * keeps the robustness of bisection but switches to secant steps or inverse
 * quadratic interpolation when those steps stay safely inside the bracket and
 * reduce the interval quickly. It is the default root finder in many numeric
 * libraries because it converges fast without losing the bracket.
 *
 * A fixed set of named demo functions keeps the visualization deterministic;
 * no user functions are evaluated.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations) function evaluations (at most one new value per step)
 *   Space: O(1) beyond the bracket and stored function values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars show the bracket endpoints, the contrapoint, and the best root.
 *   - The current best estimate is highlighted while it is refined.
 *   - The final frame is green when the residual is below tolerance.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type FuncName = "x2-2" | "x3-x-2" | "cos-x" | "exp-2";

const FUNCTIONS: Record<FuncName, (x: number) => number> = {
    "x2-2": (x) => x * x - 2,
    "x3-x-2": (x) => x * x * x - x - 2,
    "cos-x": (x) => Math.cos(x) - x,
    "exp-2": (x) => Math.exp(x) - 2,
};

/** Build the four bars for a frame. */
function makeBars(values: number[], active: number): VisualEntity[] {
    const labels = ["a (bracket)", "b (best)", "c (contrapoint)", "estimate"];
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${labels[index]}=${value.toFixed(5)}`,
        value,
        state: index === active ? ("comparing" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: labels[index] },
    }));
}

/** Brent's method following the classic bracketing algorithm. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { func?: string; a?: number; b?: number; tol?: number; iterations?: number } | null) ?? {};
    const name: FuncName = (task.func as FuncName) in FUNCTIONS ? (task.func as FuncName) : "x2-2";
    const f = FUNCTIONS[name];
    let a = typeof task.a === "number" ? task.a : 0;
    let b = typeof task.b === "number" ? task.b : 2;
    const tol = Math.max(0, Number(task.tol ?? 1e-10));
    const maxIter = Math.max(1, Math.floor(Number(task.iterations ?? 40)) || 40);

    let fa = f(a);
    let fb = f(b);
    const signOk = (fa < 0 && fb > 0) || (fa > 0 && fb < 0);
    const eps = Number.EPSILON;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([a, b, a, b], 1),
        edges: [],
        description: `Find a root of ${name} in [${a}, ${b}] with ${signOk ? "a valid sign-changing bracket" : "endpoints that do not bracket a root"}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { func: name, root: b, residual: Math.abs(fb), iteration: 0, converged: false, bracket: [a, b] },
    };
    step += 1;

    if (!signOk) {
        yield {
            stepNumber: step,
            entities: makeBars([a, b, a, b], 1),
            edges: [],
            description: "The endpoints have the same sign, so Brent's method cannot start; no root is claimed.",
            codeLineNumber: 7,
            layout: "array",
            meta: { func: name, root: b, residual: Math.abs(fb), iteration: 0, converged: false, bracket: [a, b], note: "invalid bracket" },
        };
        return;
    }

    let c = a;
    let fc = fa;
    let d = b - a;
    let e = d;
    let iteration = 0;
    let converged = false;

    for (; iteration < maxIter; iteration += 1) {
        if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) {
            c = a;
            fc = fa;
            d = b - a;
            e = d;
        }
        if (Math.abs(fc) < Math.abs(fb)) {
            const oldB = b;
            a = b;
            b = c;
            c = oldB;
            fa = fb;
            fb = fc;
            fc = fa;
        }

        const tol1 = 2 * eps * Math.abs(b) + 0.5 * tol;
        const xm = 0.5 * (c - b);
        if (Math.abs(xm) <= tol1 || fb === 0) {
            converged = true;
            break;
        }

        if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
            const s = fb / fa;
            let p: number;
            let q: number;
            if (a === c) {
                p = 2 * xm * s;
                q = 1 - s;
            } else {
                q = fa / fc;
                const r = fb / fc;
                p = s * (2 * xm * q * (q - r) - (b - a) * (r - 1));
                q = (q - 1) * (r - 1) * (s - 1);
            }
            if (p > 0) {
                q = -q;
            }
            p = Math.abs(p);
            const min1 = 3 * xm * q - Math.abs(tol1 * q);
            const min2 = Math.abs(e * q);
            if (2 * p < Math.min(min1, min2)) {
                e = d;
                d = p / q;
            } else {
                d = xm;
                e = d;
            }
        } else {
            d = xm;
            e = d;
        }

        a = b;
        fa = fb;
        b += Math.abs(d) > tol1 ? d : (xm > 0 ? tol1 : -tol1);
        fb = f(b);
        if (!Number.isFinite(fb)) {
            break;
        }

        yield {
            stepNumber: step,
            entities: makeBars([a, b, c, b], 1),
            edges: [],
            description: `Iteration ${iteration + 1}: best estimate ${b.toFixed(10)}, residual ${Math.abs(fb).toExponential(2)}, bracket width ${Math.abs(c - a).toExponential(2)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: {
                func: name,
                root: b,
                residual: Math.abs(fb),
                iteration: iteration + 1,
                converged: Math.abs(xm) <= tol1,
                bracket: [Math.min(a, c), Math.max(a, c)],
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars([a, b, c, b], 1),
        edges: [],
        description: `Root of ${name} approximated as ${b.toFixed(12)} after ${iteration} iteration(s); residual ${Math.abs(fb).toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { func: name, root: b, residual: Math.abs(fb), iteration, converged, bracket: [Math.min(a, c), Math.max(a, c)] },
    };
}

/** The Brent root-finding module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Bisection is reliable but slow; secant and interpolation are fast but can jump outside the bracket. Brent's method tries the fast step first and accepts it only if it stays inside a safe subinterval and makes good progress. Otherwise it falls back to bisection, keeping the root bracketed at every step.",
        invariants: [
            "The true root remains bracketed between the best point and the contrapoint.",
            "Each accepted interpolation step is confined to a shrinking safe interval.",
            "At most one new function evaluation is used per iteration.",
        ],
        correctness:
            "The bracket endpoints always straddle a root by the intermediate value theorem. A step is accepted only when it lies within the middle portion of the current bracket, so it never discards the sign change. Interpolation gives superlinear convergence near a simple root, and bisection fallback guarantees the interval halves often enough to converge even when interpolation is repeatedly rejected.",
        complexityRationale:
            "Each iteration performs one function evaluation and a constant amount of arithmetic, so the cost is O(iterations). Only a handful of bracket points and function values are stored, giving O(1) space.",
        uses: [
            "Default root solver in scientific computing libraries",
            "Solving nonlinear equations in engineering simulation",
            "Inverting cumulative distribution functions",
        ],
        references: [
            "Brent, Algorithms for Minimization Without Derivatives, Chapter 4, 1973",
            "Press et al., Numerical Recipes, Chapter 9, 2007",
        ],
        workedExample:
            "For f(x) = x squared minus 2 on the bracket [0, 2], bisection alone would need many halvings. Brent's method quickly switches to inverse quadratic interpolation and reaches 1.414213562373 to about twelve decimals in under ten evaluations.",
    },
    id: "brent-method",
    name: "Brent's Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { func: "x2-2", a: 0, b: 2, tol: 1e-12, iterations: 40 },
    visualType: "array",
    run,
    pseudocode: [
        "evaluate the function at both bracket endpoints",
        "verify the endpoints have opposite signs",
        "keep the best point and a contrapoint with opposite sign",
        "try inverse quadratic interpolation or a secant step",
        "accept the step only if it stays inside a safe subinterval",
        "otherwise take a bisection step",
        "update the best point with one new function evaluation",
        "stop when the bracket or residual is below tolerance",
        "done: report the final root approximation",
    ],
};

export default module;
