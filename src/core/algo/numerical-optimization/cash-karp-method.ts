/**
 * cash-karp-method.ts - Cash-Karp 5(4) Embedded Runge-Kutta
 *
 * A six-stage explicit Runge-Kutta pair that yields a fifth-order solution and
 * a fourth-order error estimate. Its coefficient table differs from the
 * Dormand-Prince and Bogacki-Shampine pairs, so it is a genuinely distinct
 * named method even though all three are embedded Runge-Kutta families.
 *
 * This demo integrates y' = lambda y with fixed steps. It does not implement
 * adaptive stepping, dense output, or general nonlinear systems.
 *
 * Time:  O(steps) derivative evaluations (six per step)
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
    const labels = ["time", "y", "local error", "exact"];
    const values = [t, y, err, exact];
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
        description: `Integrate y' = ${lambda} y with the Cash-Karp 5(4) pair, step ${h}, for ${steps} steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, t: 0, y, h, lambda, localError: 0, exact: exact(0), globalError: 0, trajectory: [] },
    };

    for (let step = 1; step <= steps; step += 1) {
        const k1 = f(y);
        const k2 = f(y + h * ((1 / 5) * k1));
        const k3 = f(y + h * ((3 / 40) * k1 + (9 / 40) * k2));
        const k4 = f(y + h * ((3 / 10) * k1 - (9 / 10) * k2 + (6 / 5) * k3));
        const k5 = f(y + h * (-(11 / 54) * k1 + (5 / 2) * k2 - (70 / 27) * k3 + (35 / 27) * k4));
        const k6 = f(y + h * ((1631 / 55296) * k1 + (175 / 512) * k2 + (575 / 13824) * k3 + (44275 / 110592) * k4 + (253 / 4096) * k5));
        const yHigh = y + h * ((37 / 378) * k1 + (250 / 621) * k3 + (125 / 594) * k4 + (512 / 1771) * k6);
        const yLow = y + h * ((2825 / 27648) * k1 + (18575 / 48384) * k3 + (13525 / 55296) * k4 + (277 / 14336) * k5 + (1 / 4) * k6);
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
            "Six slope samples are combined twice: once to cancel error terms through order five for the accepted value, and once through order four for an error signal. Because the coefficients are public, a solver can estimate its own accuracy without a second integration. The table here is the Cash-Karp choice, which trades a slightly different stability region for the same fifth-order accuracy.",
        invariants: [
            "The accepted and embedded estimates share the same six stage derivatives.",
            "For the linear model the fifth-order result matches the exponential series through the fifth power of the step.",
            "The embedded error estimate is nonnegative and decreases with the step size.",
        ],
        correctness:
            "The Cash-Karp coefficients satisfy the Runge-Kutta order conditions through order five for the accepted weights and order four for the embedded weights. On y' equals lambda y the local truncation error is proportional to h to the sixth, so the accumulated global error over a fixed interval is O(h to the fifth). The test compares against the closed-form exponential solution exp(lambda t).",
        complexityRationale:
            "Each step uses six derivative evaluations and a constant number of combinations, so the time cost is O(steps) with O(1) working memory; the frames retain an O(steps) trajectory for replay.",
        uses: [
            "Embedded error control in general-purpose ODE integrators",
            "Non-stiff simulation in engineering and physical sciences",
            "A teaching counterpoint to the Dormand-Prince coefficient table",
        ],
        references: [
            "Cash and Karp, A Variable Order Runge-Kutta Method, 1990",
            "Press et al., Numerical Recipes in C, Second Edition, Chapter 16",
        ],
        workedExample:
            "With y(0)=1, lambda=1 and one step of size 0.1, the fifth-order value is about 1.105170918, close to exp(0.1)=1.105170186. The embedded fourth-order value differs by roughly one part in a million, which is the error signal a step controller would use.",
    },
    id: "cash-karp-method",
    name: "Cash-Karp 5(4) Method",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { lambda: 1, y0: 1, h: 0.1, steps: 10 },
    visualType: "array",
    run,
    pseudocode: [
        "read the step size, rate, initial value, and step count",
        "set the current value to the initial value",
        "evaluate the six stage slopes with the Cash-Karp tableau",
        "form the fifth-order accepted solution",
        "form the fourth-order embedded solution from the same slopes",
        "take the absolute difference as the local error estimate",
        "advance the current value to the fifth-order result",
        "repeat until all steps are complete",
        "done: report the trajectory and global error",
    ],
};

export default module;
