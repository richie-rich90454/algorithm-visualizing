/**
 * policy-gradient-reinforce.ts - REINFORCE on a One-Step Bandit
 *
 * A softmax policy chooses one of several actions from a fixed draw, receives
 * that action's reward, and updates its logits with the REINFORCE gradient of
 * the log policy times the return. An optional mean baseline reduces variance.
 * The deterministic draws make every episode reproducible.
 *
 * Time:  O(episodes * actions)
 * Space: O(actions) for the policy plus O(episodes * actions) for the trace
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ReinforceInput {
    theta?: number[];
    rewards?: number[];
    draws?: number[];
    learningRate?: number;
    baseline?: boolean;
}

/** Softmax probabilities for a vector of logits. */
function softmax(theta: number[]): number[] {
    const max = Math.max(...theta);
    const exp = theta.map((t) => Math.exp(t - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map((e) => e / sum);
}

/** Turn a unit draw into an action index using the cumulative distribution. */
function chooseAction(probs: number[], draw: number): number {
    let cumulative = 0;
    for (let i = 0; i < probs.length; i += 1) {
        cumulative += probs[i] ?? 0;
        if (draw < cumulative) {
            return i;
        }
    }
    return probs.length - 1;
}

function makeBars(probs: number[], chosen: number): VisualEntity[] {
    return probs.map((p, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: `a${i}=${p.toFixed(3)}`,
        value: p,
        state: (i === chosen ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, action: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ReinforceInput | null) ?? {};
    const theta = Array.isArray(task.theta) ? [...task.theta] : [0, 0, 0];
    const rewards = Array.isArray(task.rewards) ? [...task.rewards] : [1, 0, -1];
    const draws = Array.isArray(task.draws) ? [...task.draws] : [0.2, 0.6, 0.9, 0.3, 0.7];
    const learningRate =
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.3;
    const useBaseline = task.baseline !== false;
    const actions = Math.min(theta.length, rewards.length);
    const thetaVec = theta.slice(0, actions);
    const rewardVec = rewards.slice(0, actions);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(softmax(thetaVec), -1),
        edges: [],
        description: `REINFORCE with ${actions} actions for ${draws.length} episode(s); baseline ${useBaseline ? "on" : "off"}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { episode: 0, theta: [...thetaVec], probs: softmax(thetaVec), chosen: -1, return: 0 },
    };
    step += 1;

    for (let e = 0; e < draws.length; e += 1) {
        const probs = softmax(thetaVec);
        const chosen = chooseAction(probs, draws[e] ?? 0);
        const baseline = useBaseline
            ? rewardVec.reduce((a, b) => a + b, 0) / rewardVec.length
            : 0;
        const G = (rewardVec[chosen] ?? 0) - baseline;
        for (let a = 0; a < actions; a += 1) {
            thetaVec[a] = (thetaVec[a] ?? 0) + learningRate * G * ((a === chosen ? 1 : 0) - (probs[a] ?? 0));
        }
        yield {
            stepNumber: step,
            entities: makeBars(softmax(thetaVec), chosen),
            edges: [],
            description: `Episode ${e + 1}: action ${chosen} drew reward ${rewardVec[chosen]}, return ${G.toFixed(3)}; logits updated.`,
            codeLineNumber: 4,
            layout: "array",
            meta: {
                episode: e + 1,
                theta: [...thetaVec],
                probs: softmax(thetaVec),
                chosen,
                reward: rewardVec[chosen],
                baseline,
                return: G,
            },
        };
        step += 1;
    }

    const finalProbs = softmax(thetaVec);
    yield {
        stepNumber: step,
        entities: makeBars(finalProbs, -1),
        edges: [],
        description: `Final policy probabilities: ${finalProbs.map((p) => p.toFixed(3)).join(", ")}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { episode: draws.length, theta: [...thetaVec], probs: finalProbs },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "REINFORCE learns a policy directly. It samples an action from the current softmax distribution, observes the reward, and increases the log probability of actions that led to high returns while decreasing the others. Subtracting an average-reward baseline keeps the update direction the same in expectation but makes learning less noisy.",
        invariants: [
            "Action probabilities are a softmax of the logits and always sum to one.",
            "The update is the learning rate times the return times the gradient of the log policy.",
            "A constant baseline does not bias the expected gradient.",
        ],
        correctness:
            "For a softmax policy the gradient of log pi(a) with respect to logit b is the indicator that b is the chosen action minus pi(b). REINFORCE multiplies this by the sampled return, giving an unbiased estimate of the gradient of expected return; subtracting a baseline that does not depend on the action preserves the expectation because the log-policy gradients sum to zero over actions.",
        complexityRationale:
            "Each episode computes one softmax and one update over the action set, costing O(actions); episodes are independent. The policy plus the reported trace use O(actions * episodes) space.",
        uses: [
            "Policy-based reinforcement learning on discrete action spaces",
            "A building block of actor-critic methods",
            "Bandit problems and simple episodic control tasks",
        ],
        references: [
            "Williams, Simple Statistical Gradient-Following Algorithms, 1992",
            "Sutton and Barto, Reinforcement Learning: An Introduction, Chapter 13",
        ],
        workedExample:
            "With three logits at zero and rewards (1, 0, -1), a baseline of zero and a draw of 0.2 selects action 0 with probability 1/3 and reward 1. The update adds 0.3 * 1 * (1 - 1/3) = 0.2 to logit 0 and subtracts 0.3 * 1 * (1/3) = 0.1 from the others, making action 0 more likely next time.",
    },
    id: "policy-gradient-reinforce",
    name: "Policy Gradient (REINFORCE)",
    category: "ml-ai",
    complexity: { time: "O(episodes * actions)", space: "O(episodes * actions)" },
    defaultInput: {
        theta: [0, 0, 0],
        rewards: [1, 0, -1],
        draws: [0.2, 0.6, 0.9, 0.3, 0.7],
        learningRate: 0.3,
        baseline: true,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize policy logits for each action",
        "for each episode use the supplied draw to sample an action",
        "read the sampled action's reward and optional mean baseline",
        "form the return as reward minus baseline",
        "for each logit add learning rate times return times indicator minus probability",
        "record the updated policy after the episode",
        "done: report the final action probabilities",
    ],
};

export default module;
