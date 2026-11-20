/**
 * uni-pc.ts - UniPC Multistep Predictor-Corrector Sampler
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * UniPC is a unified predictor-corrector family for fast diffusion sampling.
 * The predictor extrapolates the next state from several past model outputs,
 * and the corrector refines it using the model output at the predicted point.
 * This teaching core implements the second-order multistep predictor and
 * corrector (Adams-Bashforth plus Adams-Moulton) that underlies the framework.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d) for steps and width d
 *   Space: O(steps * d) for the stored trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the solution, the predictor's guess, and the corrected value
 *     at each step, so the predictor-corrector refinement is visible.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface UniPcInput {
    lambda?: number;
    x0?: number;
    h?: number;
    steps?: number;
}

export interface UniPcStep {
    t: number;
    x: number;
    f: number;
    predicted: number;
    corrected: number;
}

/** Solve dx/dt = lambda*x with a second-order multistep predictor-corrector. */
export function uniPcSolve(lambda: number, x0: number, h: number, steps: number): UniPcStep[] {
    const result: UniPcStep[] = [];
    let xPrev = x0;
    let fPrev = lambda * xPrev;
    result.push({ t: 0, x: x0, f: fPrev, predicted: x0, corrected: x0 });

    for (let n = 0; n < steps; n += 1) {
        let predicted: number;
        let corrected: number;
        if (n === 0) {
            predicted = xPrev + h * fPrev;
            const fPred = lambda * predicted;
            corrected = xPrev + h * 0.5 * (fPrev + fPred);
        } else {
            predicted = xPrev + h * (1.5 * fPrev - 0.5 * (result[n - 1]?.f ?? 0));
            const fPred = lambda * predicted;
            const fOlder = result[n - 1]?.f ?? 0;
            corrected = xPrev + h * ((5 / 12) * fPred + (2 / 3) * fPrev - (1 / 12) * fOlder);
        }
        const x = corrected;
        result.push({ t: (n + 1) * h, x, f: lambda * x, predicted, corrected });
        xPrev = x;
        fPrev = lambda * x;
    }
    return result;
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `v-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value: Number(value.toFixed(10)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as UniPcInput | null) ?? {};
    const lambda = typeof task.lambda === "number" ? task.lambda : -1;
    const x0 = typeof task.x0 === "number" ? task.x0 : 1;
    const h = typeof task.h === "number" ? task.h : 0.1;
    const steps = typeof task.steps === "number" ? Math.max(1, task.steps) : 6;
    const solution = uniPcSolve(lambda, x0, h, steps);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars([x0], ["unvisited"]),
        edges: [],
        description: `Solve dx/dt = lambda*x with lambda ${lambda}, step ${h}, for ${steps} steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lambda, h, trajectory: [x0], predicted: [], corrected: [] },
    };
    step += 1;

    for (let n = 1; n < solution.length; n += 1) {
        const point = solution[n];
        yield {
            stepNumber: step,
            entities: bars([point?.predicted ?? 0, point?.corrected ?? 0], ["comparing", "active"]),
            edges: [],
            description: `Step ${n}: predictor gives ${(point?.predicted ?? 0).toFixed(4)}, corrector refines to ${(point?.corrected ?? 0).toFixed(4)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: {
                lambda, h,
                trajectory: solution.slice(0, n + 1).map((s) => s.x),
                predicted: solution.slice(0, n + 1).map((s) => s.predicted),
                corrected: solution.slice(0, n + 1).map((s) => s.corrected),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(solution.map((s) => s.x), solution.map(() => "sorted")),
        edges: [],
        description: `Done: final value ${(solution[solution.length - 1]?.x ?? 0).toFixed(4)} approximates the exact solution.`,
        codeLineNumber: 2,
        layout: "array",
        meta: {
            lambda, h,
            trajectory: solution.map((s) => s.x),
            predicted: solution.map((s) => s.predicted),
            corrected: solution.map((s) => s.corrected),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "UniPC speeds up diffusion sampling by reusing past model evaluations. A predictor extrapolates where the solution is heading from several previous steps, and a corrector uses one fresh evaluation at that predicted point to fix the estimate. This predictor-corrector pattern reaches good accuracy in far fewer steps than a plain one-step method.",
        invariants: [
            "The predictor uses only derivatives from previous steps.",
            "The corrector evaluates the derivative at the predicted point before refining.",
            "For a fixed step size the second-order method is more accurate than a first-order Euler step.",
        ],
        correctness:
            "The second-order predictor is the Adams-Bashforth formula, exact for polynomials of degree one in the derivative, and the corrector is the Adams-Moulton formula, which is implicit and solved here with one evaluation at the predicted point. For the linear test equation dx/dt equals lambda times x, Taylor expansion shows both formulas have local error proportional to the cube of the step size, giving second-order global convergence. The implementation applies these formulas exactly, so it reproduces their convergence behavior and approaches the analytic exponential solution as the step size shrinks.",
        complexityRationale:
            "Each step evaluates the derivative at the predicted point once and combines a constant number of past derivatives, giving O(steps * d) time. Storing every predicted and corrected value for playback uses O(steps * d) space.",
        uses: [
            "Fast sampling from diffusion and flow-based generative models",
            "Reducing the number of network evaluations in image generation",
            "Accurate numerical integration of learned continuous dynamics",
        ],
        references: [
            "Zhao et al., UniPC: A Unified Predictor-Corrector Framework for Fast Sampling of Diffusion Models, NeurIPS 2023",
            "Hairer, Norsett and Wanner, Solving Ordinary Differential Equations I, Springer",
        ],
        workedExample:
            "For dx/dt = -x from x=1 with step 0.1, the first predictor gives 0.9 and the corrector averages the endpoint slopes to give 0.905. Subsequent steps use the two-point formulas, and after six steps the value is close to exp(-0.6), about 0.5488.",
    },
    id: "uni-pc",
    name: "UniPC Predictor-Corrector Sampler",
    category: "ml-ai",
    complexity: { time: "O(steps d)", space: "O(steps d)" },
    defaultInput: { lambda: -1, x0: 1, h: 0.1, steps: 6 },
    visualType: "array",
    run,
    pseudocode: [
        "read lambda, initial value, step size and step count",
        "take one second-order starting step to seed the history",
        "for each later step predict with the multistep extrapolator",
        "evaluate the derivative at the predicted value",
        "correct with the implicit multistep formula",
        "store the accepted value and continue",
        "done: report the integrated trajectory",
    ],
};

export default module;
