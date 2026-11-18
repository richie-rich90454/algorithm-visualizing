/**
 * interior-point-barrier-method.ts - Primal Log-Barrier Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The log-barrier method solves a constrained convex problem by replacing the
 * inequality constraint with a smooth penalty that blows up at the boundary.
 * For each penalty parameter t a Newton step finds the minimizer of the
 * subproblem; increasing t pushes that minimizer toward the true constrained
 * optimum. The gap between the subproblem value and the true optimum shrinks
 * like one over t.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * j) for k barrier updates and j Newton steps per update
 *   Space: O(1) for this one-dimensional teaching problem
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two bars show the current iterate and the constraint boundary.
 *   - The iterate bar turns yellow during Newton steps and green at the end.
 *   - Frame metadata reports the barrier parameter, iterate, and one-over-t gap.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const TARGET = 3;
const BOUND = 2;

/** Build bars for the current iterate and the boundary. */
function makeBars(x: number, state: EntityState): VisualEntity[] {
    return [
        {
            id: "bar-iterate",
            type: "bar" as const,
            label: x.toFixed(6),
            value: x,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: 0, role: "iterate" },
        },
        {
            id: "bar-bound",
            type: "bar" as const,
            label: BOUND.toFixed(1),
            value: BOUND,
            state: "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: 1, role: "boundary" },
        },
    ];
}

/** First and second derivatives of the barrier subproblem at x. */
function derivatives(x: number, t: number): { first: number; second: number } {
    const distance = BOUND - x;
    return {
        first: t * (x - TARGET) + 1 / distance,
        second: t + 1 / (distance * distance),
    };
}

/** Solve one barrier subproblem by damped Newton iteration. */
function solveSubproblem(x: number, t: number): { x: number; steps: number[] } {
    let current = x;
    const steps: number[] = [current];
    for (let step = 0; step < 60; step += 1) {
        const { first, second } = derivatives(current, t);
        let next = current - first / second;
        while (next >= BOUND) {
            next = (current + next) / 2;
        }
        steps.push(next);
        if (Math.abs(next - current) < 1e-13) {
            current = next;
            break;
        }
        current = next;
    }
    return { x: current, steps };
}

/** The log-barrier method generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { t0?: number; mu?: number; outer?: number } | null) ?? {};
    const t0 = typeof task.t0 === "number" && task.t0 > 0 ? task.t0 : 1;
    const mu = typeof task.mu === "number" && task.mu > 1 ? task.mu : 10;
    const outer = typeof task.outer === "number" ? Math.max(1, Math.floor(task.outer)) : 6;
    let x = 0;
    let t = t0;
    let frame = 0;

    yield {
        stepNumber: frame,
        entities: makeBars(x, "unvisited"),
        edges: [],
        description: `Minimize (x - 3)^2 / 2 subject to x <= 2 using a log barrier; start at x = 0.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x, t, gap: 1 / t, outer: 0, iterate: x },
    };
    frame += 1;

    for (let round = 1; round <= outer; round += 1) {
        const solution = solveSubproblem(x, t);
        for (const step of solution.steps) {
            x = step;
            yield {
                stepNumber: frame,
                entities: makeBars(x, "comparing"),
                edges: [],
                description: `Newton step at t = ${t.toFixed(2)} moves the iterate to ${x.toFixed(6)}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { x, t, gap: 1 / t, outer: round, iterate: x },
            };
            frame += 1;
        }
        yield {
            stepNumber: frame,
            entities: makeBars(x, "sorted"),
            edges: [],
            description: `Barrier round ${round}: x = ${x.toFixed(6)}, gap 1/t = ${(1 / t).toExponential(2)}.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { x, t, gap: 1 / t, outer: round, iterate: x },
        };
        frame += 1;
        t *= mu;
    }

    yield {
        stepNumber: frame,
        entities: makeBars(x, "sorted"),
        edges: [],
        description: `Barrier method converged to x = ${x.toFixed(6)}, just inside the boundary 2.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { x, t, gap: 1 / t, outer, iterate: x },
    };
}

/** The log-barrier method module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Keep strictly inside the feasible region and add a penalty that grows to infinity as you approach its boundary. The penalty makes the constrained problem smooth, so ordinary Newton steps work. Turning up the penalty parameter makes the penalty negligible except right at the boundary, driving the solution to the true constrained optimum.",
        invariants: [
            "Every iterate stays strictly inside the feasible region x < 2.",
            "Each subproblem has a unique minimizer because its objective is strictly convex.",
            "The optimality gap is at most one over the barrier parameter.",
        ],
        correctness:
            "The barrier objective t f(x) minus log of the slack is strictly convex, so Newton's method converges to its unique minimizer. That minimizer satisfies t f'(x) plus one over the slack equal to zero, which means f'(x) equals minus one over t times the slack. As t grows the right side tends to zero, the complementarity condition of the constrained optimum. The objective gap between the subproblem solution and the true optimum is bounded by one over t, so increasing t without bound converges to the constrained optimum.",
        complexityRationale:
            "Each outer round runs a constant number of Newton steps for this one-dimensional problem, and there are k rounds, so O(k) time and O(1) space. In n dimensions each Newton step costs O(n^3) and the iteration count grows mildly with n.",
        uses: [
            "Convex optimization solvers with inequality constraints",
            "Support vector machine training via quadratic programs",
            "Model predictive control and portfolio optimization",
        ],
        references: [
            "Karmarkar, A New Polynomial-Time Algorithm for Linear Programming, 1984",
            "Boyd and Vandenberghe, Convex Optimization, Chapter 11",
        ],
        workedExample:
            "Minimize (x - 3)^2 / 2 for x <= 2. The true optimum is the boundary point x = 2. With t = 1 the barrier subproblem is minimized near x = 1.7; raising t to 1000 pushes the solution to about 1.999, approaching the boundary from inside.",
    },
    id: "interior-point-barrier-method",
    name: "Interior-Point Barrier Method",
    category: "numerical-optimization",
    complexity: { time: "O(k * j)", space: "O(1)" },
    defaultInput: { t0: 1, mu: 10, outer: 6 },
    visualType: "array",
    run,
    pseudocode: [
        "start at a strictly feasible point and set t",
        "repeat for a number of outer rounds",
        "run Newton steps on the barrier subproblem",
        "keep the iterate strictly inside the boundary",
        "accept the subproblem minimizer",
        "increase the barrier parameter by a factor",
        "stop when one over t is sufficiently small",
        "done: report the constrained optimum",
    ],
};

export default module;
