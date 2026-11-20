/**
 * finite-difference-derivative.ts - Finite-Difference Derivatives
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A finite-difference derivative approximates the slope of a function using
 * nearby function values. The forward and backward formulas use one side of
 * the point and have first-order error, while the centered formula cancels
 * the leading error term and is second-order accurate. Richardson extrapolation
 * combines two centered estimates to cancel the next term as well.
 *
 * A fixed set of named demo functions with known analytic derivatives keeps
 * the visualization deterministic and lets the error be measured exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) function evaluations per formula
 *   Space: O(1) for the nearby values and estimates
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show f(x-h), f(x), f(x+h), the current estimate, and the true slope.
 *   - The estimate bar is highlighted; green marks the refined final value.
 *   - meta carries each formula's estimate and its absolute error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type FuncName = "x2" | "sin" | "exp";

interface DemoFunc {
    f: (x: number) => number;
    d: (x: number) => number;
}

const FUNCTIONS: Record<FuncName, DemoFunc> = {
    x2: { f: (x) => x * x, d: (x) => 2 * x },
    sin: { f: (x) => Math.sin(x), d: (x) => Math.cos(x) },
    exp: { f: (x) => Math.exp(x), d: (x) => Math.exp(x) },
};

/** Build the five bars for a frame. */
function makeBars(
    values: number[],
    estimateIndex: number,
    final: boolean,
): VisualEntity[] {
    const labels = ["f(x-h)", "f(x)", "f(x+h)", "estimate", "true slope"];
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (final && index === 3) {
            state = "sorted";
        } else if (index === estimateIndex) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${labels[index]}=${value.toFixed(5)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, role: labels[index] },
        };
    });
}

/** The finite-difference generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { func?: string; x?: number; h?: number; method?: string } | null
    ) ?? {};
    const name: FuncName = (task.func as FuncName) in FUNCTIONS ? (task.func as FuncName) : "x2";
    const demo = FUNCTIONS[name];
    const x = typeof task.x === "number" ? task.x : 1;
    const h = Math.abs(Number(task.h ?? 0.1)) || 0.1;
    const exclude = task.method === "forward" || task.method === "backward" || task.method === "central"
        ? task.method
        : null;

    const fMinus = demo.f(x - h);
    const fAt = demo.f(x);
    const fPlus = demo.f(x + h);
    const analytic = demo.d(x);
    const forward = (fPlus - fAt) / h;
    const backward = (fAt - fMinus) / h;
    const central = (fPlus - fMinus) / (2 * h);
    const half = h / 2;
    const centralHalf = (demo.f(x + half) - demo.f(x - half)) / (2 * half);
    const richardson = (4 * centralHalf - central) / 3;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([fMinus, fAt, fPlus, 0, analytic], 4, false),
        edges: [],
        description: `Estimate the derivative of ${name} at x = ${x} with step h = ${h}; the true slope is ${analytic.toFixed(6)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { func: name, x, h, analytic, estimate: 0, error: Math.abs(analytic) },
    };
    step += 1;

    const formulas: Array<{ name: string; value: number; line: number }> = [
        { name: "forward", value: forward, line: 2 },
        { name: "backward", value: backward, line: 3 },
        { name: "central", value: central, line: 4 },
    ];
    for (const formula of formulas) {
        if (exclude !== null && formula.name !== exclude) {
            continue;
        }
        yield {
            stepNumber: step,
            entities: makeBars([fMinus, fAt, fPlus, formula.value, analytic], 3, false),
            edges: [],
            description: `${formula.name} difference gives ${formula.value.toFixed(6)} with absolute error ${Math.abs(formula.value - analytic).toExponential(2)}.`,
            codeLineNumber: formula.line,
            layout: "array",
            meta: {
                func: name,
                x,
                h,
                method: formula.name,
                analytic,
                estimate: formula.value,
                error: Math.abs(formula.value - analytic),
                forward,
                backward,
                central,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars([fMinus, fAt, fPlus, richardson, analytic], 3, true),
        edges: [],
        description: `Richardson extrapolation of two centered estimates gives ${richardson.toFixed(9)}, error ${Math.abs(richardson - analytic).toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            func: name,
            x,
            h,
            method: "richardson",
            analytic,
            estimate: richardson,
            error: Math.abs(richardson - analytic),
            forward,
            backward,
            central,
            centralHalf,
            richardson,
        },
    };
}

/** The finite-difference derivative module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The derivative is a limit of slopes between nearby points. Approximating that limit with a small but finite step gives a practical estimate. Using points on both sides cancels the largest error term, and combining two such centered estimates at different step sizes cancels the next term too.",
        invariants: [
            "The forward, backward, and central formulas use the same function values.",
            "The centered estimate is the average slope across the point.",
            "Richardson extrapolation combines centered estimates at h and h/2.",
        ],
        correctness:
            "Taylor expansion of f(x + h) gives the forward quotient equal to f'(x) plus h/2 times f''(x) plus higher terms, so its error is first order. The centered quotient cancels the odd terms, leaving an error proportional to h squared. Richardson extrapolation forms (4 times the h/2 estimate minus the h estimate) over three, which cancels the h squared term and leaves fourth-order accuracy for smooth functions.",
        complexityRationale:
            "Each formula evaluates the function at a constant number of nearby points and combines them with a few arithmetic operations, so the time is O(1). Only three function values and the estimates are stored, giving O(1) space.",
        uses: [
            "Numerical gradients in optimization when analytic derivatives are unavailable",
            "Sensitivity analysis in scientific simulation",
            "Finite-element and finite-volume discretization stencils",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, Chapter 4",
            "Press et al., Numerical Recipes, Chapter 5",
        ],
        workedExample:
            "For f(x) = x squared at x = 2 the true slope is 4. With h = 0.1 the forward quotient is 4.1, the backward quotient is 3.9, and the centered quotient is exactly 4 because the function is quadratic. Richardson extrapolation also returns 4.",
    },
    id: "finite-difference-derivative",
    name: "Finite-Difference Derivative",
    category: "numerical-optimization",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { func: "x2", x: 1, h: 0.1, method: "all" },
    visualType: "array",
    run,
    pseudocode: [
        "evaluate the function at x minus h, x, and x plus h",
        "compute the forward difference from x and x plus h",
        "compute the backward difference from x minus h and x",
        "compute the centered difference from the two outer points",
        "repeat the centered difference with half the step",
        "apply Richardson extrapolation to cancel leading error",
        "done: report the estimate and its absolute error",
    ],
};

export default module;
