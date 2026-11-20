/**
 * bundle-method.ts - Bundle Method for Nonsmooth Convex Minimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A subgradient step can overshoot badly at a kink because a single supporting
 * line says little about the function far away. The bundle method keeps a
 * collection of past (point, value, subgradient) triples and builds a piecewise
 * linear lower model of the objective from all of them. A trial point minimizes
 * that model plus a quadratic term that keeps it near the current center. If
 * the trial gives a real decrease it becomes the new center (a serious step);
 * otherwise it is only added to the model (a null step) to sharpen the local
 * picture. The demo minimizes a one-dimensional maximum of three lines.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k^3) per master solve for a bundle of k cutting planes
 *   Space: O(k) for the stored bundle
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar represents a stored cutting plane, labeled with its value.
 *   - The newest bundle entry is yellow, older ones are green.
 *   - The meta reports the center, trial point, step type, and best value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BundleInput {
    start?: number;
    iterations?: number;
    proximity?: number;
}

interface Piece {
    slope: number;
    intercept: number;
}

interface Cut {
    x: number;
    value: number;
    gradient: number;
}

const PIECES: Piece[] = [
    { slope: 2, intercept: -2 },
    { slope: -1, intercept: 1 },
    { slope: 0.5, intercept: -0.5 },
];

function evalFunction(x: number): { value: number; gradient: number } {
    let best = { value: PIECES[0]!.slope * x + PIECES[0]!.intercept, gradient: PIECES[0]!.slope };
    for (const piece of PIECES) {
        const value = piece.slope * x + piece.intercept;
        if (value > best.value) best = { value, gradient: piece.slope };
    }
    return best;
}

/** Lower model from the bundle: max of all stored cutting planes. */
function model(bundle: Cut[], x: number): number {
    let value = -Infinity;
    for (const cut of bundle) {
        value = Math.max(value, cut.value + cut.gradient * (x - cut.x));
    }
    return value;
}

/** Solve the proximal master by checking kinks and zero-derivative points. */
function master(bundle: Cut[], center: number, proximity: number): number {
    const candidates: number[] = [center];
    for (const cut of bundle) {
        candidates.push(center - proximity * cut.gradient);
    }
    for (let i = 0; i < bundle.length; i += 1) {
        for (let j = i + 1; j < bundle.length; j += 1) {
            const a = bundle[i]!;
            const b = bundle[j]!;
            if (Math.abs(a.gradient - b.gradient) < 1e-12) continue;
            const x = (b.value - b.gradient * b.x - a.value + a.gradient * a.x) / (a.gradient - b.gradient);
            if (Number.isFinite(x)) candidates.push(Math.max(-50, Math.min(50, x)));
        }
    }
    let bestX = center;
    let bestValue = Infinity;
    for (const x of candidates) {
        const clipped = Math.max(-50, Math.min(50, x));
        const value = model(bundle, clipped) + (clipped - center) ** 2 / (2 * proximity);
        if (value < bestValue) {
            bestValue = value;
            bestX = clipped;
        }
    }
    return bestX;
}

function makeBars(bundle: Cut[]): VisualEntity[] {
    return bundle.map((cut, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `cut${index}: ${cut.value.toFixed(2)}`,
        value: cut.value,
        state: (index === bundle.length - 1 ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, x: cut.x, gradient: cut.gradient },
    }));
}

/** The bundle method generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BundleInput | null) ?? {};
    const start = typeof task.start === "number" ? task.start : 4;
    const iterations = typeof task.iterations === "number" && task.iterations >= 1 ? Math.floor(task.iterations) : 30;
    const proximity = typeof task.proximity === "number" && task.proximity > 0 ? task.proximity : 1;
    let center = start;
    let centerValue = evalFunction(center).value;
    let bundle: Cut[] = [{ x: center, value: centerValue, gradient: evalFunction(center).gradient }];
    let best = centerValue;
    let step = 0;

    const meta = (iteration: number, trial: number, stepType: string, done: boolean) => ({
        center,
        fCenter: centerValue,
        trial,
        fTrial: evalFunction(trial).value,
        bundleSize: bundle.length,
        stepType,
        iteration,
        best,
        proximity,
        done,
    });

    yield {
        stepNumber: step++,
        entities: makeBars(bundle),
        edges: [],
        description: `Minimizing max(2x-2, -x+1, 0.5x-0.5) from x = ${start} with proximity ${proximity}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, center, "start", false),
    };

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const trial = master(bundle, center, proximity);
        const evaluation = evalFunction(trial);
        const serious = evaluation.value < centerValue - 1e-4;
        if (serious) {
            center = trial;
            centerValue = evaluation.value;
            bundle = [{ x: center, value: centerValue, gradient: evaluation.gradient }];
        } else {
            bundle.push({ x: trial, value: evaluation.value, gradient: evaluation.gradient });
        }
        best = Math.min(best, evaluation.value);
        yield {
            stepNumber: step++,
            entities: makeBars(bundle),
            edges: [],
            description: `Iteration ${iteration + 1}: trial ${trial.toFixed(4)} produced a ${serious ? "serious" : "null"} step; best ${best.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: meta(iteration + 1, trial, serious ? "serious" : "null", false),
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(bundle),
        edges: [],
        description: `After ${iterations} steps the best objective is ${best.toFixed(6)} at x = ${center.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: meta(iterations, center, "done", true),
    };
}

/** The bundle method module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A single subgradient only tells you which way is downhill right here, so plain subgradient steps can zigzag. The bundle method remembers many past supporting lines and stacks them into a lower model of the whole function. Each trial point balances that model against a penalty for drifting too far from the current best point. When a trial really improves the objective it becomes the new center; when it does not, it still teaches the model where the function bends.",
        invariants: [
            "Every stored cutting plane lies below the convex objective everywhere.",
            "The model is the pointwise maximum of the stored planes, so it never exceeds the objective.",
            "A serious step strictly decreases the center value.",
            "A null step leaves the center unchanged and only enlarges the model.",
        ],
        correctness:
            "For a convex function, each affine cut f(x_i) + g_i (x - x_i) is a global underestimator by the subgradient inequality, so their maximum is a lower model. The proximal master is a convex piecewise-linear plus strictly convex quadratic problem; checking all kink points and all points where a piece's slope cancels the quadratic derivative finds its exact minimizer. A serious step is accepted only when the true objective decreases, so the center value is monotonically improving. As the bundle grows, the model converges to the epi-graph of f near the optimum and the method converges to a minimizer.",
        complexityRationale:
            "The master examines O(k^2) line intersections plus k stationary points and evaluates the O(k)-piece model at each, giving O(k^3) work per step in a direct implementation. Storing the bundle uses O(k) space.",
        uses: [
            "Nonsmooth convex optimization in operations research",
            "Minimizing maximum-of-affine penalties such as Chebyshev fits",
            "Lagrangian relaxation where only subgradients are available",
        ],
        references: [
            "Lemarechal, Nemirovskii, and Nesterov, New Variants of the Bundle Method, 1995",
            "Kiwiel, Methods of Descent for Nondifferentiable Optimization, 1985",
        ],
        workedExample:
            "Start at x = 4 where f = 6 from the line 2x - 2, giving slope 2. The proximal trial moves left toward x = 2, where f = 2 and a serious step is taken. A second trial near x = 1 gives f = 0 and another serious step. Further trials no longer improve the value, so they become null steps that refine the model around the minimizer x = 1.",
    },
    id: "bundle-method",
    name: "Bundle Method for Nonsmooth Optimization",
    category: "numerical-optimization",
    complexity: { time: "O(k^3) per step", space: "O(k)" },
    defaultInput: { start: 4, iterations: 30, proximity: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "start from a center and store its value and one subgradient",
        "build a lower model as the maximum of stored cutting planes",
        "minimize the model plus a quadratic proximity term for a trial",
        "evaluate the true objective at the trial point",
        "if the objective drops, move the center and reset the bundle",
        "otherwise add the trial as a cut and keep the center",
        "track the best objective seen",
        "done: report the best point and objective",
    ],
};

export default module;
