/**
 * temporal-difference-learning.ts - TD(0) Value Prediction on a Chain
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Temporal-difference learning estimates the value of states using samples of
 * experience rather than a full model. TD(0) adjusts a state's value toward the
 * observed reward plus the discounted value of the next state. The demo uses a
 * deterministic chain with a single reward at the far end, so repeated sweeps
 * converge to the discounted distance to the goal and the math can be checked
 * exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sweeps * states)
 *   Space: O(states) for the value table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per state shows its current estimated value.
 *   - The bar for the state just updated is highlighted.
 *   - Meta records the reward, next value, and TD error of each update.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeEntities(values: number[], updated: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `state-${index}`,
        type: "bar" as const,
        label: `V${index}=${value.toFixed(3)}`,
        value,
        state: (index === updated ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** The TD(0) generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            states?: number;
            alpha?: number;
            gamma?: number;
            sweeps?: number;
        } | null
    ) ?? {};
    const states = typeof task.states === "number" ? Math.max(2, Math.floor(task.states)) : 5;
    const alpha = typeof task.alpha === "number" ? Math.min(1, Math.max(0, task.alpha)) : 0.3;
    const gamma = typeof task.gamma === "number" ? Math.min(1, Math.max(0, task.gamma)) : 0.9;
    const sweeps = typeof task.sweeps === "number" ? Math.max(1, Math.floor(task.sweeps)) : 40;

    const values = Array.from({ length: states }, () => 0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(values, -1),
        edges: [],
        description: `TD(0) on a ${states}-state chain with alpha ${alpha}, gamma ${gamma}, for ${sweeps} sweeps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { states, alpha, gamma, sweeps, sweep: 0, values: [...values], tdError: 0 },
    };
    step += 1;

    for (let sweep = 1; sweep <= sweeps; sweep += 1) {
        for (let state = 0; state < states - 1; state += 1) {
            const next = state + 1;
            const reward = next === states - 1 ? 1 : 0;
            const tdError = reward + gamma * values[next]! - values[state]!;
            values[state] = values[state]! + alpha * tdError;
            yield {
                stepNumber: step,
                entities: makeEntities(values, state),
                edges: [],
                description: `Sweep ${sweep}, state ${state}: reward ${reward}, next value ${values[next]!.toFixed(3)}, TD error ${tdError.toFixed(4)}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: {
                    states,
                    alpha,
                    gamma,
                    sweeps,
                    sweep,
                    state,
                    reward,
                    nextValue: Number(values[next]!.toFixed(6)),
                    values: values.map((value) => Number(value.toFixed(6))),
                    tdError: Number(tdError.toFixed(6)),
                },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities(values, -1),
        edges: [],
        description: `After ${sweeps} sweeps the values approach the discounted distance to the goal: V0 = ${values[0]!.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            states,
            alpha,
            gamma,
            sweeps,
            values: values.map((value) => Number(value.toFixed(6))),
            converged: Math.abs(values[0]! - gamma ** (states - 2)) < 0.01,
        },
    };
}

/** The TD(0) module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of waiting until an episode ends to learn, TD learning corrects a guess using another guess. After moving to the next state, the observed reward plus the discounted value of where you landed is a better estimate of the current state's value. The difference is the TD error, and a small step toward it improves the estimate online.",
        invariants: [
            "The terminal state never receives a reward of its own and its value stays zero.",
            "Each update moves a state's value by alpha times the TD error.",
            "With in-place sweeps the values increase monotonically from the start state toward the goal.",
        ],
        correctness:
            "Repeatedly applying the TD(0) update to a Markov chain is stochastic approximation for the Bellman expectation equation V(s) = E[r + gamma V(s')]. For this deterministic chain the fixed point is V(s) = gamma^(n-2-s), the discounted number of steps to the goal; since the update is a contraction for gamma below one, the estimates converge there.",
        complexityRationale:
            "Each sweep performs one constant-time update per non-terminal state, so total time is O(sweeps * states). The value table stores one number per state, giving O(states) space.",
        uses: [
            "Value estimation in reinforcement learning agents",
            "Temporal-difference prediction in game and robotics training",
            "The foundation of SARSA and Q-learning",
        ],
        references: [
            "Sutton, Learning to Predict by the Methods of Temporal Differences, 1988",
            "Sutton and Barto, Reinforcement Learning: An Introduction, Chapter 6, 2018",
        ],
        workedExample:
            "On a five-state chain with gamma 0.9 and a reward only on entry to state 4, the estimates converge to V = (0.729, 0.81, 0.9, 1, 0). State 3 is worth one step of undiscounted reward, state 2 is worth 0.9 of that, and so on.",
    },
    id: "temporal-difference-learning",
    name: "Temporal Difference Learning",
    category: "ml-ai",
    complexity: { time: "O(sweeps * states)", space: "O(states)" },
    defaultInput: { states: 5, alpha: 0.3, gamma: 0.9, sweeps: 40 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize every state value to zero",
        "repeat for a fixed number of sweeps",
        "for each non-terminal state in order",
        "form the target as reward plus gamma times the next value",
        "add alpha times target minus current value to the value",
        "done: report the learned value table",
    ],
};

export default module;
