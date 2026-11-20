/**
 * bogacki-shampine.ts - Bogacki-Shampine 3(2) Embedded Runge-Kutta
 *
 * An explicit embedded Runge-Kutta pair that obtains a third-order solution
 * and a second-order solution from the same four derivative evaluations. The
 * difference estimates the local error for step-size control. This is a
 * distinct named method from the fifth-order Dormand-Prince pair.
 *
 * This demo integrates the linear model y' = lambda y with fixed steps; the
 * error estimate is computed but the step size is not adapted. It does not
 * cover general nonlinear systems, stiffness, or FSAL reuse.
 *
 * Time:  O(steps) derivative evaluations (four per step)
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
    const f = (y: number): number => lambda * y;
    const exact = (t: number): number => y0 * Math.exp(lambda * t);

    let t = 0;
    let y = y0;
    const trajectory: Array<{ step: number; t: number; y: number; err: number; exact: number }> = [];

    yield {
        stepNumber: 0,
        entities: makeBars(t, y, 0, exact(t)),
        edges: [],
        description: `Integrate y' = ${lambda} y from t=0 with Bogacki-Shampine 3(2), step size ${h}, for ${steps} steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, t, y, h, lambda, localError: 0, exact: exact(t), globalError: 0, trajectory: [] },
    };

    for (let step = 1; step <= steps; step += 1) {
        const k1 = f(y);
        const k2 = f(y + h * (0.5 * k1));
        const k3 = f(y + h * (0.75 * k2));
        const yHigh = y + h * ((2 / 9) * k1 + (1 / 3) * k2 + (4 / 9) * k3);
        const k4 = f(yHigh);
        const yLow = y + h * ((7 / 24) * k1 + (1 / 4) * k2 + (1 / 3) * k3 + (1 / 8) * k4);
        const localError = Math.abs(yHigh - yLow);

        y = yHigh;
        t = step * h;
        const exactValue = exact(t);
        trajectory.push({ step, t, y, err: localError, exact: exactValue });

        yield {
            stepNumber: step,
            entities: makeBars(t, y, localError, exactValue),
            edges: [],
            description: `Step ${step}: t=${t.toFixed(3)}, y=${y.toFixed(8)}, embedded local error ${localError.toExponential(2)}, exact ${exactValue.toFixed(8)}.`,
            codeLineNumber: step === 1 ? 2 : 5,
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

    yield {
        stepNumber: steps + 1,
        entities: makeBars(t, y, trajectory[trajectory.length - 1]?.err ?? 0, exact(t)),
        edges: [],
        description: `After ${steps} steps y(${t.toFixed(3)}) = ${y.toFixed(9)} versus exact ${exact(t).toFixed(9)}; global error ${Math.abs(y - exact(t)).toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            step: steps,
            t,
            y,
            h,
            lambda,
            localError: trajectory[trajectory.length - 1]?.err ?? 0,
            exact: exact(t),
            globalError: Math.abs(y - exact(t)),
            trajectory: [...trajectory],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Several slope samples inside a step combine into a high-order estimate of the solution. A second weighted combination of the very same slopes gives a lower-order estimate for free. Their difference tells us how much the step may have erred, which is the basis of adaptive solvers, though this demo keeps the step fixed so the trajectory is reproducible.",
        invariants: [
            "Both estimates use the same four derivative evaluations at the stage points.",
            "For the linear test problem the third-order estimate is exact up to the fourth-order truncation term.",
            "The embedded error estimate is nonnegative and shrinks with the step size.",
        ],
        correctness:
            "The stage coefficients satisfy the Runge-Kutta order conditions through order three for the high-order weights and through order two for the low-order weights, which is the defining property of the Bogacki-Shampine pair. Applying the method to y' equals lambda y reproduces the exponential series through the cubic term, so the global error after a fixed time is O(h^3). The independent closed-form solution exp(lambda t) is used as the cross-check.",
        complexityRationale:
            "Each step evaluates the derivative four times and performs a constant number of arithmetic operations, so the cost is O(steps). Storing the reported trajectory uses O(steps) space.",
        uses: [
            "Adaptive ODE integration in scientific computing libraries",
            "Non-stiff initial value problems with cheap derivative evaluations",
            "A teaching example of embedded error estimation",
        ],
        references: [
            "Bogacki and Shampine, A 3(2) Pair of Runge-Kutta Formulas, 1989",
            "Hairer, Norsett, and Wanner, Solving Ordinary Differential Equations I, 1993",
        ],
        workedExample:
            "With y(0)=1, lambda=1, and step 0.1, a single Bogacki-Shampine step gives y near 1.105170, matching exp(0.1). After ten steps the value is close to exp(1) = 2.718282 with an error on the order of one part in a million.",
    },
    id: "bogacki-shampine",
    name: "Bogacki-Shampine 3(2) Method",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { lambda: 1, y0: 1, h: 0.1, steps: 10 },
    visualType: "array",
    run,
    pseudocode: [
        "read the step size, derivative parameter, and initial value",
        "evaluate the first slope at the current point",
        "evaluate slopes at the halfway and three-quarter stage points",
        "form the third-order solution update",
        "evaluate the final slope at the updated point",
        "form the second-order update from the same slopes",
        "take the absolute difference as the local error estimate",
        "advance time and repeat for the fixed number of steps",
        "done: report the trajectory and global error",
    ],
};

export default module;
