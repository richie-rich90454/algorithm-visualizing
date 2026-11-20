/**
 * muzero.ts - MuZero-Style Latent One-Step Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MuZero plans without knowing the rules of the environment. It learns a
 * dynamics model that maps a hidden state and an action to the next hidden
 * state and reward, plus a prediction function that gives a policy and a value
 * from a hidden state. This toy runs one latent look-ahead step for each
 * candidate action: it applies the learned dynamics, reads the predicted
 * reward and value, and chooses the action with the best score.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(actions * hiddenDim) for the dynamics and value dot products
 *   Space: O(actions * hiddenDim) for the action and policy weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per action shows its predicted reward plus discounted value.
 *   - The action currently being evaluated is highlighted.
 *   - Meta records each score, the chosen action, and the prediction policy.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MuzeroInput {
    hidden?: number[];
    actions?: number[][];
    gamma?: number;
    rewardWeights?: number[];
    valueWeights?: number[];
    policyWeights?: number[][];
    temperature?: number;
}

const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

function softmax(values: number[]): number[] {
    const max = Math.max(...values);
    const exp = values.map((v) => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map((v) => v / sum);
}

function makeBars(scores: number[], active: number): VisualEntity[] {
    return scores.map((score, index) => ({
        id: `action-${index}`,
        type: "bar" as const,
        label: `a${index} score=${score.toFixed(3)}`,
        value: score,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, action: index },
    }));
}

/** The MuZero-style latent search generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MuzeroInput | null) ?? {};
    const hidden = Array.isArray(task.hidden) && task.hidden.length > 0 ? [...task.hidden] : [1, 0.5, -0.5];
    const dim = hidden.length;
    const actions: number[][] = Array.isArray(task.actions) && task.actions.length > 0
        ? task.actions.map((a) => [...a])
        : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const gamma = typeof task.gamma === "number" ? Math.min(1, Math.max(0, task.gamma)) : 0.9;
    const rewardWeights = Array.isArray(task.rewardWeights) && task.rewardWeights.length === dim ? [...task.rewardWeights] : [1, 0.5, 0];
    const valueWeights = Array.isArray(task.valueWeights) && task.valueWeights.length === dim ? [...task.valueWeights] : [0.5, 1, 0.2];
    const policyWeights: number[][] = Array.isArray(task.policyWeights) && task.policyWeights.length === actions.length
        ? task.policyWeights.map((row) => [...row])
        : actions.map(() => hidden.map(() => 0));
    const temperature = typeof task.temperature === "number" && task.temperature > 0 ? task.temperature : 1;

    const scores: number[] = [];
    const rewards: number[] = [];
    const values: number[] = [];
    for (const actionVec of actions) {
        const nextHidden = hidden.map((value, i) => value + (actionVec[i] ?? 0));
        const reward = dot(nextHidden, rewardWeights);
        const value = dot(nextHidden, valueWeights);
        rewards.push(reward);
        values.push(value);
        scores.push(reward + gamma * value);
    }
    const policy = softmax(policyWeights.map((row) => dot(hidden, row) / temperature));
    const chosen = scores.indexOf(Math.max(...scores));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(scores.map(() => 0), -1),
        edges: [],
        description: `MuZero latent search over ${actions.length} action(s) in a ${dim}-dimensional hidden state.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { action: -1, hidden: [...hidden], scores: scores.map(() => 0), rewards: [], values: [], chosen: -1, policy, temperature },
    };
    step += 1;

    for (let index = 0; index < actions.length; index += 1) {
        const shown = scores.map((score, i) => (i <= index ? score : 0));
        yield {
            stepNumber: step,
            entities: makeBars(shown, index),
            edges: [],
            description: `Action ${index}: learned dynamics predict reward ${(rewards[index] ?? 0).toFixed(3)} and value ${(values[index] ?? 0).toFixed(3)}, score ${(scores[index] ?? 0).toFixed(3)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { action: index, hidden: [...hidden], scores: shown, rewards: rewards.slice(0, index + 1), values: values.slice(0, index + 1), chosen: -1, policy, temperature },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(scores, chosen),
        edges: [],
        description: `Chosen action ${chosen} with score ${(scores[chosen] ?? 0).toFixed(3)}; policy ${policy.map((p) => p.toFixed(3)).join(", ")}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { action: chosen, hidden: [...hidden], scores, rewards, values, chosen, policy, temperature },
    };
}

/** The MuZero module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "MuZero learns to plan without being told the rules. It compresses the position into a hidden state, imagines how each action changes that state, and predicts the reward and value of the result. A tree search then uses those learned predictions to pick an action. Unlike AlphaZero, no game simulator is needed, because the dynamics are learned from data.",
        invariants: [
            "Applying an action advances the hidden state by that action's learned vector.",
            "The predicted reward and value are dot products of the next hidden state with learned weight vectors.",
            "The chosen action maximizes reward plus gamma times the predicted value.",
        ],
        correctness:
            "The search is exact with respect to the learned model: for each action the next hidden state is computed deterministically, and the one-step backup reward plus gamma times value is evaluated directly. The action with the largest backed-up value is returned, so the procedure correctly solves the one-step planning problem defined by the model. MuZero's full guarantee is that, with enough data and capacity, the learned dynamics and prediction functions approach the true environment so the planned action approaches the optimal one.",
        complexityRationale:
            "Each action needs one vector addition and two dot products over the hidden dimension, costing O(actions * hiddenDim); the policy logits add another dot product per action. The action vectors, policy weights, and score arrays use O(actions * hiddenDim) space.",
        uses: [
            "Planning in games without a known simulator",
            "Model-based reinforcement learning with learned dynamics",
            "A teaching model for latent-space search and prediction",
        ],
        references: [
            "Schrittwieser et al., Mastering Atari, Go, Chess and Shogi by Planning with a Learned Model, 2020",
            "Silver et al., Mastering the game of Go without human knowledge, 2017",
        ],
        workedExample:
            "With hidden (1, 0.5, -0.5), reward weights (1, 0.5, 0), value weights (0.5, 1, 0.2), gamma 0.9, and action vector (1, 0, 0), the next hidden state is (2, 0.5, -0.5), giving reward 2.25 and value 1.4. The score is 2.25 + 0.9 * 1.4 = 3.51; comparing this with the other actions selects the best one.",
    },
    id: "muzero",
    name: "MuZero Latent Search",
    category: "ml-ai",
    complexity: { time: "O(actions * hiddenDim)", space: "O(actions * hiddenDim)" },
    defaultInput: {
        hidden: [1, 0.5, -0.5],
        actions: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        gamma: 0.9,
        rewardWeights: [1, 0.5, 0],
        valueWeights: [0.5, 1, 0.2],
        policyWeights: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        temperature: 1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the hidden state and the learned model weights",
        "for each candidate action",
        "apply learned dynamics to get the next hidden state",
        "predict reward and value from the next hidden state",
        "form the backup score as reward plus gamma times value",
        "record the score for the action",
        "choose the action with the highest score",
        "done: report the chosen action and prediction policy",
    ],
};

export default module;
