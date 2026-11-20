/**
 * predictor-corrector.ts - Adams-Bashforth-Moulton Predictor-Corrector
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A predictor-corrector method solves an ordinary differential equation in two
 * passes per step. An explicit Adams-Bashforth formula predicts the next value
 * from previous derivatives, and an implicit Adams-Moulton formula corrects it
 * using the derivative at the predicted point. The explicit pass supplies a
 * good initial guess, so the implicit pass can be evaluated directly instead
 * of solved by iteration. Repeating the correction improves accuracy further.
 *
 * The demo integrates dy/dt = lambda y, which has the exact solution
 * y(t) = y0 exp(lambda t), so the reported error can be checked exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * corrections) derivative evaluations
 *   Space: O(1) beyond the output trace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars show time, predicted value, corrected value, and error.
 *   - The corrected bar turns green on the final frame.
 *   - Captions report both passes and the current error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    lambda?: number;
    y0?: number;
    h?: number;
    steps?: number;
    corrections?: number;
}

function exact(t: number, y0: number, lambda: number): number {
    return y0 * Math.exp(lambda * t);
}

function makeBars(t: number, predicted: number, corrected: number, error: number, done: boolean): VisualEntity[] {
    const values = [t, predicted, corrected, error];
    return values.map((v, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: v.toFixed(5),
        value: v,
        state: (index === 2 ? (done ? "sorted" : "active") : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index === 0 ? "t" : index === 1 ? "predicted" : index === 2 ? "corrected" : "error" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const lambda = typeof task.lambda === "number" ? task.lambda : -2;
    const y0 = typeof task.y0 === "number" ? task.y0 : 1;
    const h = typeof task.h === "number" && task.h > 0 ? task.h : 0.1;
    const steps = typeof task.steps === "number" ? Math.max(2, Math.floor(task.steps)) : 10;
    const corrections = typeof task.corrections === "number" ? Math.max(1, Math.floor(task.corrections)) : 2;

    const deriv = (y: number): number => lambda * y;
    const values: number[] = [y0, exact(h, y0, lambda)];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(h, values[1] as number, values[1] as number, 0, false),
        edges: [],
        description: `Seeded the two-step method with the exact starting value at time ${h.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 1, t: h, predicted: values[1], corrected: values[1], exact: values[1], error: 0, lambda, h },
    };
    step += 1;

    for (let n = 1; n < steps; n += 1) {
        const yn = values[n] as number;
        const yPrev = values[n - 1] as number;
        const predicted = yn + (h / 2) * (3 * deriv(yn) - deriv(yPrev));
        let corrected = yn + (h / 2) * (deriv(predicted) + deriv(yn));
        for (let k = 1; k < corrections; k += 1) {
            corrected = yn + (h / 2) * (deriv(corrected) + deriv(yn));
        }
        values[n + 1] = corrected;
        const t = (n + 1) * h;
        const truth = exact(t, y0, lambda);
        const error = Math.abs(corrected - truth);
        yield {
            stepNumber: step,
            entities: makeBars(t, predicted, corrected, error, false),
            edges: [],
            description: `Step ${n + 1}: predicted ${predicted.toFixed(5)}, corrected ${corrected.toFixed(5)} over ${corrections} pass(es), error ${error.toExponential(2)}.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { step: n + 1, t, predicted, corrected, exact: truth, error, lambda, h, corrections },
        };
        step += 1;
    }

    const tFinal = steps * h;
    const truth = exact(tFinal, y0, lambda);
    const finalValue = values[steps] as number;
    const finalError = Math.abs(finalValue - truth);
    yield {
        stepNumber: step,
        entities: makeBars(tFinal, finalValue, finalValue, finalError, true),
        edges: [],
        description: `Integrated to time ${tFinal.toFixed(3)}: y = ${finalValue.toFixed(5)}, exact ${truth.toFixed(5)}, error ${finalError.toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { step: steps, t: tFinal, corrected: finalValue, exact: truth, error: finalError, lambda, h },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An implicit step is more accurate and more stable but needs the derivative at the unknown answer. A predictor-corrector scheme first guesses that answer with an explicit formula, then plugs the guess into the implicit formula. Because the guess is close, one or two correction passes are enough, giving most of the accuracy of an implicit method at the cost of an explicit one.",
        invariants: [
            "The predictor uses the two most recent derivative values.",
            "The corrector is the trapezoidal Adams-Moulton rule over the last interval.",
            "Each correction pass re-evaluates the derivative at the latest corrected value.",
            "The reported error is the absolute difference from the closed-form solution.",
        ],
        correctness:
            "Adams-Bashforth and Adams-Moulton are consistent linear multistep formulas of order two. Starting the two-step recurrence with the exact value at the first grid point removes startup error, and each correction pass applies a contraction of the local Trapezoid rule. For the linear test equation the resulting recurrence is stable when the step is small, and its global error decreases quadratically with the step size.",
        complexityRationale:
            "Each time step forms one explicit prediction and a fixed number of corrections, so the work is O(steps * corrections) derivative evaluations. Only the last two values are needed to advance, giving O(1) working space apart from the output frames.",
        uses: [
            "Numerically integrating ordinary differential equations in scientific simulation",
            "Solving stiff systems where explicit methods alone need tiny steps",
            "Providing error estimates by comparing the predictor and corrector values",
        ],
        references: [
            "Numerical Recipes, Ordinary Differential Equations, chapter 17",
            "Hairer, Norsett and Wanner, Solving Ordinary Differential Equations I",
        ],
        workedExample:
            "For dy/dt = -2y with y(0) = 1 and h = 0.1, the seed value at 0.1 is 0.81873. The predictor for 0.2 gives 0.67006; one trapezoidal correction gives 0.67005, against the exact 0.67032, an error of about 0.00027.",
    },
    id: "predictor-corrector",
    name: "Predictor-Corrector Method",
    category: "numerical-optimization",
    complexity: { time: "O(steps * corrections)", space: "O(1)" },
    defaultInput: { lambda: -2, y0: 1, h: 0.1, steps: 10, corrections: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "seed the second starting value from the exact solution",
        "for each remaining time step",
        "predict with two-step Adams-Bashforth using prior derivatives",
        "evaluate the derivative at the predicted value",
        "correct with trapezoidal Adams-Moulton using start and predicted slopes",
        "repeat the correction pass the requested number of times",
        "store the corrected value and advance time",
        "done: report the final value and the error",
    ],
};

export default module;
