/**
 * dormand-prince-rk45.ts - Dormand-Prince RK45 Adaptive Integrator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dormand-Prince is an embedded Runge-Kutta pair that takes a fifth-order step
 * and, from the same seven stages, a fourth-order step. Their difference
 * estimates the local truncation error, which drives an adaptive step size:
 * a step is accepted when the error is within tolerance, and the next step
 * size is scaled by the classic (tol / error)^(1/5) rule. This module solves
 * the scalar linear ODE dy/dt = lambda y with a known exact solution, so the
 * error estimate and the final answer are both directly checkable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(s) for s accepted plus rejected adaptive steps (7 stages each)
 *   Space: O(s) for the recorded step frames
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each accepted or rejected step is a node at its (t, y) position.
 *   - Accepted steps are green; a rejected step is red.
 *   - Edges connect consecutive attempts and are labeled with the step size.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Input {
    lambda?: number;
    y0?: number;
    t0?: number;
    tEnd?: number;
    tol?: number;
    h0?: number;
    maxSteps?: number;
}

/** The seven Dormand-Prince stage coefficients. */
const A: number[][] = [
    [],
    [1 / 5],
    [3 / 40, 9 / 40],
    [44 / 45, -56 / 15, 32 / 9],
    [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
    [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
    [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
];
const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
const B5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
const B4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];

/** Build step entities and connecting edges for one frame. */
function makeEntities(
    steps: Array<{ t: number; y: number; accepted: boolean }>,
    sizes: number[],
    current: number,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = steps.map((s, i) => ({
        id: `step-${i}`,
        type: "node" as const,
        label: `t=${s.t.toFixed(2)}`,
        value: s.y,
        state: (i === current ? "comparing" : s.accepted ? "sorted" : "error") as EntityState,
        x: s.t,
        y: s.y,
        width: 0,
        height: 0,
        metadata: { index: i, t: s.t, y: s.y, h: sizes[i] ?? 0, accepted: s.accepted },
    }));
    const edges: VisualEdge[] = [];
    for (let i = 1; i < steps.length; i += 1) {
        edges.push({
            id: `seg-${i}`,
            sourceId: `step-${i - 1}`,
            targetId: `step-${i}`,
            label: (sizes[i] ?? 0).toExponential(1),
            state: steps[i]?.accepted ? "visited" : "error",
            directed: true,
        });
    }
    return { entities, edges };
}

/** The Dormand-Prince generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const lambda = Number(task.lambda ?? 1);
    const y0 = Number(task.y0 ?? 1);
    const t0 = Number(task.t0 ?? 0);
    const tEnd = Number(task.tEnd ?? 1);
    const tol = Math.max(1e-12, Number(task.tol ?? 1e-6));
    let h = Math.abs(Number(task.h0 ?? 0.5)) || 0.5;
    const maxSteps = Math.max(1, Math.floor(Number(task.maxSteps ?? 50)) || 50);
    const f = (_t: number, y: number): number => lambda * y;

    let t = t0;
    let y = y0;
    const steps: Array<{ t: number; y: number; accepted: boolean }> = [{ t, y, accepted: true }];
    const sizes: number[] = [h];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(steps, sizes, 0).entities,
        edges: [],
        description: `Dormand-Prince integrating dy/dt = ${lambda} y from t=${t0} to t=${tEnd} with tolerance ${tol}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { t, y, h, accepted: true, error: 0, exact: y0 * Math.exp(lambda * (t - t0)) },
    };
    step += 1;

    let attempts = 0;
    while (t < tEnd - 1e-14 && attempts < maxSteps) {
        attempts += 1;
        h = Math.min(h, tEnd - t);
        const k: number[] = [];
        for (let i = 0; i < 7; i += 1) {
            let sum = y;
            for (let j = 0; j < i; j += 1) {
                sum += h * (A[i]?.[j] ?? 0) * (k[j] ?? 0);
            }
            k.push(f(t + h * C[i], sum));
        }
        let y5 = 0;
        let y4 = 0;
        for (let i = 0; i < 7; i += 1) {
            y5 += (B5[i] ?? 0) * (k[i] ?? 0);
            y4 += (B4[i] ?? 0) * (k[i] ?? 0);
        }
        y5 = y + h * y5;
        y4 = y + h * y4;
        const error = Math.abs(y5 - y4);
        const accepted = error <= tol;

        if (accepted) {
            t += h;
            y = y5;
        }
        const scale = error > 0 ? Math.min(5, Math.max(0.2, 0.9 * Math.pow(tol / error, 0.2))) : 5;
        h = Math.max(1e-10, h * scale);

        steps.push({ t, y, accepted });
        sizes.push(h);
        const built = makeEntities(steps, sizes, steps.length - 1);
        yield {
            stepNumber: step,
            entities: built.entities,
            edges: built.edges,
            description: `Attempt ${attempts}: error ${error.toExponential(2)}, step ${accepted ? "accepted" : "rejected"}, next h = ${h.toExponential(2)}.`,
            codeLineNumber: accepted ? 3 : 5,
            layout: "point",
            meta: {
                t,
                y,
                h,
                accepted,
                error,
                exact: y0 * Math.exp(lambda * (t - t0)),
                stage: steps.length - 1,
            },
        };
        step += 1;
    }

    const exactEnd = y0 * Math.exp(lambda * (tEnd - t0));
    const built = makeEntities(steps, sizes, -1);
    yield {
        stepNumber: step,
        entities: built.entities,
        edges: built.edges,
        description: `Done after ${attempts} attempt(s): y(${t.toFixed(4)}) = ${y.toFixed(8)}, exact = ${exactEnd.toFixed(8)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { t, y, h, accepted: true, exact: exactEnd, error: Math.abs(y - exactEnd), attempts, done: true },
    };
}

/** The Dormand-Prince module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A single Runge-Kutta step samples the slope several times inside the interval to reach high order. Dormand-Prince cleverly reuses those samples to produce two answers of order five and four at once. If they disagree by more than the tolerance, the step is too ambitious and is retried with a smaller step; if they agree well, the larger step is kept and the next step may grow.",
        invariants: [
            "The fifth-order step and fourth-order step share the same seven stage evaluations.",
            "A step is accepted only when the embedded error estimate is within tolerance.",
            "The step size is always positive and bounded below to avoid stalling.",
        ],
        correctness:
            "The Dormand-Prince coefficients satisfy the order conditions for a fifth-order method, so the local error of the accepted step is proportional to h to the sixth power. The embedded fourth-order solution differs by the leading error term, making their difference a reliable error estimate. Accepting only within tolerance and adapting h by the fifth-root rule keeps the global error near the requested tolerance; for the linear test problem the method's stability and convergence to the exact exponential are directly verifiable.",
        complexityRationale:
            "Each attempted step evaluates the derivative seven times, a constant cost, so s attempts take O(s) time. Recording one frame per attempt uses O(s) space.",
        uses: [
            "Adaptive numerical solution of ordinary differential equations",
            "Physics and engineering simulations with varying stiffness",
            "The default integrator in many scientific computing libraries",
        ],
        references: [
            "Dormand and Prince, A Family of Embedded Runge-Kutta Formulae, 1980",
            "Hairer, Norsett and Wanner, Solving Ordinary Differential Equations I, 1993",
        ],
        workedExample:
            "For dy/dt = y with y(0) = 1 and h = 0.5, the seven stages all evaluate the exponential's slope. The fifth- and fourth-order estimates for y(0.5) differ by a tiny amount, well below a tolerance of 1e-6, so the step is accepted and y is about 1.6487, matching e to 0.5. The step size then grows because the error is small.",
    },
    id: "dormand-prince-rk45",
    name: "Dormand-Prince RK45 Adaptive Integrator",
    category: "numerical-optimization",
    complexity: { time: "O(s)", space: "O(s)" },
    defaultInput: { lambda: 1, y0: 1, t0: 0, tEnd: 1, tol: 1e-6, h0: 0.5, maxSteps: 50 },
    visualType: "point",
    run,
    pseudocode: [
        "choose initial step size and error tolerance",
        "for each step until the end time",
        "evaluate the seven Dormand-Prince stages",
        "form the fifth-order and fourth-order estimates",
        "estimate the local error from their difference",
        "accept the step when the error is within tolerance",
        "adapt the next step size by the fifth-root rule",
        "retry with a smaller step when rejected",
        "done: report the final integrated value",
    ],
};

export default module;
