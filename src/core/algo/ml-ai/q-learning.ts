/**
 * q-learning.ts - Tabular Q-Learning on a Small State Grid
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Q-learning is a model-free reinforcement learning method that estimates the
 * value of taking each action in each state. After a transition it nudges the
 * chosen action value toward the observed reward plus the discounted best
 * future value. This demo replays a fixed sequence of transitions so the
 * learned table is deterministic and verifiable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(transitions * actions) for one max lookup per transition
 *   Space: O(states * actions) for the Q table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Rows are states, columns are actions, cells hold Q values.
 *   - The cell being updated turns active; previously updated cells are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface QInput {
    transitions?: Array<[number, number, number, number]>;
    numStates?: number;
    numActions?: number;
    alpha?: number;
    gamma?: number;
}

/** One grid cell per state and action pair. */
function makeCells(
    q: number[][],
    updated: Set<string>,
    activeKey: string | null,
    rows: number,
    cols: number,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let state = 0; state < rows; state += 1) {
        for (let action = 0; action < cols; action += 1) {
            const key = `${state}-${action}`;
            let stateName: EntityState = updated.has(key) ? "sorted" : "idle";
            if (key === activeKey) {
                stateName = "active";
            }
            cells.push({
                id: `q-${key}`,
                type: "cell",
                label: (q[state]?.[action] ?? 0).toFixed(2),
                value: Number((q[state]?.[action] ?? 0).toFixed(6)),
                state: stateName,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: state, col: action },
            });
        }
    }
    return cells;
}

/** Replay fixed transitions and update the Q table. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as QInput | null) ?? {};
    const transitions: Array<[number, number, number, number]> = Array.isArray(task.transitions)
        ? task.transitions
        : [
              [0, 1, 0, 1], [1, 1, 0, 2], [2, 1, 0, 3], [3, 1, 0, 4], [4, 1, 1, 6],
              [0, 1, 0, 1], [1, 1, 0, 2], [2, 1, 0, 3], [3, 1, 1, 6],
              [0, 0, 0, 0], [1, 1, 1, 6],
          ];
    const numStates = typeof task.numStates === "number" ? task.numStates : 6;
    const numActions = typeof task.numActions === "number" ? task.numActions : 2;
    const alpha = typeof task.alpha === "number" ? task.alpha : 0.5;
    const gamma = typeof task.gamma === "number" ? task.gamma : 0.9;

    const q: number[][] = Array.from({ length: numStates }, () => new Array<number>(numActions).fill(0));
    const updated = new Set<string>();
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(q, updated, null, numStates, numActions),
        edges: [],
        description: `Q-learning on ${numStates} states and ${numActions} actions with alpha ${alpha} and gamma ${gamma}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: numStates,
            cols: numActions,
            q: q.flat().map((v) => Number(v.toFixed(6))),
            transition: 0,
            reward: 0,
            target: 0,
        },
    };
    step += 1;

    for (let index = 0; index < transitions.length; index += 1) {
        const transition = transitions[index];
        if (!transition) {
            continue;
        }
        const [state, action, reward, nextState] = transition;
        const future =
            nextState >= 0 && nextState < numStates
                ? Math.max(...(q[nextState] ?? [0]))
                : 0;
        const target = reward + gamma * future;
        const oldValue = q[state]?.[action] ?? 0;
        const newValue = oldValue + alpha * (target - oldValue);
        if (q[state] && action >= 0 && action < numActions) {
            q[state][action] = newValue;
        }
        const key = `${state}-${action}`;
        updated.add(key);
        const last = index === transitions.length - 1;
        yield {
            stepNumber: step,
            entities: makeCells(q, updated, key, numStates, numActions),
            edges: [],
            description: `Transition ${index + 1}: state ${state}, action ${action}, reward ${reward}, target ${target.toFixed(3)}, Q becomes ${newValue.toFixed(3)}.`,
            codeLineNumber: last ? 6 : 4,
            layout: "grid",
            meta: {
                rows: numStates,
                cols: numActions,
                q: q.flat().map((v) => Number(v.toFixed(6))),
                transition: index + 1,
                reward,
                target: Number(target.toFixed(6)),
            },
        };
        step += 1;
    }
}

/** The Q-learning module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Q-learning records how good each action is in each state without needing a model of the environment. When a transition happens, it compares the reward actually seen plus the best future value against the current estimate, and moves the estimate a little toward that target. Over many transitions the table converges to the best action values.",
        invariants: [
            "The target for a transition is the immediate reward plus the discount times the best next-state value.",
            "A transition into a terminal state contributes zero future value.",
            "The learning rate controls how far the estimate moves toward the target on each update.",
        ],
        correctness:
            "Under the standard tabular conditions of visiting every state and action indefinitely with a suitable learning rate, the update is a stochastic approximation to the Bellman optimality operator, whose unique fixed point is the optimal action-value function. Each update here is exactly that Bellman target, so replaying enough transitions drives the table toward that fixed point.",
        complexityRationale:
            "Each transition reads the best of the action values for one next state, costing O(actions), and writes one cell, so total time is O(transitions times actions). The Q table stores states times actions numbers, giving O(states times actions) space.",
        uses: [
            "Tabular reinforcement learning in small discrete environments",
            "Teaching the Bellman optimality equation",
            "A baseline for model-free control before moving to deep Q networks",
        ],
        references: [
            "Watkins and Dayan, Q-Learning, 1992",
            "Sutton and Barto, Reinforcement Learning: An Introduction, 2018",
        ],
        workedExample:
            "With all values initially zero, moving from state 4 with action right to a terminal state with reward 1 gives target 1 and sets Q(4, right) to 0.5 when alpha is 0.5. A later replay of that transition uses the same target and raises the value toward 0.75, showing gradual convergence.",
    },
    id: "q-learning",
    name: "Q-Learning",
    category: "ml-ai",
    complexity: { time: "O(transitions * actions)", space: "O(states * actions)" },
    defaultInput: {
        numStates: 6,
        numActions: 2,
        alpha: 0.5,
        gamma: 0.9,
        transitions: [
            [0, 1, 0, 1], [1, 1, 0, 2], [2, 1, 0, 3], [3, 1, 0, 4], [4, 1, 1, 6],
            [0, 1, 0, 1], [1, 1, 0, 2], [2, 1, 0, 3], [3, 1, 1, 6],
            [0, 0, 0, 0], [1, 1, 1, 6],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the Q table to zeros",
        "for each observed transition",
        "find the best Q value in the next state",
        "set target to reward plus discount times that best value",
        "move the chosen Q value toward the target by the learning rate",
        "record the updated table",
        "done: report the learned Q table",
    ],
};

export default module;
