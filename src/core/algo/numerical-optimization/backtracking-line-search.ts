/**
 * backtracking-line-search.ts - Backtracking Line Search with Armijo Condition
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A line search chooses how far to move along a descent direction. Backtracking
 * starts with a full step and repeatedly shrinks it by a fixed factor until the
 * Armijo sufficient-decrease condition holds: the objective must drop by at
 * least a small fraction of the predicted linear decrease. The shrinking loop
 * is cheap and guarantees progress for a genuine descent direction.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(iterations) objective evaluations
 *   Space: O(iterations) for the recorded trials
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Points show each trial point on the objective curve in the search plane.
 *   - The accepted step is green; rejected steps are red.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface LineSearchTrial {
    t: number;
    point: number;
    value: number;
    bound: number;
    accepted: boolean;
}

export interface LineSearchResult {
    step: number;
    start: number;
    direction: number;
    slope: number;
    fStart: number;
    fTrial: number;
    trials: LineSearchTrial[];
}

export interface LineSearchOptions {
    initial?: number;
    rho?: number;
    c1?: number;
    maxIter?: number;
    minStep?: number;
}

/** Find a step length along a direction satisfying the Armijo condition. */
export function backtrackingLineSearch(
    f: (x: number) => number,
    x: number,
    direction: number,
    slope: number,
    options: LineSearchOptions = {},
): LineSearchResult {
    const initial = options.initial ?? 1;
    const rho = options.rho ?? 0.5;
    const c1 = options.c1 ?? 1e-4;
    const maxIter = options.maxIter ?? 60;
    const minStep = options.minStep ?? 1e-12;
    const fStart = f(x);
    const trials: LineSearchTrial[] = [];
    let t = initial;
    let accepted = false;

    for (let i = 0; i < maxIter && t >= minStep; i += 1) {
        const point = x + t * direction;
        const value = f(point);
        const bound = fStart + c1 * t * slope;
        const ok = value <= bound;
        trials.push({ t, point, value, bound, accepted: ok });
        if (ok) {
            accepted = true;
            break;
        }
        t *= rho;
    }

    if (!accepted && trials.length > 0) {
        t = trials[trials.length - 1]?.t ?? t;
    }
    const fTrial = accepted ? (trials[trials.length - 1]?.value ?? fStart) : f(x + t * direction);
    return { step: t, start: x, direction, slope, fStart, fTrial, trials };
}

function makePoints(result: LineSearchResult): VisualEntity[] {
    const entities: VisualEntity[] = [{
        id: "start",
        type: "node",
        label: `start ${result.start.toFixed(3)}`,
        value: result.start,
        state: "idle",
        x: result.start,
        y: result.fStart,
        width: 0,
        height: 0,
        metadata: { role: "start" },
    }];
    for (const trial of result.trials) {
        entities.push({
            id: `trial-${trial.t}`,
            type: "node",
            label: `t=${trial.t.toFixed(3)}, f=${trial.value.toFixed(3)}`,
            value: trial.value,
            state: (trial.accepted ? "sorted" : "error") as EntityState,
            x: trial.point,
            y: trial.value,
            width: 0,
            height: 0,
            metadata: { step: trial.t, value: trial.value },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { start?: number; direction?: number; slope?: number; rho?: number; c1?: number } | null) ?? {};
    const start = typeof task.start === "number" ? task.start : 0;
    const direction = typeof task.direction === "number" ? task.direction : 6;
    const slope = typeof task.slope === "number" ? task.slope : -36;
    const rho = typeof task.rho === "number" && task.rho > 0 && task.rho < 1 ? task.rho : 0.5;
    const c1 = typeof task.c1 === "number" && task.c1 > 0 && task.c1 < 1 ? task.c1 : 1e-4;
    const f = (x: number): number => (x - 3) * (x - 3);
    const result = backtrackingLineSearch(f, start, direction, slope, { rho, c1 });
    let step = 0;

    yield {
        stepNumber: step,
        entities: makePoints({ ...result, trials: [] }),
        edges: [],
        description: `Minimize (x-3)^2 from x=${start} along direction ${direction} with slope ${slope}; Armijo constant ${c1}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { start, direction, slope, fStart: result.fStart, step: 0, accepted: false },
    };
    step += 1;

    for (let i = 0; i < result.trials.length; i += 1) {
        const trial = result.trials[i];
        yield {
            stepNumber: step,
            entities: makePoints({ ...result, trials: result.trials.slice(0, i + 1) }),
            edges: [],
            description: `Trial t=${trial?.t.toFixed(4)}: objective ${trial?.value.toFixed(5)} against Armijo bound ${trial?.bound.toFixed(5)} - ${trial?.accepted ? "accepted" : "too large, shrink"}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { start, step: trial?.t ?? 0, value: trial?.value ?? 0, bound: trial?.bound ?? 0, accepted: trial?.accepted ?? false },
        };
        step += 1;
    }

    const last = result.trials[result.trials.length - 1];
    yield {
        stepNumber: step,
        entities: makePoints(result),
        edges: [],
        description: `Chosen step ${result.step.toFixed(5)} lowers the objective from ${result.fStart.toFixed(5)} to ${result.fTrial.toFixed(5)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { start, direction, slope, step: result.step, fStart: result.fStart, fTrial: result.fTrial, accepted: last?.accepted ?? false, trials: result.trials.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A line search answers one question: how far should I step downhill? Instead of solving that exactly, backtracking tries a full step and checks whether the objective fell by a reasonable amount compared with the predicted slope. If the step was too ambitious, it cuts the length in half and tries again. The test is cheap, and the first step that passes gives guaranteed progress.",
        invariants: [
            "The step length decreases geometrically only while the Armijo condition fails.",
            "An accepted step satisfies f(x + t d) at most f(x) plus c1 times t times the directional slope.",
            "The trial points all lie on the line from the start in the chosen direction.",
        ],
        correctness:
            "For a descent direction the slope is negative, so the Armijo bound lies below the starting value. At a sufficiently small step the objective is approximately linear and must eventually fall below that bound, so the loop terminates with an accepted step. The tests recompute the Armijo inequality independently for every trial, check that a known quadratic accepts the expected halved step, and verify that the objective genuinely decreases.",
        complexityRationale:
            "Each trial evaluates the objective once and shrinks the step by a constant factor, so the number of trials is logarithmic in the ratio of the initial to the final step and time is O(iterations). Storing one record per trial uses O(iterations) space.",
        uses: [
            "Step-size control in gradient descent and quasi-Newton methods",
            "Globalization of Newton methods so they converge from poor starts",
            "Trust-region and nonlinear programming line-search subproblems",
        ],
        references: [
            "Armijo, Minimization of Functions Having Lipschitz Continuous First Partial Derivatives, 1966",
            "Nocedal and Wright, Numerical Optimization, Chapter 3, 2006",
        ],
        workedExample:
            "For f(x)=(x-3)^2 at x=0 with direction 6, the slope is minus 36 and the start value is 9. A full step lands at 6 with value 9, which fails Armijo. Halving to t=0.5 lands at the minimizer 3 with value 0, which passes, so the search returns step 0.5 after one shrink.",
    },
    id: "backtracking-line-search",
    name: "Backtracking Line Search",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(iterations)" },
    defaultInput: { start: 0, direction: 6, slope: -36, rho: 0.5, c1: 0.0001 },
    visualType: "point",
    run,
    pseudocode: [
        "choose an initial step, shrink factor rho, and constant c1",
        "evaluate the objective at the starting point",
        "evaluate the objective at the trial point x plus t times the direction",
        "compare with the Armijo bound f(x) plus c1 t times the slope",
        "accept the step when the objective is at most the bound",
        "otherwise multiply the step by rho and repeat",
        "stop at the minimum step size or after the iteration limit",
        "done: report the accepted step and new objective value",
    ],
};

export default module;
