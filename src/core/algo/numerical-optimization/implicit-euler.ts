/**
 * implicit-euler.ts - Implicit (Backward) Euler Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Implicit Euler advances an ordinary differential equation using the
 * derivative at the end of the step instead of the beginning. That choice
 * makes the method A-stable, so it remains well behaved on stiff equations
 * where explicit methods blow up unless the step is tiny. The unknown future
 * value appears on both sides of the update, so each step solves a small fixed
 * point problem by iteration.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(steps * innerIterations) derivative evaluations
 *   Space: O(steps) for the solution trace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Points plot the numerical solution (t, y) at every step.
 *   - The final frame reports the end value and stability verdict.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

export interface ImplicitEulerResult {
    t: number[];
    y: number[];
}

/** Integrate y' = f(t, y) with implicit Euler using a Newton solve per step. */
export function implicitEuler(
    f: (t: number, y: number) => number,
    y0: number,
    h: number,
    steps: number,
    tolerance = 1e-12,
    maxIterations = 100,
): ImplicitEulerResult {
    const n = Math.max(0, Math.floor(steps));
    const t: number[] = [0];
    const y: number[] = [y0];
    for (let i = 0; i < n; i += 1) {
        const nextT = (i + 1) * h;
        const current = y[i] ?? 0;
        let guess = current;
        for (let k = 0; k < maxIterations; k += 1) {
            const eps = 1e-6 * Math.max(1, Math.abs(guess));
            const slope = (f(nextT, guess + eps) - f(nextT, guess)) / eps;
            const derivative = 1 - h * slope;
            if (Math.abs(derivative) < 1e-14) {
                break;
            }
            const residual = guess - current - h * f(nextT, guess);
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

function makePoints(result: ImplicitEulerResult): VisualEntity[] {
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
    const result = implicitEuler(f, 1, h, steps, tolerance);

    yield {
        stepNumber: 0,
        entities: makePoints({ t: [result.t[0] ?? 0], y: [result.y[0] ?? 1] }),
        edges: [],
        description: `Implicit Euler on y' = ${lambda} y with y(0)=1, step h=${h}, for ${steps} step(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { lambda, h, steps, step: 0, t: result.t[0] ?? 0, y: result.y[0] ?? 1 },
    };

    for (let i = 1; i < result.t.length; i += 1) {
        yield {
            stepNumber: i,
            entities: makePoints({ t: result.t.slice(0, i + 1), y: result.y.slice(0, i + 1) }),
            edges: [],
            description: `Step ${i}: solve the implicit equation at t=${(result.t[i] ?? 0).toFixed(3)}; y=${(result.y[i] ?? 0).toExponential(5)}.`,
            codeLineNumber: 2,
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
        codeLineNumber: 4,
        layout: "point",
        meta: { lambda, h, steps, step: steps, t: finalT, y: finalY, exact },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Explicit Euler uses the slope at the start of a step, which overshoots wildly when the solution changes quickly. Implicit Euler instead uses the slope at the end of the step. To find that slope you must know the answer you are looking for, so each step solves a small equation by repeatedly guessing the future value until the equation balances. That extra work buys excellent stability.",
        invariants: [
            "Each step solves y next equals y current plus h times f at the new time and new value.",
            "A Newton step uses a finite-difference derivative and repeats until the step change is below tolerance.",
            "For a linear decay problem the update factor is one over one minus h times lambda.",
        ],
        correctness:
            "Implicit Euler has local truncation error proportional to h squared and is first-order accurate globally. For y' equals lambda y the implicit equation solves exactly to y next equals y current over one minus h lambda, a factor below one in magnitude for negative lambda regardless of step size, which is why the method is A-stable and cannot blow up on a decaying problem. Tests compare every step against that closed-form factor and against the exact exponential, and check stability for a stiff lambda.",
        complexityRationale:
            "Each step evaluates the derivative a fixed number of times inside the Newton loop, so time is O(steps times inner iterations). The method keeps one time and one solution value per step, giving O(steps) space.",
        uses: [
            "Stiff ordinary differential equations in chemical kinetics and circuit simulation",
            "Stable time stepping in computational fluid dynamics and heat transfer",
            "Baseline implicit solver in scientific computing libraries",
        ],
        references: [
            "Butcher, Numerical Methods for Ordinary Differential Equations, 2016",
            "Hairer and Wanner, Solving Ordinary Differential Equations II: Stiff Problems, 1996",
        ],
        workedExample:
            "For y'=-10y with y(0)=1 and h=0.05, the implicit equation is y next equals y current plus 0.05 times minus ten y next. Solving gives y next equals y current divided by 1.5. After twenty steps the value is about 0.0003, close to the exact e to the minus ten and never unstable even though the step is large relative to the decay rate.",
    },
    id: "implicit-euler",
    name: "Implicit Euler Method",
    category: "numerical-optimization",
    complexity: { time: "O(steps * inner)", space: "O(steps)" },
    defaultInput: { h: 0.05, steps: 20, lambda: -10, tolerance: 1e-12 },
    visualType: "point",
    run,
    pseudocode: [
        "choose a step size, step count, and inner tolerance",
        "for each step form the unknown future value",
        "guess the future value from the current one",
        "update the guess using the derivative at the future time",
        "repeat the Newton update until the step change is below tolerance",
        "store the converged value and advance time",
        "done: report the solution trace and final value",
    ],
};

export default module;
