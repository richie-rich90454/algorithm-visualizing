/**
 * cutting-plane-method.ts - Kelley's Cutting-Plane Method
 *
 * Minimizes a convex function over an interval by maintaining a piecewise-
 * linear lower bound built from supporting hyperplanes. Each iteration finds
 * where the lower bound is smallest, evaluates the true function and a
 * subgradient there, and adds the resulting cutting plane. The best point seen
 * converges to the true minimizer.
 *
 * Time: O(iterations * grid * (lines + planes)); Space: O(lines + planes).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Line { m: number; b: number }

function evalMax(lines: Line[], x: number): number {
    let best = -Infinity;
    for (const line of lines) {
        best = Math.max(best, line.m * x + line.b);
    }
    return best;
}

/** Subgradient of max of affine functions: slope of an active line. */
function subgradient(lines: Line[], x: number): number {
    let best = -Infinity;
    let slope = 0;
    for (const line of lines) {
        const value = line.m * x + line.b;
        if (value > best) {
            best = value;
            slope = line.m;
        }
    }
    return slope;
}

function makeEntities(model: Line[], lo: number, hi: number, activeIndex: number): VisualEntity[] {
    const count = 11;
    return Array.from({ length: count }, (_, index) => {
        const x = lo + ((hi - lo) * index) / (count - 1);
        const value = model.length === 0 ? 0 : evalMax(model, x);
        return {
            id: `sample-${index}`,
            type: "bar" as const,
            label: `${Number(value.toFixed(3))}`,
            value,
            state: index === activeIndex ? "active" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { x },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        lines?: Array<{ m: number; b: number }>;
        lo?: number;
        hi?: number;
        iterations?: number;
        grid?: number;
    } | null) ?? {};
    const lines: Line[] = (task.lines ?? [
        { m: -2, b: 0 },
        { m: 1, b: 0 },
        { m: 0.2, b: 3 },
    ]).map((line) => ({ m: line.m, b: line.b }));
    const lo = task.lo ?? -5;
    const hi = task.hi ?? 5;
    const iterations = Math.max(1, Math.floor(task.iterations ?? 30));
    const grid = Math.max(50, Math.floor(task.grid ?? 401));

    const planes: Line[] = [];
    let bestX = lo;
    let upperBound = evalMax(lines, lo);
    let lowerBound = -Infinity;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(planes, lo, hi, -1),
        edges: [],
        description: `Minimizing a convex piecewise-linear function on [${lo}, ${hi}] by cutting planes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, x: bestX, value: upperBound, lowerBound: null, upperBound, planes: 0 },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        let probeX = lo;
        let probeValue = Infinity;
        for (let j = 0; j <= grid; j += 1) {
            const x = lo + ((hi - lo) * j) / grid;
            const value = planes.length === 0 ? lo : evalMax(planes, x);
            if (value < probeValue) {
                probeValue = value;
                probeX = x;
            }
        }
        const trueValue = evalMax(lines, probeX);
        const slope = subgradient(lines, probeX);
        planes.push({ m: slope, b: trueValue - slope * probeX });
        if (trueValue < upperBound) {
            upperBound = trueValue;
            bestX = probeX;
        }
        lowerBound = probeValue;
        const activeIndex = Math.round(((probeX - lo) / (hi - lo)) * 10);

        yield {
            stepNumber: step,
            entities: makeEntities(planes, lo, hi, activeIndex),
            edges: [],
            description: `Iteration ${iteration}: probe x = ${probeX.toFixed(4)}, f = ${trueValue.toFixed(4)}, added cut with slope ${slope}.`,
            codeLineNumber: iteration === iterations ? 7 : 5,
            layout: "array",
            meta: {
                iteration,
                x: bestX,
                value: upperBound,
                lowerBound,
                upperBound,
                planes: planes.length,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(planes, lo, hi, -1),
        edges: [],
        description: `Finished with best x = ${bestX.toFixed(4)} and value ${upperBound.toFixed(4)} after ${planes.length} cuts.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { iteration: iterations, x: bestX, value: upperBound, lowerBound, upperBound, planes: planes.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A convex function always lies above any of its tangent lines. Collect several such lines and their pointwise maximum forms a piecewise-linear underestimate that hugs the function from below. Minimizing that cheap underestimate suggests where to probe the real function next, and every probe tightens the model.",
        invariants: [
            "Every cutting plane is a supporting line, so the lower-bound model never exceeds the true function.",
            "The best value is the smallest true function value observed at any probe.",
            "Adding a cut can only raise the lower bound and never raises the upper bound.",
        ],
        correctness:
            "Because the lower model is always below the objective and the best probe is always at or above the optimum, the gap between bounds brackets the true minimum. For a piecewise-linear convex objective, finitely many cuts reproduce the active pieces exactly, after which the probe is an exact minimizer and the bounds coincide.",
        complexityRationale:
            "Each iteration scans a fixed grid to minimize the lower model, costing O(grid times number of planes), plus one function evaluation. With a constant number of iterations the time is O(iterations times grid times planes) and the stored planes are linear in the iteration count.",
        uses: [
            "Convex optimization when only function and subgradient oracles are available",
            "Benders decomposition and large-scale linear programming",
            "Cutting-plane based solvers for nonsmooth objective functions",
        ],
        references: [
            "Kelley, Cutting-Plane Methods for Optimization, 1960",
            "Boyd and Vandenberghe, Convex Optimization, chapter on cutting-plane methods",
        ],
        workedExample:
            "Minimizing the maximum of minus two x, x, and 0.2x plus 3 on minus five to five, successive tangent cuts push the lower bound up until the probe settles near x = -1.36, where the true value is about 2.73.",
    },
    id: "cutting-plane-method",
    name: "Cutting-Plane Method (Kelley)",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * grid * planes)", space: "O(planes)" },
    defaultInput: {
        lines: [{ m: -2, b: 0 }, { m: 1, b: 0 }, { m: 0.2, b: 3 }],
        lo: -5,
        hi: 5,
        iterations: 30,
        grid: 401,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the convex function lines and the search interval",
        "start with no cutting planes and an infinite lower bound",
        "for each iteration minimize the lower model on a grid",
        "evaluate the true function and one subgradient at the probe",
        "append the affine cut touching the function at the probe",
        "update the best upper bound and point seen so far",
        "set the lower bound to the minimized model value",
        "report the best point and final bounds",
    ],
};

export default module;
