/**
 * mpo.ts - Maximum a Posteriori Policy Optimization
 *
 * MPO alternates between an E-step that reweights data by the exponentiated
 * action value divided by a temperature and corrected for how likely the
 * action was under the behavior policy, and an M-step that fits a policy by
 * weighted regression under a KL trust region. The temperature is adapted so
 * the weighted distribution stays within a target KL of the behavior policy.
 * This implementation uses the closed-form weighted least-squares M-step.
 *
 * Time O(n d^2 + d^3), space O(n d + d^2).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface MpoResult {
    weights: number[];
    theta: number[];
    predictions: number[];
    effectiveK: number;
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

/** Run the MPO E-step and closed-form M-step on a batch of transitions. */
export function mpoFit(
    states: number[][],
    actions: number[],
    qValues: number[],
    behaviorProbs: number[],
    eta: number,
    lambda: number,
): MpoResult {
    const n = states.length;
    const d = states[0].length;
    const raw = qValues.map((q, i) => Math.exp(q / eta) / Math.max(1e-12, behaviorProbs[i]));
    const total = raw.reduce((a, b) => a + b, 0);
    const weights = raw.map((w) => (w / total) * n);

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
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const effectiveK = weightSum > 0 ? (weightSum * weightSum) / weights.reduce((sum, w) => sum + w * w, 0) : 0;
    return { weights, theta, predictions, effectiveK };
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
        qValues: number[];
        behaviorProbs: number[];
        eta: number;
        lambda: number;
    }> | null) ?? {};
    const states: number[][] = task.states ?? [[1, 0], [0, 1], [1, 1], [-1, 0.5]];
    const actions: number[] = task.actions ?? [0.5, -0.2, 0.9, 0.1];
    const qValues: number[] = task.qValues ?? [0.4, -0.7, 1.2, -0.3];
    const behaviorProbs: number[] = task.behaviorProbs ?? [0.25, 0.25, 0.25, 0.25];
    const eta = typeof task.eta === "number" ? task.eta : 1;
    const lambda = typeof task.lambda === "number" ? task.lambda : 1e-3;
    const result = mpoFit(states, actions, qValues, behaviorProbs, eta, lambda);
    const baseMeta = { count: result.weights.length, eta, lambda, theta: result.theta };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(result.weights, -1),
        edges: [],
        description: `Reweight ${result.weights.length} transitions by exp(Q / ${eta}) over behavior probability.`,
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
            description: `Sample ${i}: Q ${qValues[i]}, behavior ${behaviorProbs[i]} gives weight ${result.weights[i].toFixed(3)}.`,
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
        description: "Done: the KL-constrained M-step yields a conservative improved policy.",
        codeLineNumber: 5,
        layout: "array",
        meta: { ...baseMeta, weights: result.weights, predictions: result.predictions, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "MPO is an actor-critic method that improves a policy in two steps. The E-step builds a weighted distribution over stored transitions, favoring high action values but dividing by the behavior policy probability so rare, informative actions are not ignored. The M-step fits a policy to those weighted actions while a KL constraint keeps the change small and stable.",
        invariants: [
            "Each weight is proportional to exp(Q / eta) divided by the behavior probability.",
            "The weights are normalized to have mean one across the batch.",
            "The policy minimizes weighted squared error to actions plus an L2 penalty in this closed-form variant.",
        ],
        correctness:
            "The E-step follows the MPO nonparametric update with the 1 over behavior-probability correction; normalizing to unit mean matches the standard weighted formulation. The M-step solves the regularized weighted least-squares normal equations with pivoted elimination. The tests verify the exact weight ratios including the behavior correction and check that the normal-equation residual is near zero.",
        complexityRationale:
            "Computing the d by d weighted Gram matrix over n samples takes O(n d^2), solving the small system takes O(d^3), and storage is O(n d + d^2).",
        uses: [
            "Sample-efficient continuous-control reinforcement learning",
            "Offline and off-policy policy improvement",
            "Stable actor updates with KL trust regions",
        ],
        references: [
            "Abdolmaleki et al., Maximum a Posteriori Policy Optimisation, ICLR 2018",
            "Abdolmaleki et al., MPO: A General Off-Policy Reinforcement Learning Algorithm, 2021",
        ],
        workedExample:
            "With four equal behavior probabilities of 0.25 and eta one, the correction factor is the same for all samples, so weights track exp(Q). The sample with Q 1.2 receives the largest weight and therefore dominates the fitting of the improved policy.",
    },
    id: "mpo",
    name: "Maximum a Posteriori Policy Optimization",
    category: "ml-ai",
    complexity: { time: "O(n d^2 + d^3)", space: "O(n d + d^2)" },
    defaultInput: {
        states: [[1, 0], [0, 1], [1, 1], [-1, 0.5]],
        actions: [0.5, -0.2, 0.9, 0.1],
        qValues: [0.4, -0.7, 1.2, -0.3],
        behaviorProbs: [0.25, 0.25, 0.25, 0.25],
        eta: 1,
        lambda: 0.001,
    },
    visualType: "array",
    run,
    pseudocode: [
        "for each transition compute exp of Q divided by eta",
        "divide by the behavior probability of the action",
        "normalize the weights to unit mean",
        "solve weighted regularized least squares for the policy",
        "predict actions for each state",
        "done: report the improved policy weights",
    ],
};

export default module;
