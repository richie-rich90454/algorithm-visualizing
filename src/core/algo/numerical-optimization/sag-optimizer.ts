/**
 * sag-optimizer.ts - Stochastic Average Gradient (SAG)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Stochastic gradient descent uses one randomly chosen component gradient per
 * step, which makes progress cheap but noisy. SAG keeps a table of the most
 * recent gradient of every component, evaluated where that component was last
 * visited. At each step it replaces one table entry and updates the average by
 * only the difference, so the direction becomes an increasingly accurate estimate
 * of the full gradient while still costing one component evaluation. For a
 * finite sum of quadratics the iterates converge to the same closed-form
 * solution as batch gradient descent, but with far less work per step.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d) per component gradient and O(n*d) for the whole table
 *   Space: O(n*d) for the stored gradients
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar shows each coordinate of the current iterate.
 *   - The coordinate whose component was sampled is highlighted.
 *   - The meta reports the iterate, averaged gradient, and objective.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SagInput {
    a?: number[];
    b?: number[];
    regularizer?: number;
    iterations?: number;
    stepSize?: number;
}

function makeBars(x: number[], active: number): VisualEntity[] {
    return x.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `x${index}: ${value.toFixed(3)}`,
        value,
        state: (index === active ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** The SAG generator over a diagonal quadratic finite sum. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SagInput | null) ?? {};
    const a: number[] = Array.isArray(task.a) && task.a.length > 0 && task.a.every((v) => typeof v === "number")
        ? task.a
        : [2, 3, 1];
    const b: number[] = Array.isArray(task.b) && task.b.length === a.length && task.b.every((v) => typeof v === "number")
        ? task.b
        : [6, 9, 4];
    const n = a.length;
    const lambda = typeof task.regularizer === "number" && task.regularizer >= 0 ? task.regularizer : 0.5;
    const iterations = typeof task.iterations === "number" && task.iterations >= 1 ? Math.floor(task.iterations) : 600;
    const maxA2 = Math.max(...a.map((v) => v * v));
    const stepSize = typeof task.stepSize === "number" && task.stepSize > 0
        ? task.stepSize
        : 1 / (2 * (maxA2 / n + lambda));

    const gradient = (index: number, x: number[]): number[] => {
        const g = Array.from({ length: n }, (_, j) => lambda * (x[j] ?? 0));
        g[index] = (g[index] ?? 0) + (a[index]! * (x[index] ?? 0) - b[index]!) * a[index]!;
        return g;
    };

    const objective = (x: number[]): number => {
        let data = 0;
        for (let i = 0; i < n; i += 1) {
            const residual = a[i]! * (x[i] ?? 0) - b[i]!;
            data += 0.5 * residual * residual;
        }
        let regularizer = 0;
        for (const value of x) regularizer += 0.5 * lambda * value * value;
        return data / n + regularizer;
    };

    let x = Array.from({ length: n }, () => 0);
    const table: number[][] = Array.from({ length: n }, (_, i) => gradient(i, x));
    const average = Array.from({ length: n }, (_, j) => table.reduce((sum, row) => sum + (row[j] ?? 0), 0) / n);
    const logEvery = Math.max(1, Math.floor(iterations / 40));
    let step = 0;

    const meta = (iteration: number, sampled: number, done: boolean) => ({
        x: [...x],
        sampled,
        average: [...average],
        gradientTable: table.flat(),
        objective: objective(x),
        iteration,
        n,
        stepSize,
        done,
    });

    yield {
        stepNumber: step++,
        entities: makeBars(x, -1),
        edges: [],
        description: `Minimizing a ${n}-component quadratic finite sum with step size ${stepSize.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, -1, false),
    };

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const index = iteration % n;
        const fresh = gradient(index, x);
        for (let j = 0; j < n; j += 1) {
            average[j] = (average[j] ?? 0) + (fresh[j]! - (table[index]![j] ?? 0)) / n;
        }
        table[index] = fresh;
        for (let j = 0; j < n; j += 1) {
            x[j] = (x[j] ?? 0) - stepSize * (average[j] ?? 0);
        }
        if ((iteration + 1) % logEvery === 0 || iteration + 1 === iterations) {
            yield {
                stepNumber: step++,
                entities: makeBars(x, index),
                edges: [],
                description: `Update ${iteration + 1}: sampled component ${index}, average gradient norm ${Math.sqrt(average.reduce((sum, g) => sum + g * g, 0)).toFixed(4)}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: meta(iteration + 1, index, false),
            };
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, -1),
        edges: [],
        description: `After ${iterations} updates the iterate is [${x.map((v) => v.toFixed(4)).join(", ")}] with objective ${objective(x).toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: meta(iterations, -1, true),
    };
}

/** The SAG module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Stochastic gradient descent estimates the full gradient from one example, which is fast but jittery. SAG instead remembers one gradient per example and keeps their running average. Replacing a single stale entry costs one gradient evaluation, yet the average becomes steadily more accurate because it reuses the past. On finite training sets this gives deterministic-like convergence with stochastic-like cost per step.",
        invariants: [
            "The stored table holds the gradient of each component at its last visited point.",
            "The running average equals the mean of the table entries after every update.",
            "Each step evaluates exactly one component gradient.",
            "The objective is the sum of squared residuals plus a quadratic regularizer.",
        ],
        correctness:
            "The average is updated by (new gradient minus old gradient) divided by n, which is algebraically identical to recomputing the mean of all n table entries, so it stays exact by induction. With a quadratic finite sum the average gradient is Lipschitz with constant lambda plus the largest squared diagonal entry divided by n; a step size of one over twice that constant makes the incremental averaged-gradient iteration stable and convergent. Solving each coordinate's first-order condition gives the closed-form optimum, which the iterates approach.",
        complexityRationale:
            "Each update evaluates one component gradient in O(d) and updates the average and iterate in O(d), giving O(d) work per step. The gradient table stores n vectors of length d, so space is O(n*d).",
        uses: [
            "Large-scale logistic and least-squares regression",
            "Finite-sum objective minimization in machine learning",
            "Variance-reduced training where full-gradient passes are costly",
        ],
        references: [
            "Schmidt, Le Roux, and Bach, Minimizing Finite Sums with the Stochastic Average Gradient, 2013",
            "Roux, Schmidt, and Bach, A Faster Stochastic Gradient Method, 2012",
        ],
        workedExample:
            "With a = (2, 3, 1), b = (6, 9, 4), and regularizer 0.5, the exact minimizer is x = (12/5.5, 27/10.5, 4/2.5). Starting from zero, SAG cycles through the three components, replacing one stored gradient each step. After several hundred cheap updates the iterate matches the closed-form solution to a few decimal places.",
    },
    id: "sag-optimizer",
    name: "Stochastic Average Gradient (SAG)",
    category: "numerical-optimization",
    complexity: { time: "O(d) per update", space: "O(n*d)" },
    defaultInput: { a: [2, 3, 1], b: [6, 9, 4], regularizer: 0.5, iterations: 600 },
    visualType: "array",
    run,
    pseudocode: [
        "start from zero and evaluate every component gradient once",
        "store each gradient in a table and average the table",
        "for each update choose the next component in order",
        "evaluate its gradient at the current iterate",
        "replace its table entry and shift the average by the difference",
        "step opposite the averaged gradient with a fixed step size",
        "record the objective and the iterate periodically",
        "done: report the final iterate and objective",
    ],
};

export default module;
