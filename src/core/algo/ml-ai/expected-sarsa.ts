/**
 * expected-sarsa.ts - Expected SARSA: On-Policy TD with an Expected Backup
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Expected SARSA replaces the sampled next action of SARSA with its expectation
 * under the current policy. The backup is the reward plus gamma times the
 * average of the next-state action values weighted by the policy, which for an
 * epsilon-greedy policy mixes the best action with uniform exploration. Removing
 * the sampled action lowers variance while keeping the update on policy.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(transitions * actions) for the expected-value sum
 *   Space: O(states * actions) for the Q table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows Q values: rows are states, columns are actions.
 *   - The cell being updated is highlighted; visited cells turn green.
 *   - Meta records Q, the transition, and the policy-weighted expected value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Transition = [number, number, number, number];
interface ExpectedSarsaInput {
    numStates?: number;
    numActions?: number;
    transitions?: Transition[];
    alpha?: number;
    gamma?: number;
    epsilon?: number;
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

/** The expected epsilon-greedy value of a state's action row. */
function expectedValue(q: number[], state: number, numActions: number, epsilon: number): number {
    let greedy = 0;
    for (let a = 1; a < numActions; a += 1) {
        if ((q[state * numActions + a] ?? 0) > (q[state * numActions + greedy] ?? 0)) {
            greedy = a;
        }
    }
    const uniform = epsilon / numActions;
    let total = 0;
    for (let a = 0; a < numActions; a += 1) {
        const probability = a === greedy ? 1 - epsilon + uniform : uniform;
        total += probability * (q[state * numActions + a] ?? 0);
    }
    return total;
}

/** The Expected SARSA generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ExpectedSarsaInput | null) ?? {};
    const numStates = typeof task.numStates === "number" ? Math.max(1, Math.floor(task.numStates)) : 4;
    const numActions = typeof task.numActions === "number" ? Math.max(1, Math.floor(task.numActions)) : 2;
    const alpha = typeof task.alpha === "number" ? Math.min(1, Math.max(0, task.alpha)) : 0.5;
    const gamma = typeof task.gamma === "number" ? Math.min(1, Math.max(0, task.gamma)) : 0.9;
    const epsilon = typeof task.epsilon === "number" ? Math.min(1, Math.max(0, task.epsilon)) : 0.1;
    const transitions: Transition[] = Array.isArray(task.transitions) && task.transitions.length > 0
        ? task.transitions.map((t) => [t[0], t[1], t[2], t[3]])
        : [[0, 0, 0, 1], [1, 1, 0, 2], [2, 0, 1, 3]];

    const q = Array.from({ length: numStates * numActions }, () => 0);
    const seen = new Set<number>();

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(q, numStates, numActions, -1, seen),
        edges: [],
        description: `Expected SARSA on ${numStates} states and ${numActions} actions with epsilon ${epsilon}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: numStates, cols: numActions, q: [...q], transition: [], expected: 0, step: 0 },
    };
    step += 1;

    for (let index = 0; index < transitions.length; index += 1) {
        const [s, a, r, sp] = transitions[index] ?? [0, 0, 0, 0];
        const expected = expectedValue(q, sp, numActions, epsilon);
        const indexSa = s * numActions + a;
        const target = r + gamma * expected;
        q[indexSa] = (q[indexSa] ?? 0) + alpha * (target - (q[indexSa] ?? 0));
        seen.add(indexSa);

        yield {
            stepNumber: step,
            entities: makeCells(q, numStates, numActions, indexSa, seen),
            edges: [],
            description: `Transition ${index + 1}: (${s}, ${a}, ${r}, ${sp}), policy expected value ${expected.toFixed(3)}, Q(${s},${a}) now ${(q[indexSa] ?? 0).toFixed(3)}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows: numStates, cols: numActions, q: [...q], transition: [s, a, r, sp], expected, target, step: index + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(q, numStates, numActions, -1, seen),
        edges: [],
        description: `Final Q table after ${transitions.length} expected backups.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: numStates, cols: numActions, q: [...q], transition: [], expected: 0, step: transitions.length },
    };
}

/** The Expected SARSA module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Expected SARSA uses the average future value instead of a single sampled one. In a state, an epsilon-greedy policy gives the best action most of the probability and a small share to every action. The backup weighs each next action's Q value by that probability, so the update no longer depends on which random action happened to be drawn. This keeps the same on-policy target as SARSA with less noise.",
        invariants: [
            "The policy probabilities form a valid epsilon-greedy distribution over actions.",
            "The expected value is the probability-weighted sum of next-state action values.",
            "Each transition changes exactly one Q entry toward reward plus gamma times that expectation.",
        ],
        correctness:
            "Expected SARSA performs the same Bellman evaluation backup as SARSA but replaces the single sampled next action with its expectation under the policy. Since the expectation is over the identical on-policy distribution, the two updates have the same expected direction, so the algorithm converges to the same action-value function. Taking the expectation removes the sampling variance of the next action, which gives lower variance updates for the same computation of the policy.",
        complexityRationale:
            "Computing the expected value sums over all actions of the next state, costing O(actions) per transition, so the run is O(transitions * actions). The Q table uses O(states * actions) space.",
        uses: [
            "Lower-variance on-policy control in reinforcement learning",
            "Offline and off-policy evaluation with known behavior probabilities",
            "A teaching comparison against sampled SARSA and max-based Q-learning",
        ],
        references: [
            "van Seijen et al., A Theoretical and Empirical Analysis of Expected SARSA, 2009",
            "Sutton and Barto, Reinforcement Learning: An Introduction, Chapter 6",
        ],
        workedExample:
            "With two actions, Q(next state) = (2, 0), epsilon 0.1, gamma 0.9, and a transition with reward 1, the greedy action 0 has probability 0.95 and action 1 has 0.05. The expected value is 0.95*2 + 0.05*0 = 1.9, so the target is 1 + 0.9*1.9 = 2.71 and alpha moves the taken action's value toward it.",
    },
    id: "expected-sarsa",
    name: "Expected SARSA",
    category: "ml-ai",
    complexity: { time: "O(transitions * actions)", space: "O(states * actions)" },
    defaultInput: {
        numStates: 4,
        numActions: 2,
        transitions: [[0, 0, 0, 1], [1, 1, 0, 2], [2, 0, 1, 3]],
        alpha: 0.5,
        gamma: 0.9,
        epsilon: 0.1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the Q table to zero for every state and action",
        "for each observed transition",
        "form epsilon-greedy probabilities for the next state",
        "sum next action values weighted by those probabilities",
        "set the target to reward plus gamma times the expected value",
        "move Q of the taken action toward the target by alpha",
        "done: report the final Q table",
    ],
};

export default module;
