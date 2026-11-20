/**
 * deep-q-network.ts - One Deep Q-Network Bellman Update (Toy Linear Q)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A deep Q-network learns an action-value function Q(s, a) by regressing it
 * toward a Bellman target r + gamma * max over next actions of a target
 * network's Q values. This teaching model replaces the convolutional network
 * with a linear function approximator Q(s, a) = w dot phi(s, a), so a single
 * experience-replay update can be shown and checked exactly: compute the
 * target, form the squared temporal-difference error, and take one gradient
 * step. It is not a full DQN: no replay buffer, target-network synchronization,
 * or nonlinear network is implemented.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(A * d) for A actions and feature dimension d
 *   Space: O(A * d) for the stored state features
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show Q(s, a) for each action plus the Bellman target.
 *   - Colors mark the chosen action, the target, and the post-update values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vector = number[];

interface Input {
    w?: Vector;
    phiS?: Vector[];
    phiSPrime?: Vector[];
    action?: number;
    reward?: number;
    gamma?: number;
    lr?: number;
    done?: boolean;
}

const dot = (a: Vector, b: Vector): number => {
    let total = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
        total += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return total;
};

function makeBars(qValues: number[], target: number, phase: string, chosen: number): VisualEntity[] {
    const entities: VisualEntity[] = qValues.map((q, a) => ({
        id: `bar-q-${a}`,
        type: "bar" as const,
        label: a === chosen ? `Q(a${a})*` : `Q(a${a})`,
        value: q,
        state: (a === chosen ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: a, action: a, q, phase },
    }));
    entities.push({
        id: "bar-target",
        type: "bar",
        label: "target",
        value: target,
        state: "pivot",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: qValues.length, target, phase },
    });
    return entities;
}

/** The toy DQN update generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const w = (task.w ?? [0.5, -0.2, 0.1]).slice();
    const phiS: Vector[] = task.phiS ?? [
        [1, 0, 1],
        [0, 1, 1],
    ];
    const phiSPrime: Vector[] = task.phiSPrime ?? [
        [1, 0, 1],
        [0, 1, 1],
    ];
    const action = typeof task.action === "number" ? task.action : 0;
    const reward = typeof task.reward === "number" ? task.reward : 1;
    const gamma = typeof task.gamma === "number" ? task.gamma : 0.9;
    const lr = typeof task.lr === "number" ? task.lr : 0.1;
    const done = task.done === true;

    const qS = phiS.map((phi) => dot(w, phi));
    const qSPrime = phiSPrime.map((phi) => dot(w, phi));
    const bestNext = qSPrime.length > 0 ? Math.max(...qSPrime) : 0;
    const target = reward + (done ? 0 : gamma * bestNext);
    const qTaken = qS[action] ?? 0;
    const tdError = target - qTaken;
    const loss = tdError * tdError;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(qS, 0, "init", action),
        edges: [],
        description: `Toy Q-network: ${phiS.length} actions, ${w.length} features. Q(s, a) = w dot phi(s, a).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { qValues: qS, target: 0, tdError: 0, loss: 0, done },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(qS, target, "target", action),
        edges: [],
        description: `Chosen action a${action}: Q = ${qTaken.toFixed(4)}. Next-state best Q = ${bestNext.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { qValues: qS, target, tdError, loss, done, bestNext },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(qS, target, "error", action),
        edges: [],
        description: `Bellman target = ${reward} + ${gamma} * ${bestNext.toFixed(4)} = ${target.toFixed(4)}; TD error = ${tdError.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { qValues: qS, target, tdError, loss, done },
    };
    step += 1;

    const phiTaken = phiS[action] ?? new Array<number>(w.length).fill(0);
    for (let d = 0; d < w.length; d += 1) {
        const grad = -2 * tdError * (phiTaken[d] ?? 0);
        w[d] = (w[d] ?? 0) - lr * grad;
    }
    const qAfter = phiS.map((phi) => dot(w, phi));
    const newTd = target - (qAfter[action] ?? 0);
    yield {
        stepNumber: step,
        entities: makeBars(qAfter, target, "update", action),
        edges: [],
        description: `Gradient step: Q(a${action}) moved to ${(qAfter[action] ?? 0).toFixed(4)}; squared error ${loss.toFixed(4)} to ${(newTd * newTd).toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { qValues: qAfter, target, tdError: newTd, loss: newTd * newTd, done, weight: w.slice() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(qAfter, target, "done", action),
        edges: [],
        description: `Done: one replay update moved Q(a${action}) toward the target. Full DQN adds replay, a target network, and a nonlinear Q network.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { qValues: qAfter, target, tdError: newTd, loss: newTd * newTd, done, weight: w.slice() },
    };
}

/** The toy DQN module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Q-learning assigns a score to taking each action in a state. The score should equal the immediate reward plus the discounted best score achievable from the next state. A deep Q-network approximates that score with a neural network and nudges it toward this Bellman target after each experience. This toy uses a linear approximator so the whole update is visible.",
        invariants: [
            "The Bellman target is the reward plus gamma times the maximum next-state Q, or just the reward for a terminal transition.",
            "The temporal-difference error is the target minus the Q value of the action actually taken.",
            "One gradient step moves Q(s, a) in the direction that reduces the squared TD error.",
        ],
        correctness:
            "For a linear Q function the gradient of the squared TD error with respect to w is minus two times the TD error times the state-action feature vector. Subtracting the learning rate times that gradient changes the predicted Q in the direction of the target. Recomputing the target from the stored features reproduces the Bellman equation exactly; the loss after the step is no larger than before for a suitable learning rate.",
        complexityRationale:
            "Computing Q for each of A actions costs O(A * d), and the single gradient step is O(d), so the update is O(A * d) time. Storing the feature vectors for one transition uses O(A * d) space.",
        uses: [
            "A teaching model for value-based reinforcement learning",
            "The Bellman update at the heart of Q-learning and DQN",
            "A stepping stone to replay buffers and target networks",
        ],
        references: [
            "Mnih et al., Playing Atari with Deep Reinforcement Learning, 2013",
            "Sutton and Barto, Reinforcement Learning: An Introduction, Chapter 6, 2018",
        ],
        workedExample:
            "With weight (0.5, -0.2, 0.1), the chosen action has Q = 0.6 and the next state's best Q is also 0.6. With reward 1 and gamma 0.9 the target is 1.54, so the TD error is 0.94. A learning rate of 0.1 raises Q(a0) to about 0.976 and cuts the squared error from 0.884 to about 0.318.",
    },
    id: "deep-q-network",
    name: "Deep Q-Network Update (Toy)",
    category: "ml-ai",
    complexity: { time: "O(A * d)", space: "O(A * d)" },
    defaultInput: {
        w: [0.5, -0.2, 0.1],
        phiS: [
            [1, 0, 1],
            [0, 1, 1],
        ],
        phiSPrime: [
            [1, 0, 1],
            [0, 1, 1],
        ],
        action: 0,
        reward: 1,
        gamma: 0.9,
        lr: 0.1,
        done: false,
    },
    visualType: "array",
    run,
    pseudocode: [
        "store a transition with state, action, reward, and next state",
        "compute Q for the current state under the online weights",
        "compute the maximum Q for the next state under the target weights",
        "set the Bellman target to reward plus discounted best next Q",
        "form the squared temporal-difference error",
        "take one gradient step on the squared error",
        "recompute the Q values under the updated weights",
        "compare the new squared error with the old one",
        "done: report the updated Q values and loss",
    ],
};

export default module;
