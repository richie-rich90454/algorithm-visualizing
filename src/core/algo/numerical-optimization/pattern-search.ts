/**
 * pattern-search.ts - Compass Pattern Search (Coordinate Pattern Search)
 *
 * A derivative-free minimizer. From the current point it probes one step in
 * each positive and negative coordinate direction. When a probe improves the
 * objective it becomes the new current point; when none improves, the step
 * length is halved. The search stops once the step falls below a tolerance.
 *
 * This demo minimizes a separable quadratic with a known minimizer so the
 * result can be checked against brute force. It does not implement pattern
 * matrices, contraction factors other than one half, or constraints.
 *
 * Time:  O(iterations * dimension)
 * Space: O(dimension) for the current point and probe
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    target?: number[];
    start?: number[];
    initialStep?: number;
    tolerance?: number;
    maxIterations?: number;
}

function makeBars(x: number[], value: number, step: number): VisualEntity[] {
    const labels = ["x0", "x1", "objective", "step"];
    const values = [x[0] ?? 0, x[1] ?? 0, value, step];
    return values.map((v, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: `${labels[i]}=${v.toFixed(6)}`,
        value: v,
        state: i === 2 ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, role: labels[i] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const target = Array.isArray(task.target) && task.target.length >= 2 ? task.target.slice(0, 2).map(Number) : [2, -1];
    let x = Array.isArray(task.start) && task.start.length >= 2 ? task.start.slice(0, 2).map(Number) : [0, 0];
    let step = Number.isFinite(task.initialStep) && Number(task.initialStep) > 0 ? Number(task.initialStep) : 1;
    const tolerance = Number.isFinite(task.tolerance) && Number(task.tolerance) > 0 ? Number(task.tolerance) : 1e-6;
    const maxIterations = Math.min(500, Math.max(1, Math.floor(Number(task.maxIterations ?? 200)) || 200));
    const f = (p: number[]): number => ((p[0] ?? 0) - (target[0] ?? 0)) ** 2 + ((p[1] ?? 0) - (target[1] ?? 0)) ** 2;

    let stepCount = 0;
    yield {
        stepNumber: 0,
        entities: makeBars(x, f(x), step),
        edges: [],
        description: `Minimize a quadratic with minimizer (${target[0]}, ${target[1]}) by compass pattern search from (${x[0]}, ${x[1]}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x: [...x], objective: f(x), step, tolerance, iterations: 0, improvements: 0 },
    };

    let improvements = 0;
    for (let iteration = 1; iteration <= maxIterations && step >= tolerance; iteration += 1) {
        stepCount = iteration;
        let best = f(x);
        let bestPoint: number[] | null = null;
        for (let d = 0; d < x.length; d += 1) {
            for (const sign of [1, -1]) {
                const probe = x.slice();
                probe[d] = (probe[d] ?? 0) + sign * step;
                const value = f(probe);
                if (value < best) {
                    best = value;
                    bestPoint = probe;
                }
            }
        }
        let moved = false;
        if (bestPoint !== null) {
            x = bestPoint;
            improvements += 1;
            moved = true;
        } else {
            step /= 2;
        }
        yield {
            stepNumber: iteration,
            entities: makeBars(x, best, step),
            edges: [],
            description: `Iteration ${iteration}: ${moved ? "moved to (" + x[0]?.toFixed(5) + ", " + x[1]?.toFixed(5) + ")" : "no improvement, halved step to " + step.toExponential(2)}; objective ${best.toExponential(4)}.`,
            codeLineNumber: moved ? 3 : 5,
            layout: "array",
            meta: { x: [...x], objective: best, step, tolerance, iterations: iteration, improvements, moved },
        };
    }

    yield {
        stepNumber: stepCount + 1,
        entities: makeBars(x, f(x), step),
        edges: [],
        description: `Pattern search stopped after ${stepCount} iteration(s) at (${x[0]?.toFixed(6)}, ${x[1]?.toFixed(6)}), objective ${f(x).toExponential(4)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { x: [...x], objective: f(x), step, tolerance, iterations: stepCount, improvements, converged: step < tolerance },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of asking which direction would reduce the objective, probe a small fixed set of directions and accept the best point that actually improves the value. If a full sweep of probes finds nothing better, the step is too large for the current neighborhood, so shrink it and try again. This turns a smooth optimization problem into a sequence of simple comparisons.",
        invariants: [
            "The accepted point always has a strictly lower objective than the previous point.",
            "The step length never increases; it is either kept or halved.",
            "A probe differs from the current point in exactly one coordinate.",
        ],
        correctness:
            "For a strictly convex quadratic the objective decreases whenever a probe enters a point closer to the minimizer, so the sequence of accepted points is monotone in objective value. Each failed sweep halves the step; after finitely many halvings the mesh is fine enough that no improving axis step exists outside the tolerance, at which point the current point is within a mesh width of the stationary point. The quadratic here has a unique minimizer equal to the supplied target.",
        complexityRationale:
            "Every iteration probes at most two directions per coordinate, so with dimension d the work per iteration is O(d) and the total is O(iterations times d). Only the current point, the best probe, and a few scalars are stored, giving O(d) space.",
        uses: [
            "Tuning simulation parameters when derivatives are unavailable",
            "Optimizing black-box objectives from engineering codes",
            "A teaching model for direct-search methods",
        ],
        references: [
            "Hooke and Jeeves, Direct Search Solution of Numerical and Statistical Problems, 1961",
            "Torch, A Survey of Direct Search Methods in Optimization, 2013",
        ],
        workedExample:
            "From (0,0) targeting (2,-1) with step 1, the probes (1,0) and then (1,-1) improve the quadratic, and the next sweep reaches (2,-1) exactly. No further probe improves, so the step halves repeatedly until it drops below the tolerance and the search stops at the minimizer.",
    },
    id: "pattern-search",
    name: "Compass Pattern Search",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * dimension)", space: "O(dimension)" },
    defaultInput: { target: [2, -1], start: [0, 0], initialStep: 1, tolerance: 1e-6, maxIterations: 200 },
    visualType: "array",
    run,
    pseudocode: [
        "read the target, start point, step, and tolerance",
        "set the current point to the start point",
        "evaluate the objective at the current point",
        "probe each coordinate in the positive and negative direction",
        "if a probe improves the objective move to the best probe",
        "otherwise halve the step length",
        "stop when the step drops below the tolerance",
        "done: report the best point and objective value",
    ],
};

export default module;
