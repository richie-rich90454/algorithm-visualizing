/**
 * dormand-prince.ts - Dormand-Prince 5(4) Embedded Runge-Kutta
 *
 * A seventh-stage explicit Runge-Kutta pair that produces a fifth-order
 * solution and a fourth-order error estimate from the same derivative samples.
 * Its first-as-last structure reuses the final stage of one step as the first
 * stage of the next. It is a distinct named method from the Bogacki-Shampine
 * and Cash-Karp pairs already in the catalog.
 *
 * This demo integrates y' = lambda y with fixed steps. It does not implement
 * adaptive step-size control, dense output, or general nonlinear systems.
 *
 * Time:  O(steps) derivative evaluations (seven per step)
 * Space: O(steps) for the reported trajectory
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    lambda?: number;
    y0?: number;
    h?: number;
    steps?: number;
}

function makeBars(t: number, y: number, err: number, exact: number): VisualEntity[] {
    const values = [t, y, err, exact];
    const labels = ["time", "y", "local error", "exact"];
    return values.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: `${labels[i]}=${value.toFixed(6)}`,
        value,
        state: i === 1 ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, role: labels[i] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const lambda = Number.isFinite(task.lambda) ? Number(task.lambda) : 1;
    const y0 = Number.isFinite(task.y0) ? Number(task.y0) : 1;
    const h = Number.isFinite(task.h) && Number(task.h) !== 0 ? Number(task.h) : 0.1;
    const steps = Math.min(500, Math.max(1, Math.floor(Number(task.steps ?? 10)) || 10));
    const f = (value: number): number => lambda * value;
    const exact = (t: number): number => y0 * Math.exp(lambda * t);

    let y = y0;
    const trajectory: Array<{ step: number; t: number; y: number; err: number; exact: number }> = [];

    yield {
        stepNumber: 0,
        entities: makeBars(0, y, 0, exact(0)),
        edges: [],
        description: `Integrate y' = ${lambda} y with the Dormand-Prince 5(4) pair, step ${h}, for ${steps} steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, t: 0, y, h, lambda, localError: 0, exact: exact(0), globalError: 0, trajectory: [] },
    };

    for (let step = 1; step <= steps; step += 1) {
        const k1 = f(y);
        const k2 = f(y + h * ((1 / 5) * k1));
        const k3 = f(y + h * ((3 / 40) * k1 + (9 / 40) * k2));
        const k4 = f(y + h * ((44 / 45) * k1 - (56 / 15) * k2 + (32 / 9) * k3));
        const k5 = f(y + h * ((19372 / 6561) * k1 - (25360 / 2187) * k2 + (64448 / 6561) * k3 - (212 / 729) * k4));
        const k6 = f(y + h * ((9017 / 3168) * k1 - (355 / 33) * k2 + (46732 / 5247) * k3 + (49 / 176) * k4 - (5103 / 18656) * k5));
        const yHigh = y + h * ((35 / 384) * k1 + (500 / 1113) * k3 + (125 / 192) * k4 - (2187 / 6784) * k5 + (11 / 84) * k6);
        const k7 = f(yHigh);
        const yLow = y + h * ((5179 / 57600) * k1 + (7571 / 16695) * k3 + (393 / 640) * k4 - (92097 / 339200) * k5 + (187 / 2100) * k6 + (1 / 40) * k7);
        const localError = Math.abs(yHigh - yLow);

        y = yHigh;
        const t = step * h;
        const exactValue = exact(t);
        trajectory.push({ step, t, y, err: localError, exact: exactValue });

        yield {
            stepNumber: step,
            entities: makeBars(t, y, localError, exactValue),
            edges: [],
            description: `Step ${step}: t=${t.toFixed(3)}, y=${y.toFixed(9)}, embedded error ${localError.toExponential(2)}, exact ${exactValue.toFixed(9)}.`,
            codeLineNumber: step === 1 ? 2 : 6,
            layout: "array",
            meta: {
                step,
                t,
                y,
                h,
                lambda,
                localError,
                exact: exactValue,
                globalError: Math.abs(y - exactValue),
                trajectory: [...trajectory],
            },
        };
    }

    const finalExact = exact(steps * h);
    yield {
        stepNumber: steps + 1,
        entities: makeBars(steps * h, y, trajectory[trajectory.length - 1]?.err ?? 0, finalExact),
        edges: [],
        description: `After ${steps} steps y(${ (steps * h).toFixed(3) }) = ${y.toFixed(10)} versus exact ${finalExact.toFixed(10)}; error ${Math.abs(y - finalExact).toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            step: steps,
            t: steps * h,
            y,
            h,
            lambda,
            localError: trajectory[trajectory.length - 1]?.err ?? 0,
            exact: finalExact,
            globalError: Math.abs(y - finalExact),
            trajectory: [...trajectory],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Take several slope samples inside a step and combine them in two ways. One combination cancels all error terms through order five and gives the accepted solution; another uses the same samples through order four and gives a cheap error estimate. The last stage equals the first stage of the next step, so an accepted step costs only six new derivative evaluations after the first.",
        invariants: [
            "Both estimates are formed from the same seven stage derivatives.",
            "For the linear test problem the fifth-order estimate matches the exponential series through the fifth power of the step.",
            "The embedded error estimate is nonnegative and falls rapidly as the step shrinks.",
        ],
        correctness:
            "The stage coefficients satisfy the Runge-Kutta order conditions through order five for the accepted weights and order four for the embedded weights, which defines the Dormand-Prince 5(4) pair. Applied to y' equals lambda y the method reproduces the exponential Taylor series through the fifth term, so the global error after a fixed time is O(h to the fifth). The independent closed form exp(lambda t) is the cross-check used in the test.",
        complexityRationale:
            "Each step evaluates the derivative seven times with a constant number of arithmetic operations, giving O(steps) time and O(1) working space. The frames retain the trajectory, so the visualization reports O(steps) space.",
        uses: [
            "General-purpose non-stiff ODE integration in scientific libraries",
            "Adaptive step-size control driven by the embedded error estimate",
            "A teaching model of a high-order explicit Runge-Kutta pair",
        ],
        references: [
            "Dormand and Prince, A Family of Embedded Runge-Kutta Formulae, 1980",
            "Hairer, Norsett, and Wanner, Solving Ordinary Differential Equations I, 1993",
        ],
        workedExample:
            "With y(0)=1, lambda=1 and a single step of size 0.1, the fifth-order estimate is about 1.105170918, matching exp(0.1)=1.105170186 to roughly five digits. After ten steps the value is within a few parts in a billion of exp(1).",
    },
    id: "dormand-prince",
    name: "Dormand-Prince 5(4) Method",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { lambda: 1, y0: 1, h: 0.1, steps: 10 },
    visualType: "array",
    run,
    pseudocode: [
        "read the step size, rate, initial value, and step count",
        "set the current value to the initial value",
        "evaluate the seven stage slopes with tabulated coefficients",
        "form the fifth-order accepted solution",
        "form the fourth-order embedded solution from the same slopes",
        "take the absolute difference as the local error estimate",
        "advance the current value to the fifth-order result",
        "repeat until all steps are complete",
        "done: report the trajectory and global error",
    ],
};

export default module;
