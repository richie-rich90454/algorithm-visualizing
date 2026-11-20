/**
 * retrace.ts - Retrace(lambda) Off-Policy Return Estimator
 *
 * Retrace corrects multi-step returns when the data-collecting (behavior)
 * policy differs from the policy being learned. It truncates importance
 * ratios at one and applies lambda to the bootstrapped correction, giving a
 * stable, low-variance target that is safe with off-policy trajectories.
 *
 * Time O(T) for a trajectory of length T, space O(T) for the return table.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RetraceInput {
    rewards: number[];
    nextValues: number[];
    probs: number[];
    targetProbs: number[];
    gamma: number;
    lambda: number;
}

export interface RetraceStep {
    t: number;
    ratio: number;
    c: number;
    reward: number;
    nextValue: number;
    ret: number;
}

/** Compute Retrace(lambda) returns by backward recursion. */
export function retraceReturns(input: RetraceInput): RetraceStep[] {
    const { rewards, nextValues, probs, targetProbs, gamma, lambda } = input;
    const T = rewards.length;
    const c: number[] = new Array(T).fill(0);
    for (let t = 0; t < T; t += 1) {
        const mu = probs[t] ?? 1;
        const ratio = mu > 0 ? (targetProbs[t] ?? 0) / mu : 0;
        c[t] = lambda * Math.min(1, ratio);
    }
    const ret = new Array(T + 1).fill(0);
    ret[T] = nextValues[T - 1] ?? 0;
    for (let t = T - 1; t >= 0; t -= 1) {
        const vNext = nextValues[t] ?? 0;
        const correction = t + 1 < T ? (c[t + 1] ?? 0) * (ret[t + 1] - vNext) : 0;
        ret[t] = (rewards[t] ?? 0) + gamma * vNext + gamma * correction;
    }
    return Array.from({ length: T }, (_, t) => ({
        t,
        ratio: (probs[t] ?? 1) > 0 ? (targetProbs[t] ?? 0) / (probs[t] ?? 1) : 0,
        c: c[t] ?? 0,
        reward: rewards[t] ?? 0,
        nextValue: nextValues[t] ?? 0,
        ret: ret[t] ?? 0,
    }));
}

function makeCells(steps: RetraceStep[], revealedFrom: number): VisualEntity[] {
    const labels = ["t", "pi/mu", "c", "reward", "V(s')", "Qret"];
    const entities: VisualEntity[] = [];
    steps.forEach((s, r) => {
        const values = [s.t, s.ratio, s.c, s.reward, s.nextValue, s.ret];
        labels.forEach((label, col) => {
            const shown = r >= revealedFrom;
            entities.push({
                id: `cell-${r}-${col}`,
                type: "cell",
                label: shown ? `${label}: ${(values[col] ?? 0).toFixed(3)}` : "?",
                value: shown ? (values[col] ?? 0) : 0,
                state: shown ? "sorted" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<RetraceInput> | null) ?? {};
    const rewards = task.rewards ?? [1, 0, 2];
    const nextValues = task.nextValues ?? [3, 2, 0];
    const probs = task.probs ?? [0.5, 0.8, 0.4];
    const targetProbs = task.targetProbs ?? [0.5, 0.5, 0.8];
    const gamma = typeof task.gamma === "number" ? task.gamma : 0.9;
    const lambda = typeof task.lambda === "number" ? task.lambda : 0.8;
    const steps = retraceReturns({ rewards, nextValues, probs, targetProbs, gamma, lambda });
    const T = steps.length;
    const cols = 6;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(steps, T + 1),
        edges: [],
        description: `Retrace on a ${T}-step trajectory: truncate ratios at one and bootstrap backward.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: T, cols, returns: steps.map((s) => s.ret) },
    };
    step += 1;
    for (let r = T - 1; r >= 0; r -= 1) {
        yield {
            stepNumber: step,
            entities: makeCells(steps, r),
            edges: [],
            description: `Step ${r}: c=${(steps[r]?.c ?? 0).toFixed(3)}, reward=${steps[r]?.reward ?? 0}, bootstrapped return=${(steps[r]?.ret ?? 0).toFixed(3)}.`,
            codeLineNumber: r === T - 1 ? 2 : 4,
            layout: "grid",
            meta: { rows: T, cols, current: r, returns: steps.map((s) => s.ret) },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(steps, 0),
        edges: [],
        description: "Done: every step now has a corrected off-policy return.",
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: T, cols, returns: steps.map((s) => s.ret), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Retrace estimates the value of actions taken by a target policy using data from a different behavior policy. It scales the bootstrapped continuation by a truncated importance ratio, so unlikely actions cannot blow up the estimate, and a lambda parameter controls how far the correction reaches. The result is a stable multi-step target that works even when the two policies differ a lot.",
        invariants: [
            "Each importance ratio pi over mu is truncated at one before applying lambda.",
            "The return at the horizon equals the reward plus gamma times the bootstrapped value.",
            "When target and behavior policies match, the truncated ratio is lambda and Retrace reduces to TD(lambda).",
        ],
        correctness:
            "The code first builds c_t = lambda times the minimum of one and pi(a_t|s_t) over mu(a_t|s_t). It initializes the bootstrap Q at the horizon to V of the last state, then sweeps backward computing r_t + gamma V(s_{t+1}) + gamma c_{t+1} times the difference between the next return and V(s_{t+1}). This is the Retrace(lambda) recursion; with lambda equal to one and matching policies it reproduces ordinary Sarsa(lambda).",
        complexityRationale:
            "One pass computes all ratios and one backward pass computes the returns, so time is O(T) for a trajectory of length T. Storing the ratio and return tables uses O(T) space.",
        uses: [
            "Off-policy value learning such as Retrace-based Q-learning",
            "Actor-critic methods with experience replay",
            "Safe multi-step return estimation with behavior policies",
        ],
        references: [
            "Munos et al., Safe and Efficient Off-Policy Reinforcement Learning, NeurIPS 2016",
            "Sutton and Barto, Reinforcement Learning: An Introduction, 2nd edition, Chapter 7",
        ],
        workedExample:
            "For a single step with reward 1, gamma 0.9, and next value 3, the bootstrapped return is 1 + 0.9 times 3 = 3.7. With a second step whose truncated weighted ratio is 0.4, the first return adds 0.9 times 0.4 times the difference between the second return and the intermediate value.",
    },
    id: "retrace",
    name: "Retrace(lambda)",
    category: "ml-ai",
    complexity: { time: "O(T)", space: "O(T)" },
    defaultInput: {
        rewards: [1, 0, 2],
        nextValues: [3, 2, 0],
        probs: [0.5, 0.8, 0.4],
        targetProbs: [0.5, 0.5, 0.8],
        gamma: 0.9,
        lambda: 0.8,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the corrected return at the horizon to the bootstrap value",
        "for each step compute the ratio pi over mu and truncate at one",
        "multiply the truncated ratio by lambda to obtain c",
        "for t from the last step down to zero",
        "return = reward plus gamma times the next value",
        "add gamma times c next times the bootstrapped correction",
        "done: report all corrected returns",
    ],
};

export default module;
