/**
 * awac.ts - Advantage-Weighted Actor Critic
 *
 * AWAC extracts a policy from off-policy data by weighting each demonstrated
 * action by an exponential of its advantage, then fitting a deterministic
 * policy with weighted least squares. The exponential down-weights actions
 * that are worse than the critic's value estimate, so the extracted policy
 * stays close to the data while improving on it. Beta controls how sharply
 * advantages are weighted.
 *
 * Time O(n d^2 + d^3), space O(n d + d^2) for n samples in d features.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface AwacResult {
    weights: number[];
    theta: number[];
    predictions: number[];
}

/** Solve a small linear system by Gauss-Jordan elimination with pivoting. */
function solve(matrix: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const aug = matrix.map((row, i) => [...row, rhs[i]]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) pivot = r;
        }
        const swap = aug[col];
        aug[col] = aug[pivot];
        aug[pivot] = swap;
        const div = aug[col][col] || 1e-12;
        for (let c = 0; c <= n; c += 1) aug[col][c] /= div;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const factor = aug[r][col];
            for (let c = 0; c <= n; c += 1) aug[r][c] -= factor * aug[col][c];
        }
    }
    return aug.map((row) => row[n]);
}

/** Run AWAC weighted regression and return weights, fitted policy, and predictions. */
export function awacFit(
    states: number[][],
    actions: number[],
    advantages: number[],
    beta: number,
    lambda: number,
): AwacResult {
    const n = states.length;
    const d = states[0].length;
    const raw = advantages.map((a) => Math.exp(a / beta));
    const mean = raw.reduce((x, y) => x + y, 0) / n;
    const weights = raw.map((w) => w / mean);

    const normal = Array.from({ length: d }, () => Array(d).fill(0));
    const rhs = Array(d).fill(0);
    for (let i = 0; i < n; i += 1) {
        const s = states[i];
        const w = weights[i];
        for (let a = 0; a < d; a += 1) {
            rhs[a] += w * s[a] * actions[i];
            for (let b = 0; b < d; b += 1) normal[a][b] += w * s[a] * s[b];
        }
    }
    for (let a = 0; a < d; a += 1) normal[a][a] += lambda;
    const theta = solve(normal, rhs);
    const predictions = states.map((s) => s.reduce((sum, v, k) => sum + v * theta[k], 0));
    return { weights, theta, predictions };
}

function makeBars(weights: number[], current: number): VisualEntity[] {
    return weights.map((w, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: w.toFixed(3),
        value: w,
        state: (i === current ? "active" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<{
        states: number[][];
        actions: number[];
        advantages: number[];
        beta: number;
        lambda: number;
    }> | null) ?? {};
    const states: number[][] = task.states ?? [[1, 0], [0, 1], [1, 1], [-1, 0.5]];
    const actions: number[] = task.actions ?? [0.5, -0.2, 0.9, 0.1];
    const advantages: number[] = task.advantages ?? [0.4, -0.7, 1.2, -0.3];
    const beta = typeof task.beta === "number" ? task.beta : 1;
    const lambda = typeof task.lambda === "number" ? task.lambda : 1e-3;
    const result = awacFit(states, actions, advantages, beta, lambda);
    const baseMeta = { count: result.weights.length, beta, lambda, theta: result.theta };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(result.weights, -1),
        edges: [],
        description: `Weight ${result.weights.length} demonstration actions by exp(advantage / ${beta}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...baseMeta, weights: result.weights },
    };
    step += 1;

    for (let i = 0; i < result.weights.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(result.weights, i),
            edges: [],
            description: `Sample ${i}: advantage ${advantages[i]} receives weight ${result.weights[i].toFixed(3)}.`,
            codeLineNumber: i === 0 ? 1 : 2,
            layout: "array",
            meta: { ...baseMeta, current: i, weights: result.weights },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(result.weights, -1),
        edges: [],
        description: "Done: weighted regression yields a policy that favors high-advantage actions.",
        codeLineNumber: 5,
        layout: "array",
        meta: { ...baseMeta, weights: result.weights, predictions: result.predictions, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "AWAC is an offline reinforcement learning method that turns a dataset plus a learned critic into a policy without new environment interaction. It assigns each demonstrated action a weight that grows exponentially with its advantage, so actions better than the critic's expectation are imitated more strongly. A weighted regression then produces a smooth deterministic policy close to the data.",
        invariants: [
            "Each weight is exp(advantage / beta) divided by the mean of all such terms.",
            "The fitted policy minimizes the weighted squared error to the actions plus an L2 penalty.",
            "The normal equations (X transpose W X plus lambda I) theta equals X transpose W a hold at the solution.",
        ],
        correctness:
            "Weights are computed from the exponential advantage and normalized to unit mean, preserving their relative ordering. The policy parameters come from solving the regularized weighted least-squares normal equations with pivoted Gauss-Jordan elimination; the tests rebuild those equations independently and confirm the residual is near zero, and also confirm the closed-form weight ratios.",
        complexityRationale:
            "Building the d by d weighted Gram matrix over n samples costs O(n d^2); solving the small system costs O(d^3); storing the states and working matrices costs O(n d + d^2).",
        uses: [
            "Offline reinforcement learning from a fixed dataset",
            "Policy extraction after critic training",
            "Fine-tuning policies conservatively from logged behavior",
        ],
        references: [
            "Nair et al., AWAC: Accelerating Online Reinforcement Learning with Offline Datasets, 2020",
            "Peng et al., Advantage-Weighted Regression, 2019",
        ],
        workedExample:
            "For advantages 0.4, minus 0.7, and 1.2 with beta one, the raw weights are about 1.49, 0.50, and 3.32. After dividing by their mean of about 1.77 they become roughly 0.84, 0.28, and 1.88, so the best action is fit almost seven times as strongly as the worst one.",
    },
    id: "awac",
    name: "Advantage-Weighted Actor Critic",
    category: "ml-ai",
    complexity: { time: "O(n d^2 + d^3)", space: "O(n d + d^2)" },
    defaultInput: {
        states: [[1, 0], [0, 1], [1, 1], [-1, 0.5]],
        actions: [0.5, -0.2, 0.9, 0.1],
        advantages: [0.4, -0.7, 1.2, -0.3],
        beta: 1,
        lambda: 0.001,
    },
    visualType: "array",
    run,
    pseudocode: [
        "for each sample compute exp of advantage divided by beta",
        "normalize the weights to unit mean",
        "accumulate the weighted feature Gram matrix",
        "accumulate the weighted feature-action cross products",
        "add lambda to the diagonal and solve for theta",
        "predict actions for each state with theta",
        "done: report the fitted policy weights",
    ],
};

export default module;
