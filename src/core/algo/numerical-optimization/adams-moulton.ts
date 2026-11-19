/**
 * adams-moulton.ts - Two-Step Adams-Moulton Predictor-Corrector
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adams-Moulton is an implicit linear multistep method for ordinary
 * differential equations. The two-step formula weights the derivative at the
 * next step together with the two previous derivatives, giving a third-order
 * method. Because the next derivative depends on the unknown next value, a
 * predictor step supplies an estimate that is corrected once with the implicit
 * formula. This predictor-corrector form keeps the method explicit in code.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(steps) derivative evaluations
 *   Space: O(steps) for the solution trace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Points plot the numerical solution (t, y) at every step.
 *   - The final frame reports the value at the end of the interval.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

export interface AdamsMoultonResult {
    t: number[];
    y: number[];
}

/** Integrate y' = f(t, y) with the two-step Adams-Moulton predictor-corrector. */
export function adamsMoulton2(
    f: (t: number, y: number) => number,
    y0: number,
    h: number,
    steps: number,
): AdamsMoultonResult {
    const n = Math.max(0, Math.floor(steps));
    const t: number[] = [0];
    const y: number[] = [y0];
    if (n === 0) {
        return { t, y };
    }

    const k1 = f(0, y0);
    const k2 = f(h / 2, y0 + (h / 2) * k1);
    const k3 = f(h / 2, y0 + (h / 2) * k2);
    const k4 = f(h, y0 + h * k3);
    const firstY = y0 + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    t.push(h);
    y.push(firstY);

    let fPrev = f(0, y0);
    let fCurr = f(h, firstY);
    for (let i = 1; i < n; i += 1) {
        const nextT = (i + 1) * h;
        const predictor = (y[i] ?? 0) + (h / 2) * (3 * fCurr - fPrev);
        const fNext = f(nextT, predictor);
        const nextY = (y[i] ?? 0) + (h / 12) * (5 * fNext + 8 * fCurr - fPrev);
        t.push(nextT);
        y.push(nextY);
        fPrev = fCurr;
        fCurr = fNext;
    }
    return { t, y };
}

function makePoints(result: AdamsMoultonResult): VisualEntity[] {
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
    const task = (input as { h?: number; steps?: number; equation?: string } | null) ?? {};
    const h = typeof task.h === "number" && task.h > 0 ? task.h : 0.1;
    const steps = Math.min(60, Math.max(1, Math.floor(Number(task.steps ?? 20)) || 20));
    const useExponential = task.equation !== "linear";
    const f = useExponential ? (_t: number, value: number): number => value : (): number => 1;
    const result = adamsMoulton2(f, 1, h, steps);
    const label = useExponential ? "y' = y, y(0) = 1" : "y' = 1, y(0) = 1";

    yield {
        stepNumber: 0,
        entities: makePoints({ t: [result.t[0] ?? 0], y: [result.y[0] ?? 1] }),
        edges: [],
        description: `Two-step Adams-Moulton on ${label} with step h=${h} for ${steps} step(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { equation: label, h, steps, step: 0, t: result.t[0] ?? 0, y: result.y[0] ?? 1 },
    };

    for (let i = 1; i < result.t.length; i += 1) {
        yield {
            stepNumber: i,
            entities: makePoints({ t: result.t.slice(0, i + 1), y: result.y.slice(0, i + 1) }),
            edges: [],
            description: `Step ${i}: at t=${(result.t[i] ?? 0).toFixed(3)} the predictor-corrector gives y=${(result.y[i] ?? 0).toFixed(8)}.`,
            codeLineNumber: i === 1 ? 1 : 4,
            layout: "point",
            meta: { equation: label, h, steps, step: i, t: result.t[i] ?? 0, y: result.y[i] ?? 0 },
        };
    }

    const finalT = result.t[result.t.length - 1] ?? 0;
    const finalY = result.y[result.y.length - 1] ?? 1;
    yield {
        stepNumber: result.t.length,
        entities: makePoints(result),
        edges: [],
        description: `Finished at t=${finalT.toFixed(3)} with y=${finalY.toFixed(8)}; the method is third order accurate.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { equation: label, h, steps, step: steps, t: finalT, y: finalY },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Adams methods reuse derivative values from previous steps instead of throwing them away. Adams-Moulton looks forward: its two-step formula combines the derivative at the new point with the two most recent ones, which makes it more accurate than an explicit method of the same cost. Since the new derivative depends on the unknown answer, we predict the answer with an explicit step and then correct it once with the implicit formula.",
        invariants: [
            "The corrector weights the new derivative with five, the current with eight, and the previous with minus one, all over twelve.",
            "The predictor supplies a starting estimate for the derivative at the new step.",
            "For y' equal to a constant the method reproduces a straight line exactly.",
        ],
        correctness:
            "The weights of the two-step Adams-Moulton formula come from integrating the quadratic interpolant of three derivative values, which makes the local truncation error proportional to h to the fourth power and the global order three. The predictor-corrector evaluates the implicit formula with a predicted derivative, retaining third-order accuracy for smooth problems. Tests verify the method reproduces the exact linear solution for y'=1 and matches the exponential e to t for y'=y to within the expected third-order error, and that halving the step reduces the error sharply.",
        complexityRationale:
            "Each step evaluates the derivative once for the predictor's f value and once for the corrector, so time is O(steps). Storing the time and solution arrays uses O(steps) space.",
        uses: [
            "Solving ordinary differential equations in science and engineering",
            "Non-stiff problems where reusing past derivative evaluations is cheap",
            "Comparisons of explicit versus implicit multistep accuracy",
        ],
        references: [
            "Hairer, Norsett and Wanner, Solving Ordinary Differential Equations I, 1993",
            "Butcher, Numerical Methods for Ordinary Differential Equations, 2016",
        ],
        workedExample:
            "For y'=y with y(0)=1 and h=0.1, a fourth-order Runge-Kutta step seeds y(0.1) accurately. The predictor estimates the next value from derivatives at 0 and 0.1, and the corrector combines the predicted derivative with the two stored ones using weights 5, 8, and minus 1 over 12. After twenty steps the value is close to e to the 2 with error on the order of h cubed.",
    },
    id: "adams-moulton",
    name: "Two-Step Adams-Moulton",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { h: 0.1, steps: 20, equation: "exponential" },
    visualType: "point",
    run,
    pseudocode: [
        "choose a step size and number of steps",
        "seed the second point with a fourth-order Runge-Kutta step",
        "store the derivatives at the first two points",
        "predict the next value with the explicit two-step formula",
        "evaluate the derivative at the predicted point",
        "correct using the weighted implicit Adams-Moulton formula",
        "advance the stored derivatives and repeat",
        "done: report the solution trace",
    ],
};

export default module;
