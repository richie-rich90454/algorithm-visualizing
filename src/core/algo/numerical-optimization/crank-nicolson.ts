/**
 * crank-nicolson.ts - Crank-Nicolson Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Crank-Nicolson averages the derivative at the start and end of a step,
 * placing it halfway between explicit and implicit Euler. The result is a
 * second-order, A-stable method widely used for diffusion equations and other
 * time-dependent partial differential equations. As with any implicit method,
 * the future derivative depends on the unknown value, so a Newton solve
 * handles each step.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(steps * innerIterations) derivative evaluations
 *   Space: O(steps) for the solution trace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Points plot the numerical solution (t, y) at every step.
 *   - The final frame reports the end value and the exact reference.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

export interface CrankNicolsonResult {
    t: number[];
    y: number[];
}

/** Integrate y' = f(t, y) with the trapezoidal Crank-Nicolson rule. */
export function crankNicolson(
    f: (t: number, y: number) => number,
    y0: number,
    h: number,
    steps: number,
    tolerance = 1e-12,
    maxIterations = 100,
): CrankNicolsonResult {
    const n = Math.max(0, Math.floor(steps));
    const t: number[] = [0];
    const y: number[] = [y0];
    for (let i = 0; i < n; i += 1) {
        const currentT = i * h;
        const nextT = (i + 1) * h;
        const current = y[i] ?? 0;
        const startSlope = f(currentT, current);
        let guess = current;
        for (let k = 0; k < maxIterations; k += 1) {
            const eps = 1e-6 * Math.max(1, Math.abs(guess));
            const slope = (f(nextT, guess + eps) - f(nextT, guess)) / eps;
            const derivative = 1 - (h / 2) * slope;
            if (Math.abs(derivative) < 1e-14) {
                break;
            }
            const residual = guess - current - (h / 2) * (startSlope + f(nextT, guess));
            const next = guess - residual / derivative;
            if (!Number.isFinite(next) || Math.abs(next - guess) < tolerance) {
                guess = Number.isFinite(next) ? next : guess;
                break;
            }
            guess = next;
        }
        t.push(nextT);
        y.push(guess);
    }
    return { t, y };
}

function makePoints(result: CrankNicolsonResult): VisualEntity[] {
    return result.t.map((time, index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: `(${time.toFixed(2)}, ${(result.y[index] ?? 0).toFixed(4)})`,
        value: result.y[index] ?? 0,
        state: (index === result.t.length - 1 ? "sorted" : "idle") as "sorted" | "idle",
        x: time,
        y: result.y[index] ?? 0,
        width: 0,
        height: 0,
        metadata: { time, value: result.y[index] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { h?: number; steps?: number; lambda?: number; tolerance?: number } | null) ?? {};
    const h = typeof task.h === "number" && task.h > 0 ? task.h : 0.05;
    const steps = Math.min(60, Math.max(1, Math.floor(Number(task.steps ?? 20)) || 20));
    const lambda = typeof task.lambda === "number" ? task.lambda : -10;
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-12;
    const f = (_t: number, value: number): number => lambda * value;
    const result = crankNicolson(f, 1, h, steps, tolerance);

    yield {
        stepNumber: 0,
        entities: makePoints({ t: [result.t[0] ?? 0], y: [result.y[0] ?? 1] }),
        edges: [],
        description: `Crank-Nicolson on y' = ${lambda} y with y(0)=1, step h=${h}, for ${steps} step(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { lambda, h, steps, step: 0, t: result.t[0] ?? 0, y: result.y[0] ?? 1 },
    };

    for (let i = 1; i < result.t.length; i += 1) {
        yield {
            stepNumber: i,
            entities: makePoints({ t: result.t.slice(0, i + 1), y: result.y.slice(0, i + 1) }),
            edges: [],
            description: `Step ${i}: average the endpoint slopes at t=${(result.t[i] ?? 0).toFixed(3)}; y=${(result.y[i] ?? 0).toExponential(5)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { lambda, h, steps, step: i, t: result.t[i] ?? 0, y: result.y[i] ?? 0 },
        };
    }

    const finalT = result.t[result.t.length - 1] ?? 0;
    const finalY = result.y[result.y.length - 1] ?? 1;
    const exact = Math.exp(lambda * finalT);
    yield {
        stepNumber: result.t.length,
        entities: makePoints(result),
        edges: [],
        description: `Finished at t=${finalT.toFixed(3)} with y=${finalY.toExponential(6)}; exact value ${exact.toExponential(6)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { lambda, h, steps, step: steps, t: finalT, y: finalY, exact },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Crank-Nicolson splits the difference between explicit and implicit Euler: it uses the average of the slope at the start and end of a step. That symmetric choice cancels the leading error term, giving a second-order method, while keeping the strong stability of an implicit scheme. It is the workhorse for diffusion and heat equations where stability matters more than raw speed per step.",
        invariants: [
            "Each step averages the derivative at the current and next points, weighted equally.",
            "A Newton step uses a finite-difference derivative and repeats until the step change is below tolerance.",
            "For a linear problem the amplification factor is one plus h lambda over two divided by one minus h lambda over two.",
        ],
        correctness:
            "The trapezoidal rule integrates the derivative with error proportional to h cubed locally, so the global order is two. For y' equals lambda y the method gives amplification factor (1 plus h lambda over 2) over (1 minus h lambda over 2), whose magnitude never exceeds one for negative lambda, proving A-stability. Tests check every step against that closed-form factor, confirm the second order by showing error drops by about four when the step halves, and verify the exact exponential reference.",
        complexityRationale:
            "Each step evaluates the derivative at the current point once and repeats a fixed number of evaluations in the future-value Newton loop, so time is O(steps times inner iterations). The trace stores one value per step, giving O(steps) space.",
        uses: [
            "Heat, diffusion, and Schrodinger equation time stepping",
            "Computational finance for parabolic partial differential equations",
            "Stable implicit integration for moderately stiff systems",
        ],
        references: [
            "Crank and Nicolson, A Practical Method for Numerical Evaluation of Solutions of Partial Differential Equations of the Heat-Conduction Type, 1947",
            "Hairer and Wanner, Solving Ordinary Differential Equations II, 1996",
        ],
        workedExample:
            "For y'=-10y with y(0)=1 and h=0.05, the amplification factor is (1-0.25)/(1+0.25)=0.6. After twenty steps the value is about 0.6 to the twentieth power, which tracks the exact e to the minus ten far better than first-order implicit Euler and remains stable.",
    },
    id: "crank-nicolson",
    name: "Crank-Nicolson Method",
    category: "numerical-optimization",
    complexity: { time: "O(steps * inner)", space: "O(steps)" },
    defaultInput: { h: 0.05, steps: 20, lambda: -10, tolerance: 1e-12 },
    visualType: "point",
    run,
    pseudocode: [
        "choose a step size, step count, and inner tolerance",
        "evaluate the derivative at the current point",
        "guess the future value from the current one",
        "average the current and future derivatives over the step",
        "repeat the Newton update until the step change is below tolerance",
        "store the converged value and advance time",
        "done: report the solution trace and final value",
    ],
};

export default module;
