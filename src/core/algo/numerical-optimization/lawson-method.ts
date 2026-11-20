/**
 * lawson-method.ts - Lawson Integrating-Factor Runge-Kutta Method
 *
 * Lawson's method removes a known linear part from a semilinear ordinary
 * differential equation by changing to the integrating-factor frame u = exp(-lambda t) y.
 * The transformed equation has only the nonlinear forcing, so a classical
 * fourth-order Runge-Kutta step is applied there and the result is transformed
 * back. The method is fourth order and exact for a purely linear equation.
 *
 * Limits of the demo: a single real scalar unknown, a constant linear
 * coefficient, nonlinearities limited to constant, quadratic and cubic forms,
 * and a fixed step size. The integrating factor is handled relative to the
 * current step to avoid large absolute exponentials. No adaptive control or
 * matrix exponentials are included.
 *
 * Time: O(steps) because each step uses four derivative evaluations.
 * Space: O(steps) for the recorded trajectory.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Mode = "constant" | "quadratic" | "cubic";

function nonlinearity(y: number, forcing: number, mode: Mode): number {
    if (mode === "constant") {
        return forcing;
    }
    if (mode === "quadratic") {
        return forcing * y * y;
    }
    return forcing * y * y * y;
}

/** Classical RK4 on the transformed equation v' = exp(-lambda s) N(exp(lambda s) v). */
export function lawsonStep(y: number, lambda: number, h: number, forcing: number, mode: Mode): number {
    const g = (s: number, v: number) => {
        const grown = Math.exp(lambda * s) * v;
        return Math.exp(-lambda * s) * nonlinearity(grown, forcing, mode);
    };
    const k1 = g(0, y);
    const k2 = g(h / 2, y + (h / 2) * k1);
    const k3 = g(h / 2, y + (h / 2) * k2);
    const k4 = g(h, y + h * k3);
    const vNext = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    return Math.exp(lambda * h) * vNext;
}

/** Independent fine classical RK4 reference for the original equation. */
export function lawsonReference(lambda: number, h: number, steps: number, y0: number, forcing: number, mode: Mode): number[] {
    const substeps = 40;
    const dt = h / substeps;
    let y = y0;
    const values = [y];
    const f = (value: number) => lambda * value + nonlinearity(value, forcing, mode);
    for (let step = 0; step < steps; step += 1) {
        for (let k = 0; k < substeps; k += 1) {
            const k1 = f(y);
            const k2 = f(y + (dt / 2) * k1);
            const k3 = f(y + (dt / 2) * k2);
            const k4 = f(y + dt * k3);
            y += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
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
        forcing?: number; mode?: Mode;
    } | null) ?? {};
    const lambda = Number(task.lambda ?? -1.5);
    const h = Math.max(1e-6, Number(task.h ?? 0.05));
    const steps = Math.min(200, Math.max(1, Math.floor(Number(task.steps ?? 24)) || 24));
    const y0 = Number(task.y0 ?? 1);
    const forcing = Number(task.forcing ?? 1);
    const mode: Mode = task.mode === "constant" || task.mode === "quadratic" ? task.mode : "cubic";
    const reference = lawsonReference(lambda, h, steps, y0, forcing, mode);
    let y = y0;
    const values = [y];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, -1),
        edges: [],
        description: `Lawson integrating-factor RK4 on y' = ${lambda}y + N(y), ${steps} steps of size ${h}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lambda, h, steps, mode, values: [...values], reference: [...reference], error: 0 },
    };
    step += 1;

    for (let i = 0; i < steps; i += 1) {
        y = lawsonStep(y, lambda, h, forcing, mode);
        values.push(y);
        const error = Math.abs(y - (reference[i + 1] as number));
        yield {
            stepNumber: step,
            entities: makeBars(values, i),
            edges: [],
            description: `Step ${i + 1}: y=${y.toFixed(8)}, reference ${(reference[i + 1] as number).toFixed(8)}, error ${error.toExponential(2)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                lambda, h, mode, active: i,
                values: [...values],
                reference: [...reference],
                current: y,
                referenceValue: reference[i + 1] as number,
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
        description: `Final value ${(values[steps] as number).toFixed(9)}, error ${finalError.toExponential(3)} against the fine reference.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            lambda, h, steps, mode,
            values: [...values],
            reference: [...reference],
            finalValue: values[steps] as number,
            finalError,
            accurate: finalError < 1e-5,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A stiff linear term can make an explicit method take tiny steps even when the interesting behavior is slow. Lawson's trick is to divide out the known exponential growth before applying a standard Runge-Kutta method. In that moving frame the linear part disappears, so the expensive accuracy is spent only on the nonlinear remainder, and the answer is multiplied back at the end.",
        invariants: [
            "The integrating factor cancels the linear part in the transformed equation.",
            "With zero nonlinearity one step returns the exact exp(lambda h) y.",
            "The four Runge-Kutta stages sample the transformed forcing at step positions 0, half, half and one.",
        ],
        correctness:
            "Substituting u = exp(-lambda t) y gives u' = exp(-lambda t) N(exp(lambda t) u), an ordinary differential equation with no linear term. Applying a classical fourth-order Runge-Kutta method to u and then multiplying by exp(lambda h) produces a fourth-order approximation of the original flow. For N identically zero the stage derivatives vanish and the step reduces to multiplication by exp(lambda h), the exact linear solution.",
        complexityRationale:
            "Each step computes four transformed forcing values, so the work is O(steps) with a modest constant. The recorded trajectory for replay uses O(steps) space.",
        uses: [
            "Stiff chemical kinetics with a linear decay term",
            "Exponential integration in semiconductor device simulation",
            "Stable time stepping for damped wave and reaction systems",
        ],
        references: [
            "Lawson, Runge-Kutta Methods for Integrating Stiff Systems, 1967",
            "Hairer and Wanner, Solving Ordinary Differential Equations II, 1996",
        ],
        workedExample:
            "For y' = -2y with y(0) = 1 the transformed forcing is zero, so one Lawson step with h = 0.1 returns exp(-0.2), about 0.8187, exactly. Adding a quadratic forcing keeps the method fourth order, and over twenty steps of size 0.05 the error against a fine reference stays below 1e-5.",
    },
    id: "lawson-method",
    name: "Lawson Integrating-Factor Method",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { lambda: -1.5, h: 0.05, steps: 24, y0: 1, forcing: 1, mode: "cubic" },
    visualType: "array",
    run,
    pseudocode: [
        "read lambda, step size, count and nonlinearity mode",
        "define the transformed forcing with the integrating factor",
        "compute four Runge-Kutta stages in the transformed frame",
        "combine the stages into the next transformed value",
        "multiply by exp(lambda h) to return to the original frame",
        "record the value and compare with a fine RK4 reference",
        "continue until all steps are done",
        "done: report the trajectory and final error",
    ],
};

export default module;
