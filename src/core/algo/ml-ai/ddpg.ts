/**
 * ddpg.ts - Deep Deterministic Policy Gradient Update (Toy Linear Critic)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DDPG learns a deterministic policy mu(s) together with a critic Q(s, a).
 * A replayed transition supplies the critic target r + gamma * Q_target(s',
 * mu_target(s')). The actor is then updated by following the gradient of Q
 * with respect to the action, and the target networks are moved slowly toward
 * the online networks. A linear Q and policy make one full update exact and
 * easy to verify.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * features) for the critic and actor gradients
 *   Space: O(features) for the online and target parameters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the critic weights, the actor parameter, Q, and the target.
 *   - The bar for the value just computed is highlighted each step.
 *   - Meta records every online and target parameter after the update.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DdpgInput {
    state?: number;
    nextState?: number;
    reward?: number;
    gamma?: number;
    criticRate?: number;
    actorRate?: number;
    tau?: number;
    steps?: number;
    w?: number[];
    theta?: number;
}

/** A linear critic Q(s, a) = w0 * a + w1 * s. */
function qValue(w: number[], action: number, state: number): number {
    return (w[0] ?? 0) * action + (w[1] ?? 0) * state;
}

function makeBars(values: number[], labels: string[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${labels[index]}=${value.toFixed(3)}`,
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, series: labels[index] ?? "" },
    }));
}

/** The DDPG generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DdpgInput | null) ?? {};
    const state = typeof task.state === "number" ? task.state : 1;
    const nextState = typeof task.nextState === "number" ? task.nextState : 0.8;
    const reward = typeof task.reward === "number" ? task.reward : 1;
    const gamma = typeof task.gamma === "number" ? Math.min(1, Math.max(0, task.gamma)) : 0.9;
    const criticRate = typeof task.criticRate === "number" && task.criticRate > 0 ? task.criticRate : 0.1;
    const actorRate = typeof task.actorRate === "number" && task.actorRate > 0 ? task.actorRate : 0.1;
    const tau = typeof task.tau === "number" ? Math.min(1, Math.max(0, task.tau)) : 0.05;
    const steps = typeof task.steps === "number" ? Math.max(0, Math.floor(task.steps)) : 8;

    const w = Array.isArray(task.w) && task.w.length >= 2 ? [task.w[0] ?? 0, task.w[1] ?? 0] : [0.5, 0.2];
    const wTarget = [...w];
    let theta = typeof task.theta === "number" ? task.theta : 0.3;
    let thetaTarget = theta;

    const labels = ["w0", "w1", "theta", "Q", "target"];
    const snapshot = (active: number, q: number, y: number) =>
        makeBars([w[0] ?? 0, w[1] ?? 0, theta, q, y], labels, active);

    let step = 0;
    yield {
        stepNumber: step,
        entities: snapshot(-1, qValue(w, theta * state, state), 0),
        edges: [],
        description: `DDPG linear-critic setup with ${steps} update(s), gamma ${gamma}, and target rate ${tau}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, w: [...w], wTarget: [...wTarget], theta, thetaTarget, q: 0, y: 0, action: 0 },
    };
    step += 1;

    for (let iteration = 1; iteration <= steps; iteration += 1) {
        const action = theta * state;
        const q = qValue(w, action, state);
        const targetAction = thetaTarget * nextState;
        const y = reward + gamma * qValue(wTarget, targetAction, nextState);
        const error = y - q;

        w[0] = (w[0] ?? 0) + criticRate * error * action;
        w[1] = (w[1] ?? 0) + criticRate * error * state;
        theta += actorRate * (w[0] ?? 0) * state;

        wTarget[0] = tau * (w[0] ?? 0) + (1 - tau) * (wTarget[0] ?? 0);
        wTarget[1] = tau * (w[1] ?? 0) + (1 - tau) * (wTarget[1] ?? 0);
        thetaTarget = tau * theta + (1 - tau) * thetaTarget;

        yield {
            stepNumber: step,
            entities: snapshot(3, q, y),
            edges: [],
            description: `Step ${iteration}: action ${action.toFixed(3)}, Q ${q.toFixed(4)}, target ${y.toFixed(4)}, TD error ${error.toFixed(4)}; critic, actor, and targets updated.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { step: iteration, w: [...w], wTarget: [...wTarget], theta, thetaTarget, q, y, action, error },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: snapshot(2, qValue(w, theta * state, state), 0),
        edges: [],
        description: `Final policy action ${(theta * state).toFixed(4)} with critic weights (${(w[0] ?? 0).toFixed(3)}, ${(w[1] ?? 0).toFixed(3)}).`,
        codeLineNumber: 7,
        layout: "array",
        meta: { step: steps, w: [...w], wTarget: [...wTarget], theta, thetaTarget, q: qValue(w, theta * state, state), y: 0, action: theta * state },
    };
}

/** The DDPG module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "DDPG is an actor-critic method for continuous actions. The critic scores the action the actor currently proposes, while a slowly changing target network supplies a stable learning goal. The actor then changes its parameters in the direction that increases the critic's score, so the two networks chase each other toward a good deterministic policy.",
        invariants: [
            "The actor emits the deterministic action mu(s) = theta times s.",
            "The critic target uses the target networks on the next state, not the online networks.",
            "Each target parameter is a convex combination of its online value and its previous target value.",
        ],
        correctness:
            "The critic performs a stochastic gradient step on the squared Bellman error (Q(s,a) - y)^2, whose gradient with respect to Q is twice the temporal-difference error; the update here uses a half-sized learning rate so it is a standard gradient step. The actor applies the deterministic policy gradient, which the policy gradient theorem reduces to the gradient of Q with respect to the action times the gradient of the action with respect to its parameters. Soft target updates keep the bootstrapped target nearly fixed within a step, giving the stability DDPG needs.",
        complexityRationale:
            "With a linear critic the gradient computations are constant time in the number of features, so a step costs O(features) and a run costs O(steps * features). Online and target parameters use O(features) space.",
        uses: [
            "Continuous control such as robotic locomotion and manipulation",
            "Deterministic policy learning in simulated physics tasks",
            "A foundation for later algorithms such as TD3 and SAC",
        ],
        references: [
            "Lillicrap et al., Continuous Control with Deep Reinforcement Learning, 2015",
            "Sutton and Barto, Reinforcement Learning: An Introduction, Chapter 13",
        ],
        workedExample:
            "With state 1, reward 1, gamma 0.9, w = (0.5, 0.2), theta = 0.3, the first action is 0.3 and Q is 0.21. With identical targets the TD error is 1 + 0.9 * 0.21 - 0.21 = 0.969, so the critic weights rise, the actor parameter grows by actorRate times w0 times state, and the targets drift toward the online values by the small factor tau.",
    },
    id: "ddpg",
    name: "Deep Deterministic Policy Gradient",
    category: "ml-ai",
    complexity: { time: "O(steps * features)", space: "O(features)" },
    defaultInput: { state: 1, nextState: 0.8, reward: 1, gamma: 0.9, criticRate: 0.1, actorRate: 0.1, tau: 0.05, steps: 8, w: [0.5, 0.2], theta: 0.3 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize online and target critic weights and actor parameter",
        "for each replayed update step",
        "form the action as theta times the current state",
        "set the target to reward plus gamma times target critic at the target action",
        "step the critic weights by critic rate times TD error times state features",
        "step the actor by actor rate times the critic gradient through the action",
        "move each target parameter toward its online parameter by tau",
        "done: report the final actor parameter and critic weights",
    ],
};

export default module;
