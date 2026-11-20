/**
 * policy-iteration.ts - Policy Iteration for Markov Decision Processes
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Policy iteration solves a Markov decision process by repeatedly improving a
 * candidate policy. Policy evaluation computes the value of every state under
 * the current policy by iterating the Bellman expectation equation. Policy
 * improvement then switches each state to the action with the highest action
 * value. Because each improvement makes the policy at least as good, the loop
 * reaches the optimal policy in a finite number of steps for a finite MDP.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * (evaluation steps * S^2 + S^2 * A))
 *   Space: O(S + S * A) for the values and action-value table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows the action value Q(s, a) for each state and action.
 *   - The current policy's action in each row is GREEN; others are YELLOW.
 *   - meta carries state values, the policy, and the iteration count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MDPInput {
    transitions?: number[][][];
    rewards?: number[][][];
    discount?: number;
    policy?: number[];
    theta?: number;
    maxIterations?: number;
}

const DEFAULT_TRANSITIONS = [
    [[1, 0, 0], [0, 1, 0]],
    [[1, 0, 0], [0, 0, 1]],
    [[0, 1, 0], [0, 0, 1]],
];
const DEFAULT_REWARDS = [
    [[0, 0, 0], [5, 5, 5]],
    [[1, 1, 1], [2, 2, 2]],
    [[0, 0, 0], [10, 10, 10]],
];

function makeCells(q: number[][], policy: number[], nS: number, nA: number): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let s = 0; s < nS; s += 1) {
        for (let a = 0; a < nA; a += 1) {
            const value = q[s]?.[a] ?? 0;
            const state: EntityState = policy[s] === a ? "sorted" : "comparing";
            cells.push({
                id: `cell-${s}-${a}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: s, col: a },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MDPInput | null) ?? {};
    const transitions = Array.isArray(task.transitions) ? task.transitions : DEFAULT_TRANSITIONS;
    const rewards = Array.isArray(task.rewards) ? task.rewards : DEFAULT_REWARDS;
    const gamma = typeof task.discount === "number" ? task.discount : 0.9;
    const theta = typeof task.theta === "number" && task.theta > 0 ? task.theta : 1e-8;
    const maxIterations = typeof task.maxIterations === "number" ? Math.max(1, Math.floor(task.maxIterations)) : 50;
    const nS = transitions.length;
    const nA = transitions[0]?.length ?? 0;

    if (nS === 0 || nA === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty Markov decision process: nothing to solve.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: nS, cols: nA, iterations: 0 },
        };
        return;
    }

    const policy: number[] = Array.isArray(task.policy) && task.policy.length === nS
        ? task.policy.map((a) => Math.max(0, Math.min(nA - 1, Math.floor(a))))
        : Array<number>(nS).fill(0);
    const V = Array<number>(nS).fill(0);

    const actionValue = (s: number, a: number, values: number[]): number => {
        let sum = 0;
        const probs = transitions[s]?.[a] ?? [];
        const rew = rewards[s]?.[a] ?? [];
        for (let next = 0; next < nS; next += 1) {
            sum += (probs[next] ?? 0) * ((rew[next] ?? 0) + gamma * (values[next] ?? 0));
        }
        return sum;
    };
    const qTable = (values: number[]): number[][] =>
        Array.from({ length: nS }, (_, s) => Array.from({ length: nA }, (_, a) => actionValue(s, a, values)));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(qTable(V), policy, nS, nA),
        edges: [],
        description: `Policy iteration on ${nS} state(s) and ${nA} action(s), discount ${gamma}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: nS, cols: nA, V: [...V], policy: [...policy], iteration: 0 },
    };
    step += 1;

    let stable = false;
    let iteration = 0;
    while (!stable && iteration < maxIterations) {
        iteration += 1;

        for (let evalStep = 0; evalStep < 1000; evalStep += 1) {
            let delta = 0;
            for (let s = 0; s < nS; s += 1) {
                const updated = actionValue(s, policy[s] ?? 0, V);
                delta = Math.max(delta, Math.abs(updated - (V[s] ?? 0)));
                V[s] = updated;
            }
            if (delta < theta) {
                break;
            }
        }

        const q = qTable(V);
        yield {
            stepNumber: step,
            entities: makeCells(q, policy, nS, nA),
            edges: [],
            description: `Iteration ${iteration}: evaluated policy, then improved actions from the action values.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: nS,
                cols: nA,
                V: [...V],
                policy: [...policy],
                q: q.flat(),
                iteration,
            },
        };
        step += 1;

        const nextPolicy = Array<number>(nS).fill(0);
        for (let s = 0; s < nS; s += 1) {
            let bestValue = -Infinity;
            let bestAction = 0;
            for (let a = 0; a < nA; a += 1) {
                const value = q[s]?.[a] ?? -Infinity;
                if (value > bestValue) {
                    bestValue = value;
                    bestAction = a;
                }
            }
            nextPolicy[s] = bestAction;
        }
        stable = nextPolicy.every((a, s) => a === policy[s]);
        for (let s = 0; s < nS; s += 1) {
            policy[s] = nextPolicy[s] ?? 0;
        }
    }

    const finalQ = qTable(V);
    yield {
        stepNumber: step,
        entities: makeCells(finalQ, policy, nS, nA),
        edges: [],
        description: `Converged after ${iteration} iteration(s) with state values ${V.map((v) => v.toFixed(3)).join(", ")}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: nS,
            cols: nA,
            V: [...V],
            policy: [...policy],
            q: finalQ.flat(),
            iteration,
            stable,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A policy is a rule saying which action to take in each state. Policy iteration alternates two jobs: first work out how good the current rule is by repeatedly applying the Bellman equation, then improve the rule by choosing whichever action looks best given those values. Each improvement is at least as good as the old rule, and with finitely many rules the process must stop at the best one.",
        invariants: [
            "Policy evaluation converges to the exact value of the current policy.",
            "Each policy improvement chooses an action that maximizes the action value.",
            "State values never decrease from one policy improvement to the next.",
        ],
        correctness:
            "Policy evaluation solves the linear Bellman expectation system for the fixed policy, so its values are exact. The improvement step makes each state greedy with respect to those values, which cannot reduce any state's value by the policy improvement theorem. Because a finite MDP has finitely many deterministic policies and value strictly increases unless the policy is unchanged, the loop terminates at a policy that is greedy with respect to its own value, which is optimal.",
        complexityRationale:
            "Each evaluation sweep visits every state-action pair, costing O(S^2 A), and improvement scans the same table. With a bounded number of policy improvements, time is polynomial in the number of states and actions, and storage is O(S + S A) for values and action values.",
        uses: [
            "Solving small fully known reinforcement-learning problems",
            "Finding optimal maintenance and replacement policies",
            "A baseline for comparing approximate reinforcement-learning methods",
        ],
        references: [
            "Howard, Dynamic Programming and Markov Processes, 1960",
            "Bellman, Dynamic Programming, 1957",
            "Sutton and Barto, Reinforcement Learning: An Introduction, Chapter 4",
        ],
        workedExample:
            "In a three-state grid world, staying put gives a small reward while moving toward a terminal state gives a larger one. Starting with the policy that always stays, evaluation gives low values; improvement switches states to the rewarding moves. A second evaluation and improvement leaves the policy unchanged, so the loop stops with the optimal actions.",
    },
    id: "policy-iteration",
    name: "Policy Iteration",
    category: "dynamic-programming",
    complexity: { time: "O(iterations * S^2 * A)", space: "O(S * A)" },
    defaultInput: { transitions: DEFAULT_TRANSITIONS, rewards: DEFAULT_REWARDS, discount: 0.9 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize a policy and state values to zero",
        "policy evaluation: apply the Bellman expectation equation repeatedly",
        "stop evaluating when the largest value change is tiny",
        "compute the action value of every state-action pair",
        "policy improvement: pick the best action in each state",
        "if the policy did not change, the optimum is reached",
        "otherwise repeat evaluation and improvement",
        "done: report the optimal values and policy",
    ],
};

export default module;
