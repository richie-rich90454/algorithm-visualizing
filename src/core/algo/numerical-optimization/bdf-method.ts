/**
 * bdf-method.ts - Backward Differentiation Formula (BDF2) for ODEs
 *
 * BDF methods are implicit linear multistep solvers for ordinary differential
 * equations. BDF2 uses the two most recent solution values and one derivative
 * to advance the solution:
 *
 *     y_{n+2} - (4/3) y_{n+1} + (1/3) y_n = (2/3) h f(t_{n+2}, y_{n+2})
 *
 * The first step uses backward Euler because no earlier history exists. For the
 * linear test equation y' = lambda y the implicit solve is a single division,
 * keeping the demo exact and stable for stiff decay.
 *
 * Limits of the demo: the equation is y' = lambda y with constant lambda, the
 * step size is fixed, and the starting value is y(0) = 1. The companion test
 * checks the result against the exact exponential solution.
 *
 * Time: O(steps). Space: O(steps) for the recorded trajectory.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `y${index}=${value.toFixed(5)}`,
        value,
        state: index === active ? ("active" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { lambda?: number; h?: number; steps?: number; y0?: number }
        | null
    ) ?? {};
    const lambda = Number(task.lambda ?? -1);
    const h = Math.max(1e-6, Number(task.h ?? 0.1));
    const steps = Math.max(1, Math.floor(Number(task.steps ?? 20)) || 20);
    const y0 = Number(task.y0 ?? 1);
    const derivative = (y: number) => lambda * y;
    const ys: number[] = [y0];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(ys, 0),
        edges: [],
        description: `Solve y' = ${lambda} y with BDF2 from t=0, y=${y0}, step h=${h}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lambda, h, steps, y0, t: 0, y: y0, exact: y0 },
    };
    step += 1;

    // Backward Euler starter: y1 = y0 + h lambda y1  =>  y1 = y0 / (1 - h lambda).
    const denomStart = 1 - h * lambda;
    let y1 = denomStart !== 0 ? y0 / denomStart : y0;
    ys.push(y1);
    let t = h;
    let exact = y0 * Math.exp(lambda * t);
    yield {
        stepNumber: step,
        entities: makeBars(ys, 1),
        edges: [],
        description: `Backward Euler starter at t=${t.toFixed(4)} gives y=${y1.toFixed(6)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { t, y: y1, exact, error: Math.abs(y1 - exact), method: "backward-euler" },
    };
    step += 1;

    for (let n = 0; n < steps - 1; n += 1) {
        const yN = ys[n] as number;
        const yN1 = ys[n + 1] as number;
        // y_{n+2} (1 - (2/3) h lambda) = (4/3) y_{n+1} - (1/3) y_n
        const denom = 1 - (2 / 3) * h * lambda;
        const yNext = denom !== 0 ? ((4 / 3) * yN1 - (1 / 3) * yN) / denom : yN1;
        ys.push(yNext);
        t = (n + 2) * h;
        exact = y0 * Math.exp(lambda * t);
        yield {
            stepNumber: step,
            entities: makeBars(ys, ys.length - 1),
            edges: [],
            description: `BDF2 step ${n + 1} at t=${t.toFixed(4)}: y=${yNext.toFixed(6)}, exact=${exact.toFixed(6)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: {
                t,
                y: yNext,
                exact,
                error: Math.abs(yNext - exact),
                derivative: derivative(yNext),
                method: "bdf2",
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(ys, -1),
        edges: [],
        description: `Integrated to t=${t.toFixed(4)}; final y=${(ys[ys.length - 1] as number).toFixed(8)} versus exact ${exact.toFixed(8)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            t,
            y: ys[ys.length - 1] as number,
            exact,
            error: Math.abs((ys[ys.length - 1] as number) - exact),
            steps,
            trajectory: ys.slice(),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single-step method uses only the newest value, but BDF2 looks one step further back. It chooses the coefficient that makes the formula differentiate the quadratic through the last three points, then solves implicitly because the derivative at the new point depends on the unknown answer. That extra history buys second-order accuracy and strong stability for stiff problems.",
        invariants: [
            "BDF2 is exact for any polynomial solution of degree at most two.",
            "The method is implicit: the derivative is evaluated at the unknown new time.",
            "For the test equation with negative lambda the update denominator stays positive, so decay remains bounded.",
        ],
        correctness:
            "The coefficients 4/3, -1/3 and 2/3 come from differentiating the quadratic interpolant of y at t_n, t_{n+1} and t_{n+2} evaluated at t_{n+2}. That construction makes the truncation error proportional to h cubed, so the global error is O(h^2). For y' = lambda y the implicit equation is linear and solved exactly, and backward Euler supplies the second starting value with matching accuracy.",
        complexityRationale:
            "Each step evaluates one closed-form update and one exponential for reporting, so the work is O(steps); recording the trajectory for the visualization uses O(steps) space.",
        uses: [
            "Stiff ordinary differential equations in chemical kinetics",
            "Circuit simulation and transient analysis",
            "General-purpose ODE solvers such as CVODE",
        ],
        references: [
            "Hairer and Wanner, Solving Ordinary Differential Equations II: Stiff and Differential-Algebraic Problems",
            "Gear, Numerical Initial Value Problems in Ordinary Differential Equations, 1971",
        ],
        workedExample:
            "With lambda=-1, h=0.1 and y(0)=1, the starter gives y(0.1)=1/1.1 about 0.90909. The first BDF2 step computes (4/3)(0.90909) - (1/3)(1) divided by 1+0.06667, about 0.82645, while the exact value at 0.2 is about 0.81873, showing the small second-order error.",
    },
    id: "bdf-method",
    name: "BDF2 Method",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { lambda: -1, h: 0.1, steps: 20, y0: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "read lambda, step size h, step count and initial value",
        "take one backward Euler step to obtain the second value",
        "for each remaining step",
        "form the BDF2 combination of the two prior values",
        "divide by one minus two thirds h lambda to solve implicitly",
        "advance time and compute the exact exponential for comparison",
        "report the final value and accumulated error",
    ],
};

export default module;
