/**
 * soft-actor-critic.ts - Soft Actor-Critic on a Single State
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Soft actor-critic (SAC) is a maximum-entropy actor-critic method. The critic
 * learns soft action values; the soft value of a state is the log-sum-exp of
 * its Q values, which rewards policies that keep high entropy. The actor is a
 * Boltzmann policy whose probability for an action is proportional to
 * exp(Q / temperature). This toy uses one state with rewards on each action,
 * so the exact fixed point and every intermediate value can be checked.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * actions)
 *   Space: O(actions) for Q values and policy
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per action shows its current soft Q value.
 *   - The greedy action bar is highlighted.
 *   - Meta records the policy, soft value, and temperature of each iteration.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SacInput {
    rewards?: number[];
    temperature?: number;
    gamma?: number;
    learningRate?: number;
    iterations?: number;
}

/** Soft value V = temperature * log sum_a exp(Q_a / temperature). */
function softValue(q: number[], temperature: number): number {
    const scaled = q.map((value) => value / temperature);
    const max = Math.max(...scaled);
    const sum = scaled.reduce((acc, value) => acc + Math.exp(value - max), 0);
    return temperature * (max + Math.log(sum));
}

/** Boltzmann policy pi(a) proportional to exp(Q_a / temperature). */
function policy(q: number[], temperature: number): number[] {
    const scaled = q.map((value) => value / temperature);
    const max = Math.max(...scaled);
    const exp = scaled.map((value) => Math.exp(value - max));
    const sum = exp.reduce((acc, value) => acc + value, 0);
    return exp.map((value) => value / sum);
}

function makeBars(q: number[], greedy: number): VisualEntity[] {
    return q.map((value, index) => ({
        id: `action-${index}`,
        type: "bar" as const,
        label: `a${index} Q=${value.toFixed(3)}`,
        value,
        state: (index === greedy ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, action: index },
    }));
}

/** The soft actor-critic generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SacInput | null) ?? {};
    const rewards = Array.isArray(task.rewards) && task.rewards.length > 0 ? [...task.rewards] : [1, 0, -1, 0.5];
    const temperature = typeof task.temperature === "number" && task.temperature > 0 ? task.temperature : 1;
    const gamma = typeof task.gamma === "number" ? Math.min(1, Math.max(0, task.gamma)) : 0.9;
    const learningRate =
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.2;
    const iterations = typeof task.iterations === "number" ? Math.max(0, Math.floor(task.iterations)) : 12;

    const q = rewards.map(() => 0);
    let step = 0;
    const greedyOf = (values: number[]) => values.indexOf(Math.max(...values));

    yield {
        stepNumber: step,
        entities: makeBars(q, -1),
        edges: [],
        description: `Soft actor-critic on ${rewards.length} actions for ${iterations} iteration(s) with temperature ${temperature}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, rewards: [...rewards], q: [...q], policy: policy(q, temperature), softValue: softValue(q, temperature), temperature },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const value = softValue(q, temperature);
        const next = q.map((current, index) => current + learningRate * ((rewards[index] ?? 0) + gamma * value - current));
        for (let index = 0; index < q.length; index += 1) {
            q[index] = next[index] ?? 0;
        }
        const pi = policy(q, temperature);
        yield {
            stepNumber: step,
            entities: makeBars(q, greedyOf(q)),
            edges: [],
            description: `Iteration ${iteration}: soft value ${value.toFixed(4)}, updated every Q toward reward plus gamma times soft value.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { iteration, q: [...q], policy: pi, softValue: softValue(q, temperature), temperature, greedy: greedyOf(q) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(q, greedyOf(q)),
        edges: [],
        description: `Final Boltzmann policy: ${policy(q, temperature).map((p) => p.toFixed(3)).join(", ")}; soft value ${softValue(q, temperature).toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { iteration: iterations, q: [...q], policy: policy(q, temperature), softValue: softValue(q, temperature), temperature, greedy: greedyOf(q) },
    };
}

/** The soft actor-critic module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Soft actor-critic does not just chase the highest reward, it also rewards staying unpredictable. The critic assigns each action a soft value, and the soft value of a state is a log-sum-exp that grows when several actions look good. The actor then samples actions in proportion to exp of Q divided by a temperature, so exploration is built into the objective rather than added as a trick.",
        invariants: [
            "The policy is a softmax of Q divided by the temperature and sums to one.",
            "The soft value equals temperature times the log-sum-exp of Q divided by temperature.",
            "Each critic update moves Q toward reward plus gamma times the soft value of the state.",
        ],
        correctness:
            "The maximum-entropy Bellman operator backs up reward plus gamma times a soft state value V(s) = temperature * log sum exp(Q(s,a)/temperature). It is a contraction for gamma below one, so repeated critic updates converge to the fixed point Q(s,a) = r(a) + gamma V(s) on this single-state problem. At that fixed point the Boltzmann policy exp(Q/temperature) is the optimal maximum-entropy policy, because it is the distribution that maximizes expected Q plus temperature times its entropy.",
        complexityRationale:
            "Each iteration computes a log-sum-exp and a softmax over the action set and updates every action once, costing O(actions); over a fixed number of iterations the time is O(iterations * actions). Q values and the policy need O(actions) space.",
        uses: [
            "Continuous control in robotics with sample-efficient exploration",
            "Reinforcement learning tasks where exploration must be persistent",
            "A teaching model for maximum-entropy reinforcement learning",
        ],
        references: [
            "Haarnoja et al., Soft Actor-Critic: Off-Policy Maximum Entropy Deep Reinforcement Learning, 2018",
            "Haarnoja et al., Soft Actor-Critic Algorithms and Applications, 2019",
        ],
        workedExample:
            "With rewards (1, 0, -1, 0.5), temperature 1, gamma 0.9, and learning rate 0.2, every Q starts at 0 so the first soft value is 1.386. The first update moves Q toward reward plus 1.247, making action 0 the greedy choice; after enough iterations Q approaches the fixed point r(a) plus 0.9 times the soft value.",
    },
    id: "soft-actor-critic",
    name: "Soft Actor-Critic",
    category: "ml-ai",
    complexity: { time: "O(iterations * actions)", space: "O(actions)" },
    defaultInput: { rewards: [1, 0, -1, 0.5], temperature: 1, gamma: 0.9, learningRate: 0.2, iterations: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize every soft Q value to zero",
        "for each training iteration",
        "compute soft value as temperature times log sum exp of Q over temperature",
        "set each policy probability proportional to exp of Q over temperature",
        "form each target as reward plus gamma times the soft value",
        "move Q toward its target by the critic learning rate",
        "record the updated Q values, policy, and soft value",
        "done: report the learned policy and soft value",
    ],
};

export default module;
