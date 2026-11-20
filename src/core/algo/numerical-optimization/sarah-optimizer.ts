/**
 * sarah-optimizer.ts - SARAH Stochastic Recursive Gradient
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SARAH is a finite-sum optimizer that reduces gradient variance by recursively
 * updating an estimate of the full gradient. At the start of each epoch it
 * forms the full gradient; within the epoch it updates the estimate using only
 * two component-gradient evaluations at consecutive points. This recursive
 * control variate tracks the true gradient closely and lets SARAH take steady
 * steps toward the minimum of the finite sum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(epochs * (n + inner * 2)) gradient evaluations
 *   Space: O(1) beyond the data and emitted frames
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar shows the current parameter value.
 *   - The recursive gradient estimate and objective appear in metadata.
 *   - The final frame reports the parameter and the analytic optimum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Component = { a: number; b: number };

/** Gradient of component i at x for the quadratic a*x^2/2 - b*x. */
function componentGradient(component: Component, x: number): number {
    return component.a * x - component.b;
}

function buildEntity(x: number, state: EntityState): VisualEntity[] {
    return [
        {
            id: "x",
            type: "bar" as const,
            label: x.toFixed(4),
            value: x,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { variable: "x" },
        },
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        components?: Array<{ a: number; b: number }>;
        start?: number;
        learningRate?: number;
        epochs?: number;
        inner?: number;
    } | null) ?? {};
    const components: Component[] = Array.isArray(task.components)
        ? task.components
        : [
              { a: 2, b: 3 },
              { a: 1, b: 1 },
              { a: 4, b: 6 },
              { a: 3, b: 2 },
          ];
    const n = Math.max(1, components.length);
    const start = typeof task.start === "number" ? task.start : 5;
    const learningRate = typeof task.learningRate === "number" ? task.learningRate : 0.15;
    const epochs = typeof task.epochs === "number" ? Math.max(1, task.epochs) : 30;
    const inner = typeof task.inner === "number" ? Math.max(1, task.inner) : n;

    const sumA = components.reduce((s, c) => s + c.a, 0);
    const sumB = components.reduce((s, c) => s + c.b, 0);
    const optimum = sumB / sumA;
    const objective = (x: number) => components.reduce((s, c) => s + 0.5 * c.a * x * x - c.b * x, 0) / n;
    const fullGradient = (x: number) =>
        components.reduce((s, c) => s + componentGradient(c, x), 0) / n;

    let x = start;
    let step = 0;
    yield {
        stepNumber: step++,
        entities: buildEntity(x, "idle"),
        edges: [],
        description: `Minimizing a ${n}-component finite sum with SARAH from x=${start}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x, optimum, gradient: fullGradient(x), objective: objective(x), phase: "start" },
    };

    for (let epoch = 0; epoch < epochs; epoch += 1) {
        let v = fullGradient(x);
        let xPrev = x;
        x = x - learningRate * v;
        yield {
            stepNumber: step++,
            entities: buildEntity(x, "active"),
            edges: [],
            description: `Epoch ${epoch + 1}: full gradient ${v.toFixed(5)}, moved x to ${x.toFixed(5)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { x, v, optimum, objective: objective(x), epoch: epoch + 1, phase: "full" },
        };

        for (let t = 1; t < inner; t += 1) {
            const index = (t + epoch) % n;
            const component = components[index] as Component;
            v = componentGradient(component, x) - componentGradient(component, xPrev) + v;
            xPrev = x;
            x = x - learningRate * v;
            yield {
                stepNumber: step++,
                entities: buildEntity(x, "active"),
                edges: [],
                description: `Epoch ${epoch + 1}, step ${t}: component ${index} recursive gradient ${v.toFixed(5)}.`,
                codeLineNumber: 5,
                layout: "array",
                meta: { x, v, optimum, objective: objective(x), epoch: epoch + 1, step: t, phase: "recursive" },
            };
        }
    }

    yield {
        stepNumber: step++,
        entities: buildEntity(x, "sorted"),
        edges: [],
        description: `SARAH finished at x=${x.toFixed(6)}; analytic optimum ${optimum.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { x, optimum, error: Math.abs(x - optimum), objective: objective(x), phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Stochastic gradients are cheap but noisy. SARAH keeps a running estimate of the full gradient: at the start of an epoch it computes the real thing, and inside the epoch it updates that estimate from the change in a single component gradient between two nearby points. Because consecutive points are close, the estimate stays accurate while each update costs only two component evaluations.",
        invariants: [
            "The gradient estimate is recomputed exactly at the start of every epoch.",
            "Each inner update uses one component at the current and previous points.",
            "For a quadratic sum the recursive estimate equals the exact gradient at the current point.",
        ],
        correctness:
            "For a quadratic component, grad_i(x) - grad_i(x_prev) = a_i (x - x_prev), so summing the recursion over a path telescopes and the estimate v satisfies v_t = grad_i(x_t) - grad_i(x_0) + v_0. With the exact full gradient as v_0, the estimate tracks the true finite-sum gradient up to the component difference, which vanishes as the iterates converge. The iterates therefore follow a path with vanishing gradient toward the analytic optimum sum(b_i)/sum(a_i).",
        complexityRationale:
            "An epoch needs one full gradient costing n component evaluations plus (inner minus one) recursive steps costing two each, giving O(n + inner) per epoch with constant memory.",
        uses: [
            "Large-scale empirical risk minimization",
            "Variance-reduced training of convex models",
            "A teaching counterpart to SVRG and SAGA",
        ],
        references: [
            "Nguyen, Liu and Scheinberg, SARAH: A Novel Method for Machine Learning Problems Using Stochastic Recursive Gradient, 2017",
            "Bottou, Curtis and Nocedal, Optimization Methods for Large-Scale Machine Learning",
        ],
        workedExample:
            "With components a=[2,1], b=[3,1] the optimum is 4/3. Starting at x=5 with a small step, the full gradient points downward and successive recursive updates based on single components move x toward 1.333 without the jitter of plain stochastic gradient descent.",
    },
    id: "sarah-optimizer",
    name: "SARAH Optimizer",
    category: "numerical-optimization",
    complexity: { time: "O(epochs * (n + inner))", space: "O(1)" },
    defaultInput: {
        components: [
            { a: 2, b: 3 },
            { a: 1, b: 1 },
            { a: 4, b: 6 },
            { a: 3, b: 2 },
        ],
        start: 5,
        learningRate: 0.15,
        epochs: 30,
        inner: 4,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the component quadratics, start point and step size",
        "for each epoch compute the full gradient exactly",
        "take one step using that full gradient",
        "for each inner step draw one component index",
        "update the gradient estimate from the two nearby component gradients",
        "step using the recursive gradient estimate",
        "done: report the final parameter and analytic optimum",
    ],
};

export default module;
