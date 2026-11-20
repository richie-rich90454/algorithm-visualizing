/**
 * implicit-explicit-method.ts - IMEX Euler for Split Ordinary Differential Equations
 *
 * Many evolution equations split into a stiff term and a nonstiff term. IMEX
 * Euler treats the stiff linear part implicitly with backward Euler, which is
 * unconditionally stable, and the remaining forcing explicitly with forward
 * Euler. The two are combined in one update that stays stable for large stiff
 * coefficients while costing the same as an explicit step.
 *
 * Limits of the demo: a single real scalar unknown, a linear implicit part
 * lambda y with lambda negative, an explicit forcing that is either constant
 * or a cosine, and a fixed step size. No nonlinear implicit solves, higher
 * order IMEX schemes, or systems of equations are modeled.
 *
 * Time: O(steps). Space: O(steps) for the recorded trajectory.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type ForcingMode = "constant" | "cosine";

function forcingAt(t: number, amplitude: number, mode: ForcingMode): number {
    return mode === "constant" ? amplitude : amplitude * Math.cos(t);
}

/** One implicit-explicit Euler step for y' = lambda y + g(t). */
export function imexStep(y: number, lambda: number, h: number, t: number, amplitude: number, mode: ForcingMode): number {
    return (y + h * forcingAt(t, amplitude, mode)) / (1 - h * lambda);
}

/** Exact affine solution when the forcing is constant. */
export function constantForcingExact(lambda: number, y0: number, amplitude: number, t: number): number {
    const equilibrium = -amplitude / lambda;
    return equilibrium + (y0 - equilibrium) * Math.exp(lambda * t);
}

/** Independent fine classical RK4 reference for either forcing mode. */
export function imexReference(
    lambda: number, h: number, steps: number, y0: number, amplitude: number, mode: ForcingMode,
): number[] {
    const substeps = 40;
    const dt = h / substeps;
    let y = y0;
    let t = 0;
    const values = [y];
    const f = (time: number, value: number) => lambda * value + forcingAt(time, amplitude, mode);
    for (let step = 0; step < steps; step += 1) {
        for (let k = 0; k < substeps; k += 1) {
            const k1 = f(t, y);
            const k2 = f(t + dt / 2, y + (dt / 2) * k1);
            const k3 = f(t + dt / 2, y + (dt / 2) * k2);
            const k4 = f(t + dt, y + dt * k3);
            y += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
            t += dt;
        }
        values.push(y);
    }
    return values;
}

function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `y${index}=${value.toFixed(5)}`,
        value,
        state: index === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: "trajectory" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        lambda?: number; h?: number; steps?: number; y0?: number;
        amplitude?: number; forcingMode?: ForcingMode;
    } | null) ?? {};
    const lambda = Math.min(-1e-6, Number(task.lambda ?? -8));
    const h = Math.max(1e-6, Number(task.h ?? 0.05));
    const steps = Math.min(200, Math.max(1, Math.floor(Number(task.steps ?? 30)) || 30));
    const y0 = Number(task.y0 ?? 1);
    const amplitude = Number(task.amplitude ?? 2);
    const mode: ForcingMode = task.forcingMode === "constant" ? "constant" : "cosine";
    const reference = imexReference(lambda, h, steps, y0, amplitude, mode);
    let y = y0;
    const values = [y];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, -1),
        edges: [],
        description: `IMEX Euler on y' = ${lambda}y + g(t) with ${steps} steps of size ${h}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lambda, h, steps, mode, values: [...values], reference: [...reference], error: 0 },
    };
    step += 1;

    for (let i = 0; i < steps; i += 1) {
        const t = i * h;
        const explicit = forcingAt(t, amplitude, mode);
        y = imexStep(y, lambda, h, t, amplitude, mode);
        values.push(y);
        const error = Math.abs(y - (reference[i + 1] as number));
        yield {
            stepNumber: step,
            entities: makeBars(values, i),
            edges: [],
            description: `Step ${i + 1}: explicit forcing ${explicit.toFixed(5)}, y=${y.toFixed(7)}, error ${error.toExponential(2)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                lambda, h, mode, active: i,
                values: [...values],
                reference: [...reference],
                current: y,
                explicitForcing: explicit,
                error,
            },
        };
        step += 1;
    }

    const finalError = Math.abs((values[steps] as number) - (reference[steps] as number));
    yield {
        stepNumber: step,
        entities: makeBars(values, -1),
        edges: [],
        description: `Final value ${(values[steps] as number).toFixed(8)}, error ${finalError.toExponential(3)} against the fine reference.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            lambda, h, steps, mode,
            values: [...values],
            reference: [...reference],
            finalValue: values[steps] as number,
            finalError,
            stable: Number.isFinite(y),
            accurate: finalError < 1e-2,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Explicit methods are cheap but blow up on stiff terms, while fully implicit methods are stable but need nonlinear solves. IMEX Euler splits the difference: the stiff linear decay is solved implicitly by evaluating the unknown at the next time, and the gentle forcing uses the known value at the current time. Rearranging gives a one-line update that remains stable even when the stiff coefficient is large.",
        invariants: [
            "With zero forcing the update equals backward Euler for y' = lambda y.",
            "The denominator 1 minus h lambda is positive when lambda is negative.",
            "The explicit forcing is always evaluated at the start of the step.",
        ],
        correctness:
            "Writing the stiff part at time n+1 and the forcing at time n gives y_{n+1} = y_n + h(lambda y_{n+1} + g(t_n)). Solving the linear equation for y_{n+1} yields the stated update. The implicit treatment has amplification factor 1/(1 - h lambda), whose magnitude is below one for every step size when lambda is negative, so the stiff mode never destabilizes. The local error is O(h squared), giving first-order convergence to the true solution reproduced by the fine reference.",
        complexityRationale:
            "Each step needs one forcing evaluation and a few arithmetic operations, so the work is O(steps). The trajectory stored for replay uses O(steps) space.",
        uses: [
            "Advection-diffusion equations with stiff diffusion",
            "Stiff chemical kinetics coupled to slow source terms",
            "Operator-splitting solvers in computational fluid dynamics",
        ],
        references: [
            "Ascher, Ruuth and Wetton, Implicit-Explicit Methods for Time-Dependent PDEs, 1995",
            "Hairer and Wanner, Solving Ordinary Differential Equations II, 1996",
        ],
        workedExample:
            "For y' = -8y + 2 with y(0) = 1 and h = 0.2, the explicit amplification would exceed one in magnitude, but IMEX uses 1/(1 + 1.6) about 0.385 for the stiff part. The iterates decay smoothly toward the equilibrium 0.25 and agree with a fine RK4 reference to within a few thousandths.",
    },
    id: "implicit-explicit-method",
    name: "Implicit-Explicit (IMEX) Euler Method",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { lambda: -8, h: 0.05, steps: 30, y0: 1, amplitude: 2, forcingMode: "cosine" },
    visualType: "array",
    run,
    pseudocode: [
        "read the stiff coefficient, step size and forcing mode",
        "start from the given initial value",
        "evaluate the explicit forcing at the current time",
        "divide y plus h times forcing by one minus h lambda",
        "store the new value and its reference error",
        "advance the time and repeat",
        "after the last step check stability and accuracy",
        "done: report the trajectory and final error",
    ],
};

export default module;
