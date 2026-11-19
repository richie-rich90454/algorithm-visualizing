/**
 * wolfe-line-search.ts - Strong Wolfe Line Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A line search picks a step length along a descent direction. The strong Wolfe
 * conditions ask for two things at once: sufficient decrease (the Armijo
 * condition, controlled by c1) and a slope close enough to zero (the curvature
 * condition, controlled by c2). The algorithm first expands a bracket until
 * those conditions can be met, then zooms into the bracket by bisection until
 * it finds a step that satisfies both. This is the line search used inside
 * quasi-Newton and conjugate-gradient methods.
 *
 * The demo minimizes a quadratic phi(alpha) = a alpha^2 + b alpha + c along a
 * fixed direction, so phi and its derivative are exact and the replay is
 * deterministic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations) evaluations of phi and its derivative
 *   Space: O(1) for the bracket endpoints and counters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Three bars show the trial step, phi at the trial, and its slope.
 *   - The accepted bar is green; rejected bracket trials are yellow.
 *   - Captions name the phase: bracket expansion, zoom, or acceptance.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    a?: number;
    b?: number;
    c?: number;
    alpha0?: number;
    c1?: number;
    c2?: number;
    alphaMax?: number;
    maxIter?: number;
}

function phi(alpha: number, a: number, b: number, c: number): number {
    return a * alpha * alpha + b * alpha + c;
}

function dphi(alpha: number, a: number, b: number): number {
    return 2 * a * alpha + b;
}

function makeBars(alpha: number, value: number, slope: number, accepted: boolean, zooming: boolean): VisualEntity[] {
    const values = [alpha, value, slope];
    return values.map((v, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: v.toFixed(5),
        value: v,
        state: (index === 0 ? (accepted ? "sorted" : zooming ? "comparing" : "active") : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index === 0 ? "alpha" : index === 1 ? "phi" : "slope" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const a = typeof task.a === "number" && task.a > 0 ? task.a : 1;
    const b = typeof task.b === "number" ? task.b : -6;
    const c = typeof task.c === "number" ? task.c : 9;
    let alpha0 = typeof task.alpha0 === "number" && task.alpha0 > 0 ? task.alpha0 : 8;
    const c1 = typeof task.c1 === "number" && task.c1 > 0 && task.c1 < 1 ? task.c1 : 1e-4;
    const c2 = typeof task.c2 === "number" && task.c2 > c1 && task.c2 < 1 ? task.c2 : 0.9;
    const alphaMax = typeof task.alphaMax === "number" && task.alphaMax > 0 ? task.alphaMax : 100;
    const maxIter = typeof task.maxIter === "number" ? Math.max(1, Math.floor(task.maxIter)) : 50;

    const p0 = phi(0, a, b, c);
    const dp0 = dphi(0, a, b);
    const armijoBound = (alpha: number): number => p0 + c1 * alpha * dp0;
    let step = 0;
    let previousValue = p0;

    yield {
        stepNumber: step,
        entities: makeBars(0, p0, dp0, false, false),
        edges: [],
        description: `Search from alpha 0 where phi is ${p0.toFixed(3)} and the slope is ${dp0.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { alpha: 0, phi: p0, slope: dp0, c1, c2, phase: "start", accepted: false },
    };
    step += 1;

    let result: number | null = null;

    /** Bisect a bracket that straddles a point satisfying the strong Wolfe conditions. */
    function* zoom(lo: number, hi: number): Generator<VisualFrame, number | null, unknown> {
        const phiLo = phi(lo, a, b, c);
        for (let j = 0; j < maxIter; j += 1) {
            const mid = (lo + hi) / 2;
            const pMid = phi(mid, a, b, c);
            const dMid = dphi(mid, a, b);
            let nextLo = lo;
            let nextHi = hi;
            if (pMid > armijoBound(mid) || pMid >= phiLo) {
                nextHi = mid;
            } else {
                if (Math.abs(dMid) <= -c2 * dp0) {
                    yield {
                        stepNumber: step,
                        entities: makeBars(mid, pMid, dMid, true, true),
                        edges: [],
                        description: `Zoom iteration ${j + 1}: alpha ${mid.toFixed(5)} satisfies both strong Wolfe conditions.`,
                        codeLineNumber: 8,
                        layout: "array",
                        meta: { alpha: mid, phi: pMid, slope: dMid, c1, c2, alphaLo: lo, alphaHi: hi, phase: "zoom", accepted: true },
                    };
                    step += 1;
                    return mid;
                }
                if (dMid * (hi - lo) >= 0) {
                    nextHi = lo;
                }
                nextLo = mid;
            }
            yield {
                stepNumber: step,
                entities: makeBars(mid, pMid, dMid, false, true),
                edges: [],
                description: `Zoom iteration ${j + 1}: alpha ${mid.toFixed(5)}, phi ${pMid.toFixed(4)}, narrowing the bracket.`,
                codeLineNumber: 7,
                layout: "array",
                meta: { alpha: mid, phi: pMid, slope: dMid, c1, c2, alphaLo: nextLo, alphaHi: nextHi, phase: "zoom", accepted: false },
            };
            step += 1;
            lo = nextLo;
            hi = nextHi;
        }
        return null;
    }

    let lo = 0;
    let hi = alpha0;
    for (let i = 0; i < maxIter && result === null; i += 1) {
        const pI = phi(alpha0, a, b, c);
        const dI = dphi(alpha0, a, b);
        let codeLine = 6;
        if (pI > armijoBound(alpha0) || (i > 0 && pI >= previousValue)) {
            codeLine = 3;
            result = yield* zoom(lo, alpha0);
        } else if (Math.abs(dI) <= -c2 * dp0) {
            codeLine = 4;
            result = alpha0;
            yield {
                stepNumber: step,
                entities: makeBars(alpha0, pI, dI, true, false),
                edges: [],
                description: `Expansion ${i + 1}: alpha ${alpha0.toFixed(5)} satisfies both strong Wolfe conditions.`,
                codeLineNumber: codeLine,
                layout: "array",
                meta: { alpha: alpha0, phi: pI, slope: dI, c1, c2, phase: "expand", accepted: true },
            };
            step += 1;
        } else if (dI >= 0) {
            codeLine = 5;
            result = yield* zoom(alpha0, lo);
        }
        if (result !== null) {
            break;
        }
        yield {
            stepNumber: step,
            entities: makeBars(alpha0, pI, dI, false, false),
            edges: [],
            description: `Expansion ${i + 1}: alpha ${alpha0.toFixed(5)}, phi ${pI.toFixed(4)}, widening the bracket.`,
            codeLineNumber: codeLine,
            layout: "array",
            meta: { alpha: alpha0, phi: pI, slope: dI, c1, c2, alphaLo: lo, alphaHi: alpha0, phase: "expand", accepted: false },
        };
        step += 1;
        previousValue = pI;
        lo = alpha0;
        alpha0 = Math.min(2 * alpha0, alphaMax);
        if (lo >= alphaMax) {
            break;
        }
    }

    const finalAlpha = result ?? lo;
    const finalValue = phi(finalAlpha, a, b, c);
    const finalSlope = dphi(finalAlpha, a, b);
    yield {
        stepNumber: step,
        entities: makeBars(finalAlpha, finalValue, finalSlope, result !== null, false),
        edges: [],
        description: result === null
            ? `Stopped at the step limit; best trial alpha ${finalAlpha.toFixed(5)} with phi ${finalValue.toFixed(4)}.`
            : `Accepted step alpha ${finalAlpha.toFixed(5)} with phi ${finalValue.toFixed(4)} and slope ${finalSlope.toFixed(4)}.`,
        codeLineNumber: 8,
        layout: "array",
        meta: {
            alpha: finalAlpha,
            phi: finalValue,
            slope: finalSlope,
            phi0: p0,
            slope0: dp0,
            c1,
            c2,
            accepted: result !== null,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A step that only guarantees a decrease can still be far too short or far too long. The strong Wolfe conditions add a second requirement: the slope at the chosen step must be small, so the step does not stop on a steep part of the curve. The search grows a bracket around a good step and then repeatedly bisects it until both requirements hold.",
        invariants: [
            "Every accepted step satisfies the Armijo sufficient-decrease inequality.",
            "Every accepted step satisfies the strong Wolfe curvature bound on the slope.",
            "The zoom bracket always straddles an interval in which a valid step exists.",
            "The step length stays inside the permitted range from zero to the maximum.",
        ],
        correctness:
            "When the initial step fails, the expansion phase either finds a point with a nonnegative slope or one that violates Armijo; in both cases a bracket containing a step that satisfies the strong Wolfe conditions exists. The zoom phase halves that bracket each round and keeps the half that preserves the condition, so bisection converges to an acceptable step. For a convex quadratic this takes only a few rounds.",
        complexityRationale:
            "Each expansion or zoom round evaluates the function and its derivative once, giving O(iterations) work. Only the two bracket endpoints and a few scalars are stored, so the space is O(1).",
        uses: [
            "Choosing step lengths inside BFGS and limited-memory quasi-Newton solvers",
            "Line searches for nonlinear conjugate-gradient optimization",
            "Ensuring global convergence of Newton methods on nonconvex objectives",
        ],
        references: [
            "Nocedal and Wright, Numerical Optimization, chapter 3",
            "Wolfe, On convergence properties of the conjugate gradient method, 1969",
        ],
        workedExample:
            "With phi(alpha) = (alpha-3)^2, a step of 8 gives phi 25, which violates the Armijo bound near 9, so the bracket becomes [0, 8]. Its midpoint 4 has phi 1 and slope 2, well within the curvature bound of 5.4, so bisection accepts alpha 4 after one zoom round.",
    },
    id: "wolfe-line-search",
    name: "Wolfe Line Search",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { a: 1, b: -6, c: 9, alpha0: 8, c1: 0.0001, c2: 0.9, alphaMax: 100, maxIter: 50 },
    visualType: "array",
    run,
    pseudocode: [
        "define phi and its derivative along the search direction",
        "set the bracket endpoints to zero and the initial step",
        "evaluate phi and the Armijo sufficient-decrease bound",
        "if Armijo fails or phi rises, zoom into the bracket",
        "if the curvature condition holds, accept this step",
        "if the slope is nonnegative, zoom toward the current point",
        "otherwise double the step and widen the bracket",
        "in zoom bisect until both strong Wolfe conditions hold",
        "done: return the accepted step length",
    ],
};

export default module;
