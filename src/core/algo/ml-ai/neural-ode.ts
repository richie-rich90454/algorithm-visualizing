/**
 * neural-ode.ts - Neural ODE Numerical Integration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A neural ODE defines the hidden state as the solution of dz/dt = f(z, t),
 * where f is a learned vector field. In practice the solution is approximated
 * by a numerical solver. This demo integrates a fixed linear vector field with
 * either explicit Euler or classical fourth-order Runge-Kutta, showing the
 * state at each step and comparing it with the exact solution when the matrix
 * is diagonal.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d^2) for the matrix-vector products
 *   Space: O(steps * d) for the recorded trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the two coordinates of the current state.
 *   - The final frame reports the solver, step count, and endpoint error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Method = "euler" | "rk4";

interface Input {
    z0?: number[];
    A?: number[];
    t0?: number;
    t1?: number;
    steps?: number;
    method?: Method;
}

function bars(values: number[], states: EntityState[], labels?: string[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: labels?.[index] ?? value.toFixed(3),
        value,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const z = (task.z0 ?? [1, 0]).slice(0, 2);
    while (z.length < 2) {
        z.push(0);
    }
    const matrix = (task.A ?? [0, -1, 1, 0]).slice(0, 4);
    while (matrix.length < 4) {
        matrix.push(0);
    }
    const a = matrix[0] ?? 0;
    const b = matrix[1] ?? 0;
    const c = matrix[2] ?? 0;
    const d = matrix[3] ?? 0;
    const t0 = typeof task.t0 === "number" ? task.t0 : 0;
    const t1 = typeof task.t1 === "number" ? task.t1 : 1;
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 8;
    const method: Method = task.method === "euler" ? "euler" : "rk4";
    const h = (t1 - t0) / steps;

    const f = (state: number[]): number[] => [
        a * (state[0] ?? 0) + b * (state[1] ?? 0),
        c * (state[0] ?? 0) + d * (state[1] ?? 0),
    ];

    const trajectory = z.slice();
    let current = z.slice();

    yield {
        stepNumber: 0,
        entities: bars(current, ["idle", "idle"]),
        edges: [],
        description: `Integrate dz/dt = A z from t=${t0.toFixed(2)} to t=${t1.toFixed(2)} in ${steps} ${method} step(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, t: t0, state: current.slice(), trajectory: trajectory.slice(), method, error: 0 },
    };

    for (let step = 1; step <= steps; step += 1) {
        if (method === "euler") {
            const k = f(current);
            current = current.map((v, i) => v + h * (k[i] ?? 0));
        } else {
            const k1 = f(current);
            const mid1 = current.map((v, i) => v + 0.5 * h * (k1[i] ?? 0));
            const k2 = f(mid1);
            const mid2 = current.map((v, i) => v + 0.5 * h * (k2[i] ?? 0));
            const k3 = f(mid2);
            const end = current.map((v, i) => v + h * (k3[i] ?? 0));
            const k4 = f(end);
            current = current.map(
                (v, i) => v + (h / 6) * ((k1[i] ?? 0) + 2 * (k2[i] ?? 0) + 2 * (k3[i] ?? 0) + (k4[i] ?? 0)),
            );
        }
        trajectory.push(...current);
        yield {
            stepNumber: step,
            entities: bars(current, ["active", "active"]),
            edges: [],
            description: `${method.toUpperCase()} step ${step}/${steps} at t=${(t0 + step * h).toFixed(3)}: state (${current[0]?.toFixed(3)}, ${current[1]?.toFixed(3)}).`,
            codeLineNumber: method === "euler" ? 2 : 3,
            layout: "array",
            meta: {
                step,
                t: t0 + step * h,
                state: current.slice(),
                trajectory: trajectory.slice(),
                method,
                error: 0,
            },
        };
    }

    // Exact solution is available when the matrix is diagonal.
    let error = 0;
    if (b === 0 && c === 0) {
        const exact0 = (z[0] ?? 0) * Math.exp(a * (t1 - t0));
        const exact1 = (z[1] ?? 0) * Math.exp(d * (t1 - t0));
        error = Math.max(
            Math.abs((current[0] ?? 0) - exact0),
            Math.abs((current[1] ?? 0) - exact1),
        );
    }

    yield {
        stepNumber: steps + 1,
        entities: bars(current, ["sorted", "sorted"]),
        edges: [],
        description: `Endpoint (${current[0]?.toFixed(3)}, ${current[1]?.toFixed(3)}); diagonal-case exact error ${error.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step: steps, t: t1, state: current.slice(), trajectory: trajectory.slice(), method, error },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A neural ODE replaces a stack of discrete layers with a continuous dynamics whose derivative is a small neural network. To get a prediction we integrate that dynamics forward in time, just like solving any ordinary differential equation. Euler takes a single tangent step, while Runge-Kutta samples the slope several times inside each step for a much more accurate answer.",
        invariants: [
            "Each step advances time by the same step size h.",
            "Euler uses only the slope at the start of the step.",
            "Runge-Kutta combines four slope estimates with weights one, two, two, one.",
        ],
        correctness:
            "Euler is the first-order Taylor step z plus h times f of z. Classical Runge-Kutta matches the Taylor expansion through fourth order by sampling the vector field at the start, two midpoints, and the end, then weighting them by 1/6, 1/3, 1/3 and 1/6. For a diagonal matrix A the ODE decouples into scalar equations whose exact solutions are exponential functions, so the endpoint error measures the truncation error of the chosen solver and shrinks with smaller step sizes.",
        complexityRationale:
            "Each derivative evaluation multiplies a 2 by 2 matrix by a vector; Euler uses one evaluation per step and Runge-Kutta uses four, so the total is O(steps times d squared). Recording the state at every step uses O(steps times d) space.",
        uses: [
            "Continuous-depth models with adaptive computation",
            "Modeling irregularly sampled time series",
            "Invertible generative models with the adjoint method",
        ],
        references: [
            "Chen, Rubanova, Bettencourt and Duvenaud, Neural Ordinary Differential Equations, NeurIPS 2018",
            "Hairer, Norsett and Wanner, Solving Ordinary Differential Equations I, Springer",
        ],
        workedExample:
            "For z(0) equal to (1, 0) and A equal to the rotation [[0, -1], [1, 0]], the solution circles the origin. With step size 0.125 and eight Runge-Kutta steps reaching t=1, the endpoint is near (0.54, 0.84), close to the exact (cos 1, sin 1). Euler with the same step size drifts noticeably farther out.",
    },
    id: "neural-ode",
    name: "Neural ODE Integration",
    category: "ml-ai",
    complexity: { time: "O(steps * d^2)", space: "O(steps * d)" },
    defaultInput: {
        z0: [1, 0],
        A: [0, -1, 1, 0],
        t0: 0,
        t1: 1,
        steps: 8,
        method: "rk4",
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the initial state, matrix, time span, and step count",
        "compute the step size from the time span",
        "for each step take one Euler tangent step when selected",
        "otherwise combine four Runge-Kutta slope estimates",
        "append the new state to the trajectory",
        "compare the endpoint with the exact diagonal solution",
        "done: report the endpoint and integration error",
    ],
};

export default module;
