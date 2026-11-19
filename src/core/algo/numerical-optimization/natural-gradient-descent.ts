/**
 * natural-gradient-descent.ts - Natural Gradient Descent with the Fisher Metric
 *
 * Ordinary gradient descent measures distance in parameter coordinates, which
 * can be misleading when parameters have very different sensitivities. Natural
 * gradient descent instead measures distance in the space of probability
 * distributions, using the Fisher information matrix as a local metric. The
 * update solves Fisher times direction equals the ordinary gradient, so a
 * steep-but-narrow direction is automatically discounted.
 *
 * The teaching model is a two-feature Gaussian linear regression. Its Fisher
 * matrix is proportional to the Gram matrix of the design, so the natural
 * direction points straight at the least-squares optimum and a full-length step
 * reaches it exactly.
 *
 * Time O(iterations * samples * parameters^2) including the small solve;
 * space O(parameters^2) for the Fisher matrix.
 *
 * Visualization: bars show the two parameters. Yellow marks the gradient step,
 * green the converged parameter vector.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface NgdInput {
    x?: number[][];
    y?: number[];
    theta?: number[];
    sigma?: number;
    eta?: number;
    iterations?: number;
}

function makeBars(theta: number[], state: EntityState): VisualEntity[] {
    return theta.map((value, index) => ({
        id: `theta-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, parameter: index, value },
    }));
}

function loss(x: number[][], y: number[], theta: number[], sigma: number): number {
    return x.reduce((sum, row, index) => {
        const prediction = (row[0] ?? 0) * (theta[0] ?? 0) + (row[1] ?? 0) * (theta[1] ?? 0);
        const residual = prediction - (y[index] ?? 0);
        return sum + (residual * residual) / (2 * sigma * sigma);
    }, 0);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as NgdInput | null) ?? {};
    const design = Array.isArray(task.x) && task.x.length > 0
        ? task.x.map((row) => [Number(row?.[0] ?? 0), Number(row?.[1] ?? 0)])
        : [[1, 1], [1, 2], [2, 1], [2, 3], [3, 2]];
    const response = Array.isArray(task.y) && task.y.length === design.length
        ? task.y.map((value) => Number(value) || 0)
        : [4, 6, 5, 8, 7];
    const sigma = Math.max(0.01, Number(task.sigma ?? 1) || 1);
    const eta = Math.max(0, Math.min(1, Number(task.eta ?? 1)));
    const iterations = Math.max(1, Math.min(100, Math.floor(Number(task.iterations ?? 5)) || 5));
    let theta = [
        Number(task.theta?.[0] ?? 0),
        Number(task.theta?.[1] ?? 0),
    ];

    // The Fisher matrix for a Gaussian mean model is X^T X / sigma^2.
    const gram = [
        [0, 0],
        [0, 0],
    ];
    for (const row of design) {
        const first = row[0] ?? 0;
        const second = row[1] ?? 0;
        gram[0]![0] = (gram[0]![0] ?? 0) + first * first;
        gram[0]![1] = (gram[0]![1] ?? 0) + first * second;
        gram[1]![0] = (gram[1]![0] ?? 0) + second * first;
        gram[1]![1] = (gram[1]![1] ?? 0) + second * second;
    }
    const fisher = gram.map((row) => row.map((value) => value / (sigma * sigma)));
    const determinant = (fisher[0]![0] ?? 0) * (fisher[1]![1] ?? 0) - (fisher[0]![1] ?? 0) * (fisher[1]![0] ?? 0);
    const safeDeterminant = Math.abs(determinant) < 1e-12 ? 1e-12 : determinant;

    yield {
        stepNumber: 0,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Fisher matrix built from ${design.length} samples; initial loss ${loss(design, response, theta, sigma).toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            iteration: 0,
            theta: [...theta],
            loss: loss(design, response, theta, sigma),
            gradientNorm: 0,
            fisherDet: determinant,
            fisher: fisher.flat(),
        },
    };

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const gradient = [0, 0];
        for (let index = 0; index < design.length; index += 1) {
            const row = design[index] ?? [0, 0];
            const prediction = (row[0] ?? 0) * (theta[0] ?? 0) + (row[1] ?? 0) * (theta[1] ?? 0);
            const residual = prediction - (response[index] ?? 0);
            gradient[0] = (gradient[0] ?? 0) + (row[0] ?? 0) * residual / (sigma * sigma);
            gradient[1] = (gradient[1] ?? 0) + (row[1] ?? 0) * residual / (sigma * sigma);
        }
        const direction = [
            ((fisher[1]![1] ?? 0) * (gradient[0] ?? 0) - (fisher[0]![1] ?? 0) * (gradient[1] ?? 0)) / safeDeterminant,
            (-(fisher[1]![0] ?? 0) * (gradient[0] ?? 0) + (fisher[0]![0] ?? 0) * (gradient[1] ?? 0)) / safeDeterminant,
        ];
        theta = theta.map((value, axis) => value - eta * (direction[axis] ?? 0));
        const currentLoss = loss(design, response, theta, sigma);
        yield {
            stepNumber: iteration,
            entities: makeBars(theta, iteration === iterations ? "sorted" : "comparing"),
            edges: [],
            description: `Natural step ${iteration}: parameters (${theta.map((v) => v.toFixed(4)).join(", ")}), loss ${currentLoss.toFixed(6)}.`,
            codeLineNumber: iteration === iterations ? 8 : 4,
            layout: "array",
            meta: {
                iteration,
                theta: [...theta],
                loss: currentLoss,
                gradientNorm: Math.hypot(gradient[0] ?? 0, gradient[1] ?? 0),
                fisherDet: determinant,
                fisher: fisher.flat(),
                direction: [...direction],
            },
        };
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Parameters are just coordinates, and changing one coordinate by one unit can change the model far more than changing another by the same amount. The Fisher matrix measures how sensitive the output distribution is to each parameter. Natural gradient descent divides the ordinary gradient by that local metric, so a step means the same amount of progress no matter how the model is parameterized.",
        invariants: [
            "The Fisher matrix is symmetric and positive semidefinite because it is proportional to the Gram matrix.",
            "The natural direction solves the linear system Fisher times direction equals gradient.",
            "With a full-length step on a linear Gaussian model the optimum is reached in one update.",
        ],
        correctness:
            "For a Gaussian model with mean X theta and fixed variance, the negative log likelihood has Hessian X^T X divided by the variance, which equals the Fisher information. The natural direction is therefore the Newton direction, and Newton's method on a quadratic reaches the minimizer in a single unit step. Re-solving the normal equations independently in a test recovers the same parameter vector, confirming the linear solve and the metric are implemented correctly.",
        complexityRationale:
            "Forming the Fisher matrix scans the samples once and costs O(samples * parameters^2). Each iteration recomputes a gradient in O(samples * parameters) and solves a small parameters by parameters system, so total time is O(iterations * samples * parameters^2) with O(parameters^2) space for the metric.",
        uses: [
            "Policy gradient reinforcement learning with trust regions",
            "Training probabilistic models whose parameters have uneven sensitivity",
            "Variational inference where the natural metric is the Fisher of the variational family",
        ],
        references: [
            "Amari, Natural Gradient Works Efficiently in Learning, 1998",
            "Kakade, A Natural Policy Gradient, 2002",
        ],
        workedExample:
            "With design rows [1,1] and [1,2] and responses 3 and 5, the Gram matrix is [[2,3],[3,5]]. Starting from zero, the ordinary gradient points toward the data, and solving the two by two Fisher system sends the parameters directly to the least-squares solution without overshooting a narrow ridge.",
    },
    id: "natural-gradient-descent",
    name: "Natural Gradient Descent",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * samples * params^2)", space: "O(params^2)" },
    defaultInput: { x: [[1, 1], [1, 2], [2, 1], [2, 3], [3, 2]], y: [4, 6, 5, 8, 7], theta: [0, 0], sigma: 1, eta: 1, iterations: 5 },
    visualType: "array",
    run,
    pseudocode: [
        "collect the design rows and observed responses",
        "build the Fisher matrix as the scaled Gram matrix",
        "initialize the parameter vector",
        "for each iteration compute the ordinary gradient",
        "solve Fisher times direction equals gradient",
        "move the parameters by the learning rate times the direction",
        "recompute the negative log likelihood",
        "stop after the requested number of steps",
        "done: report the final parameters and loss",
    ],
};

export default module;
