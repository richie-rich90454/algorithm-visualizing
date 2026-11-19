/**
 * sarsa.ts - SARSA: On-Policy Temporal-Difference Control
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SARSA learns action values from the tuple (state, action, reward, next state,
 * next action). It moves the value of the action taken toward the reward plus
 * the discounted value of the action actually taken next. Because the next
 * action comes from the current policy, SARSA is an on-policy method and its
 * values reflect exploration, unlike Q-learning's off-policy max.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(transitions) for one constant-time update each
 *   Space: O(states * actions) for the Q table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows Q values: rows are states, columns are actions.
 *   - The cell being updated is highlighted; visited cells turn green.
 *   - Meta records Q and the full five-tuple of the transition.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Transition = [number, number, number, number, number];
interface SarsaInput {
    numStates?: number;
    numActions?: number;
    transitions?: Transition[];
    alpha?: number;
    gamma?: number;
}

function makeCells(q: number[], states: number, actions: number, active: number, seen: Set<number>): VisualEntity[] {
    return q.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: value.toFixed(2),
        value,
        state: (index === active ? "active" : seen.has(index) ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(index / actions), col: index % actions, index },
    }));
}

/** The SARSA generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SarsaInput | null) ?? {};
    const numStates = typeof task.numStates === "number" ? Math.max(1, Math.floor(task.numStates)) : 4;
    const numActions = typeof task.numActions === "number" ? Math.max(1, Math.floor(task.numActions)) : 2;
    const alpha = typeof task.alpha === "number" ? Math.min(1, Math.max(0, task.alpha)) : 0.5;
    const gamma = typeof task.gamma === "number" ? Math.min(1, Math.max(0, task.gamma)) : 0.9;
    const transitions: Transition[] = Array.isArray(task.transitions) && task.transitions.length > 0
        ? task.transitions.map((t) => [t[0], t[1], t[2], t[3], t[4]])
        : [[0, 0, 0, 1, 1], [1, 1, 0, 2, 0], [2, 0, 1, 3, 1]];

    const q = Array.from({ length: numStates * numActions }, () => 0);
    const seen = new Set<number>();

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(q, numStates, numActions, -1, seen),
        edges: [],
        description: `SARSA on ${numStates} states and ${numActions} actions over ${transitions.length} transition(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: numStates, cols: numActions, q: [...q], transition: [], step: 0 },
    };
    step += 1;

    for (let index = 0; index < transitions.length; index += 1) {
        const [s, a, r, sp, ap] = transitions[index] ?? [0, 0, 0, 0, 0];
        const indexSa = s * numActions + a;
        const next = sp * numActions + ap;
        const target = r + gamma * (q[next] ?? 0);
        q[indexSa] = (q[indexSa] ?? 0) + alpha * (target - (q[indexSa] ?? 0));
        seen.add(indexSa);

        yield {
            stepNumber: step,
            entities: makeCells(q, numStates, numActions, indexSa, seen),
            edges: [],
            description: `Transition ${index + 1}: (${s}, ${a}, ${r}, ${sp}, ${ap}), target ${target.toFixed(3)}, Q(${s},${a}) now ${(q[indexSa] ?? 0).toFixed(3)}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: numStates, cols: numActions, q: [...q], transition: [s, a, r, sp, ap], nextValue: q[next] ?? 0, target, step: index + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(q, numStates, numActions, -1, seen),
        edges: [],
        description: `Final SARSA Q table after ${transitions.length} on-policy updates.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: numStates, cols: numActions, q: [...q], transition: [], step: transitions.length },
    };
}

/** The SARSA module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "SARSA learns from what actually happens. The name is the sequence state, action, reward, next state, next action: after taking an action and seeing where it lands, the agent also observes which action it will really take next. It updates the current action's value toward that real continuation, so the learned values account for the agent's own exploratory behavior.",
        invariants: [
            "Every update uses the value of the action actually taken in the next state.",
            "Values move toward reward plus gamma times that next action value.",
            "Each real transition produces exactly one update to one table entry.",
        ],
        correctness:
            "SARSA is a stochastic approximation to the Bellman evaluation equation for the policy being followed. Because the backup uses Q(s', a') with a' drawn from the current policy, the update converges to the action-value function of that policy, including its exploration. This is the on-policy counterpart of Q-learning, which instead backs up the maximum and therefore learns the greedy policy regardless of exploration.",
        complexityRationale:
            "Each transition does one table lookup and one constant-time update, so the total time is O(transitions). The Q table holds one value per state-action pair, needing O(states * actions) space.",
        uses: [
            "On-policy control where the learned policy must reflect exploration",
            "Safety-sensitive reinforcement learning that values exploratory behavior",
            "A canonical example contrasting on-policy and off-policy learning",
        ],
        references: [
            "Rummery and Niranjan, On-Line Q-Learning Using Connectionist Systems, 1994",
            "Sutton and Barto, Reinforcement Learning: An Introduction, Chapter 6",
        ],
        workedExample:
            "With gamma 0.9, alpha 0.5, and a transition (state 0, action 0, reward 0, next state 1, next action 1), if Q(1,1) is 1 then the target is 0.9 and Q(0,0) moves from 0 to 0.45. If the next action had instead been the exploratory action 0 with a lower value, the update would have been smaller, which is exactly the on-policy difference.",
    },
    id: "sarsa",
    name: "SARSA",
    category: "ml-ai",
    complexity: { time: "O(transitions)", space: "O(states * actions)" },
    defaultInput: {
        numStates: 4,
        numActions: 2,
        transitions: [[0, 0, 0, 1, 1], [1, 1, 0, 2, 0], [2, 0, 1, 3, 1]],
        alpha: 0.5,
        gamma: 0.9,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the Q table to zero for every state and action",
        "for each observed transition",
        "read the value of the action taken in the next state",
        "form the target as reward plus gamma times that next action value",
        "move Q of the current action toward the target by alpha",
        "mark the updated cell as visited",
        "done: report the final Q table",
    ],
};

export default module;
