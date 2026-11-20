/**
 * actor-critic.ts - Toy One-State Actor-Critic Update
 *
 * A minimal single-state actor-critic demo. The critic learns a scalar state
 * value from the temporal-difference error; the actor nudges its action
 * preferences in the direction of that same error and keeps a softmax policy.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Input {
    rewards?: number[];
    gamma?: number;
    actorStep?: number;
    criticStep?: number;
    steps?: number;
}

function softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exps = logits.map((v) => Math.exp(v - max));
    const total = exps.reduce((a, b) => a + b, 0) || 1;
    return exps.map((v) => v / total);
}

function makeBars(value: number, probs: number[], action: number): VisualEntity[] {
    const bars: VisualEntity[] = [
        {
            id: "value",
            type: "bar",
            label: value.toFixed(2),
            value,
            state: "comparing",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: 0, role: "value" },
        },
    ];
    probs.forEach((prob, index) => {
        bars.push({
            id: `action-${index}`,
            type: "bar",
            label: prob.toFixed(2),
            value: prob,
            state: index === action ? "active" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: index + 1, role: "action" },
        });
    });
    return bars;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const rewards = task.rewards ?? [1, -1];
    const gamma = typeof task.gamma === "number" ? task.gamma : 0.9;
    const actorStep = typeof task.actorStep === "number" && task.actorStep > 0 ? task.actorStep : 0.5;
    const criticStep = typeof task.criticStep === "number" && task.criticStep > 0 ? task.criticStep : 0.1;
    const steps = Math.max(1, Math.floor(typeof task.steps === "number" ? task.steps : 30));
    const logits = new Array<number>(rewards.length).fill(0);
    let probs = softmax(logits);
    let value = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(value, probs, -1),
        edges: [],
        description: `Actor-critic with ${rewards.length} action(s); the critic starts at value zero and the policy is uniform.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, action: -1, reward: 0, delta: 0, value: 0, probSum: 1 },
    };
    step += 1;

    for (let t = 0; t < steps; t += 1) {
        let action = 0;
        for (let i = 1; i < probs.length; i += 1) {
            if ((probs[i] ?? 0) > (probs[action] ?? 0)) {
                action = i;
            }
        }
        const reward = rewards[action] ?? 0;
        const delta = reward + gamma * value - value;
        value += criticStep * delta;
        logits[action] = (logits[action] ?? 0) + actorStep * delta;
        probs = softmax(logits);
        const probSum = probs.reduce((a, b) => a + b, 0);

        yield {
            stepNumber: step,
            entities: makeBars(value, probs, action),
            edges: [],
            description: `Step ${t}: action ${action} gave reward ${reward}, TD error ${delta.toFixed(3)}; value ${value.toFixed(3)}.`,
            codeLineNumber: t === 0 ? 2 : 5,
            layout: "array",
            meta: {
                step: t + 1,
                action,
                reward,
                delta: Number(delta.toFixed(8)),
                value: Number(value.toFixed(8)),
                probSum: Number(probSum.toFixed(8)),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(value, probs, -1),
        edges: [],
        description: `Final value ${value.toFixed(3)} and policy [${probs.map((p) => p.toFixed(3)).join(", ")}].`,
        codeLineNumber: 7,
        layout: "array",
        meta: { step: steps, value: Number(value.toFixed(8)), probs: probs.map((p) => Number(p.toFixed(8))), probSum: Number(probs.reduce((a, b) => a + b, 0).toFixed(8)) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An actor chooses actions while a critic judges how good the current state is. The critic's temporal-difference error measures surprise: when an outcome is better than expected the error is positive. The actor uses that same signal to make the chosen action more likely in the future.",
        invariants: [
            "The TD error equals reward plus gamma times the old value minus the old value.",
            "The critic moves its value estimate by the critic step times the TD error.",
            "The actor updates only the chosen action's logit, and the softmax policy always sums to one.",
        ],
        correctness:
            "This toy has a single state, so the next-state value equals the current value and the TD error simplifies to reward minus (1 - gamma) times value. The critic update is a stochastic approximation to the true value, and adding actorStep times the error to the chosen logit increases its softmax probability whenever the error is positive. Renormalizing by the softmax keeps a valid distribution at every step.",
        complexityRationale:
            "Each step evaluates one action, one scalar update, and a softmax over A actions, costing O(A) time; storing logits, probabilities, and the value uses O(A) space.",
        uses: [
            "Policy gradient methods with a learned baseline",
            "Reinforcement learning agents with separate policy and value networks",
            "A teaching model of the actor-critic update signal",
        ],
        references: [
            "Sutton and Barto, Reinforcement Learning: An Introduction, Chapter 13",
            "Konda and Tsitsiklis, Actor-Critic Algorithms, 1999",
        ],
        workedExample:
            "With one reward of +1 for action zero, gamma 0.9, and value zero, the first TD error is 1, so the critic raises the value to 0.1 and the actor raises action zero's logit by 0.5, making it more likely than action one on the next step.",
    },
    id: "actor-critic",
    name: "Actor-Critic",
    category: "ml-ai",
    complexity: { time: "O(A) per step", space: "O(A)" },
    defaultInput: { rewards: [1, -1], gamma: 0.9, actorStep: 0.5, criticStep: 0.1, steps: 30 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the value and all action logits to zero",
        "for each training step",
        "choose the action with the highest current probability",
        "observe the reward and compute the TD error",
        "update the value by critic step times the TD error",
        "add actor step times the TD error to the chosen action logit",
        "recompute the softmax policy over all actions",
        "done: report the learned value and policy",
    ],
};

export default module;
