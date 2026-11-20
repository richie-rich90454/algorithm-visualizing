/**
 * natural-policy-gradient.ts - Natural Policy Gradient
 *
 * The natural policy gradient rescales the ordinary policy gradient by the
 * inverse Fisher information matrix, so a step has roughly the same effect on
 * the policy distribution regardless of how the parameters are written. For a
 * softmax policy at one state the Fisher is the covariance of the action
 * feature vectors under the current distribution.
 *
 * Time O(A * d^2 + d^3) for A actions and d features, space O(d^2).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface NpgInput {
    features: number[][];
    theta: number[];
    advantages: number[];
    stepSize: number;
    damping: number;
}

export interface NpgResult {
    probs: number[];
    scoreFunction: number[][];
    fisher: number[][];
    gradient: number[];
    step: number[];
}

/** Solve A x = b by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
    const n = b.length;
    const m = A.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) pivot = r;
        }
        const tmp = m[col];
        m[col] = m[pivot] ?? [];
        m[pivot] = tmp ?? [];
        const pivotVal = m[col]?.[col] ?? 1;
        for (let c = col; c <= n; c += 1) m[col]![c] = (m[col]![c] ?? 0) / pivotVal;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const factor = m[r]?.[col] ?? 0;
            if (factor === 0) continue;
            for (let c = col; c <= n; c += 1) m[r]![c] = (m[r]![c] ?? 0) - factor * (m[col]![c] ?? 0);
        }
    }
    return m.map((row) => row[n] ?? 0);
}

/** Compute the softmax policy, Fisher matrix, policy gradient, and natural step. */
export function naturalPolicyGradient(input: NpgInput): NpgResult {
    const features = input.features;
    const theta = input.theta;
    const advantages = input.advantages;
    const stepSize = input.stepSize;
    const damping = input.damping;
    const A = features.length;
    const d = theta.length;
    const scores = features.map((f) => f.reduce((acc, v, i) => acc + v * (theta[i] ?? 0), 0));
    const maxScore = Math.max(...scores);
    const expScores = scores.map((s) => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    const probs = expScores.map((e) => e / sumExp);
    const mean = new Array(d).fill(0);
    for (let a = 0; a < A; a += 1) {
        for (let i = 0; i < d; i += 1) mean[i] = (mean[i] ?? 0) + (probs[a] ?? 0) * (features[a]?.[i] ?? 0);
    }
    const scoreFunction = features.map((f) => f.map((v, i) => v - (mean[i] ?? 0)));
    const fisher = Array.from({ length: d }, () => new Array(d).fill(0));
    const gradient = new Array(d).fill(0);
    for (let a = 0; a < A; a += 1) {
        const p = probs[a] ?? 0;
        const s = scoreFunction[a] ?? [];
        for (let i = 0; i < d; i += 1) {
            gradient[i] = (gradient[i] ?? 0) + p * (advantages[a] ?? 0) * (s[i] ?? 0);
            for (let j = 0; j < d; j += 1) {
                fisher[i]![j] = (fisher[i]![j] ?? 0) + p * (s[i] ?? 0) * (s[j] ?? 0);
            }
        }
    }
    for (let i = 0; i < d; i += 1) fisher[i]![i] = (fisher[i]![i] ?? 0) + damping;
    const nat = solve(fisher, gradient);
    const step = nat.map((v) => stepSize * v);
    return { probs, scoreFunction, fisher, gradient, step };
}

function makeCells(result: NpgResult, advantages: number[]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    result.probs.forEach((p, a) => {
        const values = [p, advantages[a] ?? 0, result.scoreFunction[a]?.[0] ?? 0, result.scoreFunction[a]?.[1] ?? 0];
        values.forEach((v, c) => {
            entities.push({
                id: `cell-${a}-${c}`,
                type: "cell",
                label: `${["pi", "adv", "score0", "score1"][c]}: ${v.toFixed(3)}`,
                value: v,
                state: "sorted",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: a, col: c },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<NpgInput> | null) ?? {};
    const features = task.features ?? [[1, 0], [0, 1], [-1, -1]];
    const theta = task.theta ?? [0.2, -0.1];
    const advantages = task.advantages ?? [1, -0.5, 0.25];
    const stepSize = typeof task.stepSize === "number" ? task.stepSize : 0.1;
    const damping = typeof task.damping === "number" ? task.damping : 1e-4;
    const result = naturalPolicyGradient({ features, theta, advantages, stepSize, damping });
    const rows = result.probs.length;
    const cols = 4;
    const d = theta.length;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(result, advantages),
        edges: [],
        description: `Natural policy gradient over ${rows} actions: compute the softmax policy and Fisher matrix.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, step: result.step, fisher: result.fisher.flat(), fisherDim: d, gradient: result.gradient },
    };
    step += 1;
    for (let a = 0; a < rows; a += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(result, advantages),
            edges: [],
            description: `Action ${a}: probability ${(result.probs[a] ?? 0).toFixed(3)}, advantage ${(advantages[a] ?? 0).toFixed(3)}, score function [${(result.scoreFunction[a] ?? []).map((v) => v.toFixed(2)).join(", ")}].`,
            codeLineNumber: a === 0 ? 2 : 4,
            layout: "grid",
            meta: { rows, cols, current: a, step: result.step, fisher: result.fisher.flat(), fisherDim: d, gradient: result.gradient },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(result, advantages),
        edges: [],
        description: `Done: natural step [${result.step.map((v) => v.toFixed(3)).join(", ")}] = step size times inverse Fisher times gradient.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows, cols, step: result.step, fisher: result.fisher.flat(), fisherDim: d, gradient: result.gradient, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain gradient step in parameter space can change a policy far more for some parameters than others. The natural gradient measures distance in the space of policy distributions instead, using the Fisher information matrix as a local metric. Dividing the gradient by that matrix gives a step whose size is meaningful in terms of how much the action probabilities move.",
        invariants: [
            "Action probabilities are a softmax of the linear scores theta dot feature.",
            "The Fisher matrix is the covariance of the action score functions under the policy.",
            "The natural step solves Fisher times step equals step size times the policy gradient.",
        ],
        correctness:
            "The code computes softmax probabilities, the centered score functions phi_a minus their mean, the Fisher as the probability-weighted outer products of those scores, and the policy gradient as the probability-weighted advantage times score. Adding damping keeps the Fisher positive definite, and Gaussian elimination solves Fisher times natural gradient equals gradient. Multiplying by the step size gives the reported update, which the test reproduces with an independent solve.",
        complexityRationale:
            "Forming the score functions is O(A * d), the Fisher outer products are O(A * d^2), and solving the d by d system is O(d^3); memory for the Fisher is O(d^2).",
        uses: [
            "Policy optimization in reinforcement learning",
            "Trust-region style updates with a Fisher metric",
            "Natural gradient methods in supervised learning",
        ],
        references: [
            "Amari, Natural Gradient Works Efficiently in Learning, Neural Computation 1998",
            "Kakade, A Natural Policy Gradient, NeurIPS 2001",
        ],
        workedExample:
            "For two actions with features [1, 0] and [0, 1] and equal probabilities, the mean feature is [0.5, 0.5], so the score functions are [0.5, -0.5] and [-0.5, 0.5]. The Fisher is a quarter of the identity plus off-diagonal negative quarters; solving it against an advantage-weighted gradient yields a natural step that rotates the two probabilities in a balanced way.",
    },
    id: "natural-policy-gradient",
    name: "Natural Policy Gradient",
    category: "ml-ai",
    complexity: { time: "O(A * d^2 + d^3)", space: "O(d^2)" },
    defaultInput: {
        features: [[1, 0], [0, 1], [-1, -1]],
        theta: [0.2, -0.1],
        advantages: [1, -0.5, 0.25],
        stepSize: 0.1,
        damping: 1e-4,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compute action scores as theta dot each feature vector",
        "form softmax action probabilities from the scores",
        "compute the mean feature under the policy",
        "form each score function as feature minus mean feature",
        "assemble Fisher as weighted outer products and gradient as weighted scores",
        "add damping and solve Fisher times step equals gradient",
        "done: scale the solution by the step size",
    ],
};

export default module;
