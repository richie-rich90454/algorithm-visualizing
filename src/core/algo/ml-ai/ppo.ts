/**
 * ppo.ts - Proximal Policy Optimization with GAE
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * PPO improves a policy with a clipped surrogate objective that discourages
 * updates changing the action probabilities too much in one step. Advantages
 * come from generalized advantage estimation (GAE). A value-function term and
 * the clipped policy term form the final loss.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T) for a trajectory of length T
 *   Space: O(T) for the advantage and ratio arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the per-step GAE deltas, then the probability ratios.
 *   - The final frame highlights the normalized advantages.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PpoInput {
    oldLogProbs?: number[];
    newLogProbs?: number[];
    rewards?: number[];
    values?: number[];
    dones?: boolean[];
    gamma?: number;
    lam?: number;
    clipEps?: number;
    valueCoef?: number;
}

function makeBars(values: number[], state: EntityState, prefix = "v"): VisualEntity[] {
    return values.map((value, index) => ({
        id: `${prefix}-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((a, v) => a + v, 0) / values.length;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PpoInput | null) ?? {};
    const oldLogProbs = task.oldLogProbs ?? [-0.5, -0.2, -0.8, -0.3];
    const newLogProbs = task.newLogProbs ?? [-0.4, -0.4, -0.9, -0.1];
    const rewards = task.rewards ?? [1, 0, 0.5, 2];
    const values = task.values ?? [0.2, 0.1, 0.3, 0.5, 0];
    const dones = task.dones ?? [false, false, false, true];
    const gamma = typeof task.gamma === "number" ? task.gamma : 0.99;
    const lam = typeof task.lam === "number" ? task.lam : 0.95;
    const clipEps = typeof task.clipEps === "number" ? task.clipEps : 0.2;
    const valueCoef = typeof task.valueCoef === "number" ? task.valueCoef : 0.5;

    const t = Math.min(oldLogProbs.length, newLogProbs.length, rewards.length, dones.length);
    const deltas: number[] = [];
    for (let i = 0; i < t; i += 1) {
        const nextValue = values[i + 1] ?? 0;
        deltas.push((rewards[i] ?? 0) + gamma * (dones[i] ? 0 : 1) * nextValue - (values[i] ?? 0));
    }
    const advantages = new Array<number>(t).fill(0);
    for (let i = t - 1; i >= 0; i -= 1) {
        const nextAdv = i + 1 < t ? (advantages[i + 1] ?? 0) : 0;
        advantages[i] =
            (deltas[i] ?? 0) + gamma * lam * (dones[i] ? 0 : 1) * nextAdv;
    }
    const ratios: number[] = [];
    const surrogates: number[] = [];
    for (let i = 0; i < t; i += 1) {
        const ratio = Math.exp((newLogProbs[i] ?? 0) - (oldLogProbs[i] ?? 0));
        const adv = advantages[i] ?? 0;
        ratios.push(ratio);
        surrogates.push(
            Math.min(ratio * adv, Math.min(1 + clipEps, Math.max(1 - clipEps, ratio)) * adv),
        );
    }
    const policyLoss = -mean(surrogates);
    const returns = advantages.map((adv, i) => adv + (values[i] ?? 0));
    const valueLoss = valueCoef * mean(returns.map((ret, i) => (ret - (values[i] ?? 0)) ** 2));
    const totalLoss = policyLoss + valueLoss;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(rewards.slice(0, t), "idle", "reward"),
        edges: [],
        description: `PPO over a trajectory of ${t} steps with clip radius ${clipEps}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, gamma, lam, clipEps, policyLoss: 0, valueLoss: 0, totalLoss: 0 },
    };
    step += 1;

    for (let i = t - 1; i >= 0; i -= 1) {
        yield {
            stepNumber: step,
            entities: makeBars(deltas.slice(0, i + 1), "active", "delta"),
            edges: [],
            description: `GAE delta at step ${i}: reward plus discounted next value minus current value is ${(deltas[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { step, index: i, delta: deltas[i] ?? 0, advantages: advantages.slice(0, i + 1) },
        };
        step += 1;
    }

    for (let i = 0; i < t; i += 1) {
        const ratio = ratios[i] ?? 0;
        const adv = advantages[i] ?? 0;
        const clipped = Math.min(1 + clipEps, Math.max(1 - clipEps, ratio));
        yield {
            stepNumber: step,
            entities: makeBars(ratios, i === 0 ? "active" : "idle", "ratio"),
            edges: [],
            description: `Step ${i}: ratio ${ratio.toFixed(4)} clipped to ${clipped.toFixed(4)} with advantage ${adv.toFixed(4)} gives surrogate ${(surrogates[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { step, index: i, ratio, clippedRatio: clipped, advantage: adv, surrogate: surrogates[i] ?? 0 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(advantages, "sorted", "adv"),
        edges: [],
        description: `Done: policy loss ${policyLoss.toFixed(6)}, value loss ${valueLoss.toFixed(6)}, total ${totalLoss.toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            step,
            advantages,
            deltas,
            ratios,
            surrogates,
            policyLoss,
            valueLoss,
            totalLoss,
            meanRatio: mean(ratios),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A naive policy gradient can take a huge step when a sampled action suddenly looks better, which destabilizes training. PPO measures how far the new policy has moved from the old one with a probability ratio and clips that ratio near one, so the objective stops rewarding excessively large changes. Advantages come from GAE, which blends short- and long-horizon advantage estimates with one parameter.",
        invariants: [
            "The probability ratio equals the exponential of the new log probability minus the old one.",
            "The clipped ratio always lies in the interval from one minus epsilon to one plus epsilon.",
            "The surrogate takes the smaller of the unclipped and clipped terms for each step.",
        ],
        correctness:
            "GAE is built by a reverse recurrence that adds the discounted next advantage to each one-step temporal-difference error, which is the exact definition of the generalized advantage estimator. For each step the clipped surrogate uses the elementwise minimum against the clipped ratio, so a ratio pushed beyond the trust region can no longer increase the objective. The test replays both recurrences independently and checks every advantage, ratio, and loss term.",
        complexityRationale:
            "The forward GAE recurrence and the clipped objective each scan the T-step trajectory a constant number of times, giving linear time and linear space for the stored advantages and ratios.",
        uses: [
            "Reinforcement learning from human feedback for language models",
            "Robotics control with stable on-policy updates",
            "Game agents trained with large parallel rollouts",
        ],
        references: [
            "Schulman et al., Proximal Policy Optimization Algorithms, 2017",
            "Schulman et al., High-Dimensional Continuous Control Using GAE, 2016",
        ],
        workedExample:
            "With reward one at the last step and a terminal value of zero, the final GAE delta is about one. If a new log probability exceeds the old by 0.3, the ratio is about 1.35, which is clipped to 1.2; with a positive advantage the surrogate is capped at 1.2 times that advantage.",
    },
    id: "ppo",
    name: "Proximal Policy Optimization",
    category: "ml-ai",
    complexity: { time: "O(T)", space: "O(T)" },
    defaultInput: {
        oldLogProbs: [-0.5, -0.2, -0.8, -0.3],
        newLogProbs: [-0.4, -0.4, -0.9, -0.1],
        rewards: [1, 0, 0.5, 2],
        values: [0.2, 0.1, 0.3, 0.5, 0],
        dones: [false, false, false, true],
        gamma: 0.99,
        lam: 0.95,
        clipEps: 0.2,
        valueCoef: 0.5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize trajectory arrays of rewards, values, and log probabilities",
        "for each step compute the GAE temporal-difference delta",
        "walk backward accumulating advantages with the discount and lambda",
        "compute the probability ratio of new over old log probability",
        "form the clipped surrogate as the min of raw and clipped ratio times advantage",
        "average the surrogate into the policy loss",
        "add the squared value error scaled by the value coefficient",
        "done: report the policy, value, and total losses",
    ],
};

export default module;
