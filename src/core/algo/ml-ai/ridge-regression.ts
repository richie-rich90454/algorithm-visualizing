/**
 * ridge-regression.ts - L2 Regularized Linear Regression
 *
 * Fits a line y = w*x through the origin by minimizing the ridge objective
 * sum((y - w*x)^2) + lambda*w^2. The closed-form solution is assembled from
 * per-point sufficient statistics, which the frames accumulate one at a time.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Sample {
    x: number;
    y: number;
}

function makePoints(samples: Sample[], processed: number, current: number): VisualEntity[] {
    return samples.map((sample, index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: `(${sample.x},${sample.y})`,
        value: [sample.x, sample.y],
        state:
            index < processed
                ? ("sorted" as const)
                : index === current
                  ? ("active" as const)
                  : ("unvisited" as const),
        x: sample.x,
        y: sample.y,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Sample[]; lambda?: number } | null) ?? {};
    const samples: Sample[] = task.points ?? [
        { x: 1, y: 2 },
        { x: 2, y: 3.8 },
        { x: 3, y: 6.1 },
        { x: 4, y: 8 },
    ];
    const lambda = typeof task.lambda === "number" && task.lambda >= 0 ? task.lambda : 1;

    let sumXY = 0;
    let sumX2 = 0;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makePoints(samples, 0, -1),
        edges: [],
        description: `Fitting a ridge line to ${samples.length} points with lambda = ${lambda}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { processed: 0, sumXY: 0, sumX2: 0, slope: 0, objective: 0 },
    };
    step += 1;

    for (let i = 0; i < samples.length; i += 1) {
        const sample = samples[i];
        if (sample) {
            sumXY += sample.x * sample.y;
            sumX2 += sample.x * sample.x;
        }
        yield {
            stepNumber: step,
            entities: makePoints(samples, i + 1, -1),
            edges: [],
            description: `Point ${i}: accumulated sum(x*y) = ${sumXY.toFixed(3)} and sum(x^2) = ${sumX2.toFixed(3)}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { processed: i + 1, sumXY: Number(sumXY.toFixed(6)), sumX2: Number(sumX2.toFixed(6)), slope: 0, objective: 0 },
        };
        step += 1;
    }

    const slope = sumX2 + lambda > 0 ? sumXY / (sumX2 + lambda) : 0;
    let objective = lambda * slope * slope;
    for (const sample of samples) {
        objective += (sample.y - slope * sample.x) ** 2;
    }

    const xs = samples.map((sample) => sample.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const range = Math.max(1, maxX - minX);
    const leftX = minX - 0.5 * range;
    const rightX = maxX + 0.5 * range;
    const entities = makePoints(samples, samples.length, -1);
    entities.push({
        id: "line-left",
        type: "node",
        label: "fit",
        value: slope * leftX,
        state: "path",
        x: leftX,
        y: slope * leftX,
        width: 0,
        height: 0,
        metadata: { line: true },
    });
    entities.push({
        id: "line-right",
        type: "node",
        label: "fit",
        value: slope * rightX,
        state: "path",
        x: rightX,
        y: slope * rightX,
        width: 0,
        height: 0,
        metadata: { line: true },
    });
    const edges: VisualEdge[] = [
        { id: "fit-line", sourceId: "line-left", targetId: "line-right", label: `w=${slope.toFixed(3)}`, state: "path", directed: false },
    ];

    yield {
        stepNumber: step,
        entities,
        edges,
        description: `Optimal slope w = sum(x*y) / (sum(x^2) + lambda) = ${slope.toFixed(4)}; objective = ${objective.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            processed: samples.length,
            sumXY: Number(sumXY.toFixed(6)),
            sumX2: Number(sumX2.toFixed(6)),
            slope: Number(slope.toFixed(6)),
            objective: Number(objective.toFixed(6)),
            lambda,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Ordinary least squares can fit noisy data with a very large slope. Ridge regression adds a penalty proportional to the squared size of the coefficient, which shrinks the slope toward zero. The strength of that pull is controlled by lambda.",
        invariants: [
            "The sufficient statistics sum(x*y) and sum(x^2) are accumulated over every point.",
            "The slope is sum(x*y) divided by sum(x^2) plus lambda.",
            "The objective is the residual sum of squares plus lambda times the squared slope.",
        ],
        correctness:
            "Differentiating the objective with respect to w gives 2*(sum(w*x^2 - x*y) + lambda*w). Setting it to zero yields the unique minimizer w = sum(x*y) / (sum(x^2) + lambda) for lambda >= 0 and nonzero denominator. Because the objective is a convex quadratic, this stationary point is the global minimum.",
        complexityRationale:
            "One pass accumulates the two sums in O(n) time, and only a few scalars plus the plotted line are stored, giving O(n) space for the frame entities.",
        uses: [
            "Regularizing linear models with many correlated features",
            "Preventing overfitting when predictors outnumber observations",
            "A baseline for Bayesian linear regression with Gaussian priors",
        ],
        references: [
            "Hoerl and Kennard, Ridge Regression: Biased Estimation for Nonorthogonal Problems, 1970",
            "Hastie, Tibshirani, and Friedman, The Elements of Statistical Learning, Chapter 3",
        ],
        workedExample:
            "For points (1,2), (2,3.8), (3,6.1), (4,8) with lambda = 1, sum(x*y) = 58.9 and sum(x^2) = 30, so the slope is 58.9 / 31, about 1.9. The penalty keeps the line slightly below the unregularized least-squares fit.",
    },
    id: "ridge-regression",
    name: "Ridge Regression",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        points: [
            { x: 1, y: 2 },
            { x: 2, y: 3.8 },
            { x: 3, y: 6.1 },
            { x: 4, y: 8 },
        ],
        lambda: 1,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize the sums sum x times y and sum x squared to zero",
        "for each training point",
        "add x times y to the first sum and x squared to the second",
        "set the slope to the first sum over the second sum plus lambda",
        "compute the ridge objective at this slope",
        "done: draw the fitted line and report the slope",
    ],
};

export default module;
