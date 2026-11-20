/**
 * ridder-method.ts - Ridders' Method for Bracketed Root Finding
 *
 * Ridders' method refines a sign-changing bracket with an exponential
 * interpolation formula. At each step it evaluates the midpoint, forms a
 * normalized correction from the three function values, and keeps the
 * sub-bracket that still straddles the root. It is distinct from bisection,
 * false position, and Brent's method.
 *
 * This demo uses a fixed set of named functions so replay is deterministic;
 * no user-supplied function is ever evaluated.
 *
 * Time:  O(iterations) function evaluations
 * Space: O(1)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type FuncName = "x2-2" | "x3-x-2" | "cos-x" | "exp-2";

const FUNCTIONS: Record<FuncName, (x: number) => number> = {
    "x2-2": (x) => x * x - 2,
    "x3-x-2": (x) => x * x * x - x - 2,
    "cos-x": (x) => Math.cos(x) - x,
    "exp-2": (x) => Math.exp(x) - 2,
};

function makeBars(a: number, b: number, c: number, x: number): VisualEntity[] {
    const values = [a, b, c, x];
    const labels = ["a", "b", "midpoint", "estimate"];
    return values.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: `${labels[i]}=${value.toFixed(6)}`,
        value,
        state: i === 3 ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, role: labels[i] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { func?: string; a?: number; b?: number; tol?: number; iterations?: number } | null) ?? {};
    const name: FuncName = (task.func as FuncName) in FUNCTIONS ? (task.func as FuncName) : "x2-2";
    const f = FUNCTIONS[name] as (x: number) => number;
    let a = typeof task.a === "number" ? task.a : 0;
    let b = typeof task.b === "number" ? task.b : 2;
    const tol = Math.max(1e-15, Number(task.tol ?? 1e-12));
    const maxIter = Math.min(200, Math.max(1, Math.floor(Number(task.iterations ?? 60)) || 60));

    let fa = f(a);
    let fb = f(b);
    const signOk = fa * fb < 0;
    let converged = false;
    let iteration = 0;
    let best = b;

    yield {
        stepNumber: 0,
        entities: makeBars(a, b, (a + b) / 2, (a + b) / 2),
        edges: [],
        description: `Bracket [${a}, ${b}] for ${name} ${signOk ? "straddles a root" : "does not straddle a root"}; applying Ridders interpolation.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { func: name, iteration: 0, bracket: [a, b], root: best, residual: Math.abs(fb), converged: false, valid: signOk },
    };

    if (!signOk) {
        yield {
            stepNumber: 1,
            entities: makeBars(a, b, (a + b) / 2, (a + b) / 2),
            edges: [],
            description: "The endpoint values share a sign, so no root is bracketed and Ridders' method cannot start.",
            codeLineNumber: 1,
            layout: "array",
            meta: { func: name, iteration: 0, bracket: [a, b], root: best, residual: Math.abs(fb), converged: false, valid: false, note: "invalid bracket" },
        };
        return;
    }

    for (iteration = 0; iteration < maxIter; iteration += 1) {
        const c = (a + b) / 2;
        const fc = f(c);
        const discriminant = fc * fc - fa * fb;
        const rootTerm = Math.sqrt(Math.max(0, discriminant));
        const direction = fa - fb >= 0 ? 1 : -1;
        const x = rootTerm > 0 ? c + (c - a) * ((direction * fc) / rootTerm) : c;
        const fx = f(x);
        best = x;

        if (Math.abs(fx) < tol || Math.abs(b - a) < tol) converged = true;

        yield {
            stepNumber: iteration + 1,
            entities: makeBars(a, b, c, x),
            edges: [],
            description: `Iteration ${iteration + 1}: estimate ${x.toFixed(12)} with residual ${Math.abs(fx).toExponential(2)} and bracket width ${Math.abs(b - a).toExponential(2)}.`,
            codeLineNumber: converged ? 6 : 4,
            layout: "array",
            meta: {
                func: name,
                iteration: iteration + 1,
                bracket: [Math.min(a, b), Math.max(a, b)],
                root: best,
                residual: Math.abs(fx),
                converged,
                valid: true,
            },
        };

        if (converged) break;
        if (fa * fx <= 0) {
            b = x;
            fb = fx;
        } else {
            a = x;
            fa = fx;
        }
    }

    yield {
        stepNumber: iteration + 2,
        entities: makeBars(a, b, (a + b) / 2, best),
        edges: [],
        description: `Ridders' method reports root ${best.toFixed(12)} after ${iteration + 1} iteration(s) with residual ${Math.abs(f(best)).toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { func: name, iteration: iteration + 1, bracket: [a, b], root: best, residual: Math.abs(f(best)), converged, valid: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Like false position, Ridders' method keeps a bracket whose endpoints have opposite signs. The new point is derived from an exponential curve fitted through the two endpoints and the midpoint, which makes it converge faster than plain false position without leaving the bracket. It keeps whichever half interval still contains the sign change.",
        invariants: [
            "The stored endpoints a and b always have function values of opposite sign.",
            "The new estimate lies between a and b whenever the interpolation term is valid.",
            "After each update the bracket strictly shrinks, so the iteration terminates.",
        ],
        correctness:
            "The interpolation formula comes from fitting an exponential to the three sampled points and solving for its zero, which yields c plus the normalized correction. Because the endpoints keep opposite signs and the retained sub-interval contains the sign change, the intermediate value theorem guarantees a root remains bracketed. The exponential fit is exact to second order near a simple root, giving faster convergence than linear false position while bisection-like bracket shrinkage prevents divergence.",
        complexityRationale:
            "Each iteration evaluates the function twice, at the midpoint and at the new estimate, and performs a constant number of arithmetic operations, so the cost is O(iterations). Only the bracket endpoints and a few scalar values are stored, giving O(1) space.",
        uses: [
            "Root solving when a sign-changing interval is known in advance",
            "Inverting monotonic response curves in engineering tools",
            "A robust teaching alternative to false position and bisection",
        ],
        references: [
            "Ridders, A New Algorithm for Computing a Single Root, IEEE Transactions on Circuits and Systems, 1979",
            "Press et al., Numerical Recipes, Chapter 9, 2007",
        ],
        workedExample:
            "For x squared minus 2 on [0, 2], the first midpoint is 1 with value minus 1. The interpolation gives an estimate near 1.447, whose square is close to 2. The bracket is narrowed and a few more steps settle on 1.414213562.",
    },
    id: "ridder-method",
    name: "Ridders' Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { func: "x2-2", a: 0, b: 2, tol: 1e-12, iterations: 60 },
    visualType: "array",
    run,
    pseudocode: [
        "read the bracket endpoints and verify opposite signs",
        "evaluate the function at both endpoints",
        "set the midpoint and evaluate the function there",
        "form the square root of fc squared minus fa times fb",
        "compute the estimate from the midpoint and normalized correction",
        "evaluate the function at the new estimate",
        "keep the half interval that still brackets the root",
        "stop when the residual or bracket width is below tolerance",
        "done: report the final root estimate",
    ],
};

export default module;
