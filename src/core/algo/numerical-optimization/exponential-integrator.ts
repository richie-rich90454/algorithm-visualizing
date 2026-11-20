/**
 * exponential-integrator.ts - Exponential Euler Integrator for Semilinear ODEs
 *
 * For an equation y' = lambda y + N(y), the linear part is advanced exactly by
 * the exponential and the nonlinear part is frozen over the step and integrated
 * with the phi-1 function. The result is first-order accurate, handles stiff
 * linear terms without a step-size restriction, and reduces to the exact
 * solution when the nonlinear part is constant.
 *
 * Limits of the demo: a single real scalar unknown, a constant linear
 * coefficient, nonlinearities limited to constant, quadratic and cubic forms,
 * and a fixed step size. No matrix exponentials, adaptive stepping, or higher
 * exponential Runge-Kutta stages are used.
 *
 * Time: O(steps). Space: O(steps) for the recorded trajectory.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Mode = "constant" | "quadratic" | "cubic";

/** Compute exp(z) and phi1(z) = (exp(z)-1)/z with a series near zero. */
export function expPhi(z: number): { exponential: number; phi1: number } {
    const exponential = Math.exp(z);
    if (Math.abs(z) < 1e-6) {
        let phi = 1 + z / 2;
        let term = z / 2;
        for (let k = 2; k <= 12; k += 1) {
            term *= z / (k + 1);
            phi += term;
        }
        return { exponential, phi1: phi };
    }
    return { exponential, phi1: (exponential - 1) / z };
}

function nonlinearity(y: number, forcing: number, mode: Mode): number {
    if (mode === "constant") {
        return forcing;
    }
    if (mode === "quadratic") {
        return forcing * y * y;
    }
    return forcing * y * y * y;
}

/** One exponential Euler step. */
export function exponentialStep(y: number, lambda: number, h: number, forcing: number, mode: Mode): number {
    const { exponential, phi1 } = expPhi(lambda * h);
    return exponential * y + h * phi1 * nonlinearity(y, forcing, mode);
}

/** Independent fine-step classical RK4 reference for the whole trajectory. */
export function rk4Reference(lambda: number, h: number, steps: number, y0: number, forcing: number, mode: Mode): number[] {
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
    const lambda = Number(task.lambda ?? -2);
    const h = Math.max(1e-6, Number(task.h ?? 0.05));
    const steps = Math.min(200, Math.max(1, Math.floor(Number(task.steps ?? 30)) || 30));
    const y0 = Number(task.y0 ?? 1);
    const forcing = Number(task.forcing ?? 1);
    const mode: Mode = task.mode === "constant" || task.mode === "cubic" ? task.mode : "quadratic";
    const reference = rk4Reference(lambda, h, steps, y0, forcing, mode);
    let y = y0;
    const values = [y];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, -1),
        edges: [],
        description: `Integrate y' = ${lambda}y + N(y) with exponential Euler, ${steps} steps of size ${h}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lambda, h, steps, mode, values: [...values], reference: [...reference], error: 0 },
    };
    step += 1;

    for (let i = 0; i < steps; i += 1) {
        y = exponentialStep(y, lambda, h, forcing, mode);
        values.push(y);
        const error = Math.abs(y - (reference[i + 1] as number));
        yield {
            stepNumber: step,
            entities: makeBars(values, i),
            edges: [],
            description: `Step ${i + 1}: y=${y.toFixed(7)}, fine RK4 reference ${(reference[i + 1] as number).toFixed(7)}.`,
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
        description: `Final value ${(values[steps] as number).toFixed(8)}, error ${finalError.toExponential(3)} against the fine reference.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            lambda, h, steps, mode,
            values: [...values],
            reference: [...reference],
            finalValue: values[steps] as number,
            finalError,
            accurate: finalError < 1e-2,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When an equation has a fast linear part and a slow nonlinear part, a generic method wastes work resolving the fast part. An exponential integrator solves the linear part exactly with the exponential function and treats only the remaining nonlinearity explicitly. The phi-1 function is the correct average of the exponential over one step, so a constant forcing is integrated exactly.",
        invariants: [
            "The exponential factor advances the linear part exactly over each step.",
            "Phi-1 tends to one as its argument tends to zero, avoiding cancellation.",
            "For constant nonlinearity the update equals the analytic affine solution.",
        ],
        correctness:
            "For y' = lambda y + c the variation-of-constants formula gives y(t+h) = exp(lambda h) y(t) + c times the integral of exp(lambda (t+h-s)) ds, which equals h phi1(lambda h) c. Freezing a varying nonlinearity at the step start makes the local error proportional to h squared, hence first-order global accuracy. As h tends to zero the scheme converges to the exact flow, which the fine RK4 reference independently reproduces.",
        complexityRationale:
            "Each step evaluates two scalar functions and one nonlinearity, so the work is O(steps). Recording the trajectory for replay uses O(steps) space.",
        uses: [
            "Stiff reaction-diffusion and semilinear parabolic equations",
            "Exponential time differencing in spectral methods",
            "Stable integration of damped oscillators and relaxation models",
        ],
        references: [
            "Hochbruck and Ostermann, Exponential Integrators, 2010",
            "Hairer and Wanner, Solving Ordinary Differential Equations II, 1996",
        ],
        workedExample:
            "For y' = -2y + 1 with y(0) = 0 the exact value after any step is one half times one minus exp(-2t). Exponential Euler with a constant nonlinearity reproduces that value at every step to machine precision, because phi-1 integrates the constant forcing exactly.",
    },
    id: "exponential-integrator",
    name: "Exponential Integrator (Exponential Euler)",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { lambda: -2, h: 0.05, steps: 30, y0: 1, forcing: 1, mode: "quadratic" },
    visualType: "array",
    run,
    pseudocode: [
        "read lambda, step size, count and nonlinearity mode",
        "compute exp(lambda h) and phi1(lambda h)",
        "freeze the nonlinearity at the current value",
        "set the next value to exp times y plus h phi1 times N(y)",
        "record the value and compare with a fine RK4 reference",
        "advance to the next step",
        "after the last step report the final error",
        "done: report the trajectory and accuracy flag",
    ],
};

export default module;
