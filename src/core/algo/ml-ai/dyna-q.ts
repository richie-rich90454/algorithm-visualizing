/**
 * dyna-q.ts - Dyna-Q: Direct Reinforcement Plus Model-Based Planning
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dyna-Q interleaves learning from real experience with planning from a learned
 * model. Each real transition updates the Q table and is stored in a model.
 * Planning then replays stored transitions many times, each replay improving Q
 * with the same Bellman update. This blends model-free and model-based learning
 * and makes the table change faster than from real experience alone.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((transitions + planningSteps) * actions) for the max lookups
 *   Space: O(states * actions) for Q plus the stored transitions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows the Q table: rows are states, columns are actions.
 *   - The cell updated by a direct or planning step is highlighted.
 *   - Meta records Q, the phase, and the transition being replayed.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Transition = [number, number, number, number];
interface DynaInput {
    numStates?: number;
    numActions?: number;
    transitions?: Transition[];
    alpha?: number;
    gamma?: number;
    planningSteps?: number;
}

function makeCells(q: number[], states: number, actions: number, active: number): VisualEntity[] {
    return q.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: value.toFixed(2),
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(index / actions), col: index % actions, index },
    }));
}

/** The Dyna-Q generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DynaInput | null) ?? {};
    const numStates = typeof task.numStates === "number" ? Math.max(1, Math.floor(task.numStates)) : 4;
    const numActions = typeof task.numActions === "number" ? Math.max(1, Math.floor(task.numActions)) : 2;
    const alpha = typeof task.alpha === "number" ? Math.min(1, Math.max(0, task.alpha)) : 0.5;
    const gamma = typeof task.gamma === "number" ? Math.min(1, Math.max(0, task.gamma)) : 0.9;
    const planningSteps = typeof task.planningSteps === "number" ? Math.max(0, Math.floor(task.planningSteps)) : 6;
    const transitions: Transition[] = Array.isArray(task.transitions) && task.transitions.length > 0
        ? task.transitions.map((t) => [t[0], t[1], t[2], t[3]])
        : [[0, 0, 0, 1], [1, 1, 0, 2], [2, 0, 1, 3]];

    const q = Array.from({ length: numStates * numActions }, () => 0);
    const model: Transition[] = [];
    const maxNext = (state: number) => {
        let best = 0;
        for (let a = 0; a < numActions; a += 1) {
            best = Math.max(best, q[state * numActions + a] ?? 0);
        }
        return best;
    };
    const applyUpdate = (transition: Transition) => {
        const [s, a, r, sp] = transition;
        if (s < 0 || s >= numStates || a < 0 || a >= numActions) {
            return -1;
        }
        const index = s * numActions + a;
        const target = r + gamma * maxNext(sp);
        q[index] = (q[index] ?? 0) + alpha * (target - (q[index] ?? 0));
        return index;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(q, numStates, numActions, -1),
        edges: [],
        description: `Dyna-Q on ${numStates} states and ${numActions} actions with ${planningSteps} planning step(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: numStates, cols: numActions, q: [...q], phase: "setup", transition: [], step: 0 },
    };
    step += 1;

    for (let index = 0; index < transitions.length; index += 1) {
        const transition = transitions[index];
        if (!transition) {
            continue;
        }
        model.push([...transition]);
        const updated = applyUpdate(transition);
        yield {
            stepNumber: step,
            entities: makeCells(q, numStates, numActions, updated),
            edges: [],
            description: `Direct update ${index + 1}: state ${transition[0]}, action ${transition[1]}, reward ${transition[2]}, next ${transition[3]}; stored in model.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: numStates, cols: numActions, q: [...q], phase: "direct", transition: [...transition], step: index + 1 },
        };
        step += 1;
    }

    for (let iteration = 0; iteration < planningSteps && model.length > 0; iteration += 1) {
        const transition = model[iteration % model.length];
        if (!transition) {
            continue;
        }
        const updated = applyUpdate(transition);
        yield {
            stepNumber: step,
            entities: makeCells(q, numStates, numActions, updated),
            edges: [],
            description: `Planning replay ${iteration + 1}: model transition state ${transition[0]}, action ${transition[1]} improves Q again.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: { rows: numStates, cols: numActions, q: [...q], phase: "planning", transition: [...transition], step: iteration + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(q, numStates, numActions, -1),
        edges: [],
        description: `Final Q table after ${transitions.length} direct and ${planningSteps} planning update(s).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: numStates, cols: numActions, q: [...q], phase: "final", transition: [], step: planningSteps + transitions.length },
    };
}

/** The Dyna-Q module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Dyna-Q gets more out of each experience. After a real transition it updates its Q table and saves the transition in a model. During idle moments it replays saved transitions many times, applying the same update as if they had happened again. Planning with the model makes the value estimates converge much faster than waiting for new real experience.",
        invariants: [
            "Every real transition is applied once and stored in the model before planning begins.",
            "A planning replay uses the same Bellman update as a direct transition.",
            "The max over next actions is always taken from the current Q table.",
        ],
        correctness:
            "Both the direct update and each planning replay are Q-learning updates toward the target r + gamma times max over next actions. Q-learning is a stochastic approximation to the Bellman optimality equation and converges to the optimal Q values under standard step-size and visitation conditions. Adding model replays supplies extra samples drawn from the empirical model; if the model matches the environment these are valid experience, so the same fixed point is preserved while data efficiency improves.",
        complexityRationale:
            "Each update computes a maximum over the action set, costing O(actions); with a fixed number of real transitions and planning steps the total time is O((transitions + planningSteps) * actions). The Q table needs O(states * actions) space and the model stores the transitions.",
        uses: [
            "Sample-efficient reinforcement learning when real interaction is expensive",
            "Robotics systems that learn a model while acting",
            "A teaching bridge between model-free and model-based methods",
        ],
        references: [
            "Sutton, Dyna, an Integrated Architecture for Learning, Planning, and Reacting, 1991",
            "Sutton and Barto, Reinforcement Learning: An Introduction, Chapter 8",
        ],
        workedExample:
            "On four states with two actions, a real transition (state 0, action 0, reward 0, next state 1) with alpha 0.5 and gamma 0.9 sets Q(0,0) to zero because the next state is still worth zero. After a later transition gives state 2 a positive value, planning replays of the stored transition raise Q(0,0) toward 0.9 times that value without any new real experience.",
    },
    id: "dyna-q",
    name: "Dyna-Q",
    category: "ml-ai",
    complexity: { time: "O((transitions + planningSteps) * actions)", space: "O(states * actions)" },
    defaultInput: {
        numStates: 4,
        numActions: 2,
        transitions: [[0, 0, 0, 1], [1, 1, 0, 2], [2, 0, 1, 3]],
        alpha: 0.5,
        gamma: 0.9,
        planningSteps: 6,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the Q table to zero and an empty model",
        "for each real transition",
        "update Q toward reward plus gamma times the max next value",
        "store the transition in the model",
        "for a number of planning steps",
        "replay a stored model transition",
        "update Q toward the model reward plus gamma times the max next value",
        "done: report the final Q table",
    ],
};

export default module;
