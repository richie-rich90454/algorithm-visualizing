/**
 * double-q-learning.ts - Double Q-Learning on a Tabular Grid
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Q-learning uses the same values to choose and to evaluate the best next
 * action, which can systematically overestimate noisy actions. Double
 * Q-learning keeps two independent value tables. One table chooses the best
 * next action and the other evaluates it, and the roles alternate on each
 * transition. This decorrelates selection from evaluation and reduces the
 * overestimation bias.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(transitions * actions) for the argmax over next actions
 *   Space: O(states * actions) for the two Q tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows both tables side by side: first Q1, then Q2.
 *   - The single cell being updated is highlighted on each transition.
 *   - Meta records both tables and which table was updated.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Transition = [number, number, number, number];
interface DoubleQInput {
    numStates?: number;
    numActions?: number;
    transitions?: Transition[];
    alpha?: number;
    gamma?: number;
}

function makeCells(q1: number[], q2: number[], states: number, actions: number, active: number): VisualEntity[] {
    const all = [...q1, ...q2];
    return all.map((value, index) => {
        const half = index < states * actions ? 0 : 1;
        const local = index % (states * actions);
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: value.toFixed(2),
            value,
            state: (index === active ? "active" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: Math.floor(local / actions), col: (half * actions) + (local % actions), half, index: local },
        };
    });
}

/** The Double Q-learning generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DoubleQInput | null) ?? {};
    const numStates = typeof task.numStates === "number" ? Math.max(1, Math.floor(task.numStates)) : 4;
    const numActions = typeof task.numActions === "number" ? Math.max(1, Math.floor(task.numActions)) : 2;
    const alpha = typeof task.alpha === "number" ? Math.min(1, Math.max(0, task.alpha)) : 0.5;
    const gamma = typeof task.gamma === "number" ? Math.min(1, Math.max(0, task.gamma)) : 0.9;
    const transitions: Transition[] = Array.isArray(task.transitions) && task.transitions.length > 0
        ? task.transitions.map((t) => [t[0], t[1], t[2], t[3]])
        : [[0, 0, 0, 1], [1, 1, 0, 2], [2, 0, 1, 3]];

    const q1 = Array.from({ length: numStates * numActions }, () => 0);
    const q2 = Array.from({ length: numStates * numActions }, () => 0);
    const argmax = (table: number[], state: number) => {
        let bestAction = 0;
        for (let a = 1; a < numActions; a += 1) {
            if ((table[state * numActions + a] ?? 0) > (table[state * numActions + bestAction] ?? 0)) {
                bestAction = a;
            }
        }
        return bestAction;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(q1, q2, numStates, numActions, -1),
        edges: [],
        description: `Double Q-learning on ${numStates} states and ${numActions} actions over ${transitions.length} transitions.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: numStates, cols: numActions * 2, q1: [...q1], q2: [...q2], transition: [], updated: 0, step: 0 },
    };
    step += 1;

    for (let index = 0; index < transitions.length; index += 1) {
        const [s, a, r, sp] = transitions[index] ?? [0, 0, 0, 0];
        const updateFirst = index % 2 === 0;
        let active: number;
        if (updateFirst) {
            const best = argmax(q1, sp);
            const target = r + gamma * (q2[sp * numActions + best] ?? 0);
            const cell = s * numActions + a;
            q1[cell] = (q1[cell] ?? 0) + alpha * (target - (q1[cell] ?? 0));
            active = cell;
        } else {
            const best = argmax(q2, sp);
            const target = r + gamma * (q1[sp * numActions + best] ?? 0);
            const cell = s * numActions + a;
            q2[cell] = (q2[cell] ?? 0) + alpha * (target - (q2[cell] ?? 0));
            active = numStates * numActions + cell;
        }

        yield {
            stepNumber: step,
            entities: makeCells(q1, q2, numStates, numActions, active),
            edges: [],
            description: `Transition ${index + 1}: updated Q${updateFirst ? 1 : 2}(${s},${a}) using the other table to evaluate the best next action.`,
            codeLineNumber: updateFirst ? 4 : 6,
            layout: "grid",
            meta: { rows: numStates, cols: numActions * 2, q1: [...q1], q2: [...q2], transition: [s, a, r, sp], updated: updateFirst ? 1 : 2, step: index + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(q1, q2, numStates, numActions, -1),
        edges: [],
        description: `Final tables after ${transitions.length} decorrelated Double Q updates.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: numStates, cols: numActions * 2, q1: [...q1], q2: [...q2], transition: [], updated: 0, step: transitions.length },
    };
}

/** The Double Q-learning module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Double Q-learning breaks a feedback loop. With one table, the same noisy value that wins the argmax is also used as the target, so random high estimates get reinforced. Two tables let one choose the best next action while the other, which was not used for that choice, estimates its value. Alternating which table plays each role keeps both estimates roughly unbiased.",
        invariants: [
            "The table choosing the best next action is never the table evaluating that action.",
            "The two tables alternate roles on consecutive transitions.",
            "Each transition updates exactly one cell in exactly one table.",
        ],
        correctness:
            "For a fixed pair of tables the update is a Q-learning step whose target uses the other table's value at the chosen action, so it remains a contraction toward the Bellman optimality equation. Because selection and evaluation use independent estimates, the positive bias that arises from taking a maximum over noisy values is largely removed: the choosing table can still pick an overestimated action, but the evaluating table gives that action its unbiased value. Both tables therefore converge to the optimal Q function under the usual conditions.",
        complexityRationale:
            "Each transition computes one argmax over the action set and one update, costing O(actions), for O(transitions * actions) total time. Two Q tables require O(states * actions) space.",
        uses: [
            "Reinforcement learning where value overestimation distorts control",
            "Deep reinforcement learning variants such as Double DQN",
            "A teaching contrast with ordinary Q-learning",
        ],
        references: [
            "van Hasselt, Double Q-Learning, 2010",
            "van Hasselt et al., Deep Reinforcement Learning with Double Q-learning, 2015",
        ],
        workedExample:
            "With two actions, gamma 0.9, and next-state values Q1 = (1, 0.8) and Q2 = (0.2, 0.6), the first update uses Q1 to pick action 0 and Q2 to evaluate it, giving target r + 0.9*0.2. The next update uses Q2 to pick the best action and Q1 to evaluate it, so a spuriously high value in Q1 cannot inflate its own target.",
    },
    id: "double-q-learning",
    name: "Double Q-Learning",
    category: "ml-ai",
    complexity: { time: "O(transitions * actions)", space: "O(states * actions)" },
    defaultInput: {
        numStates: 4,
        numActions: 2,
        transitions: [[0, 0, 0, 1], [1, 1, 0, 2], [2, 0, 1, 3]],
        alpha: 0.5,
        gamma: 0.9,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize two Q tables to zero",
        "for each transition at index i",
        "if i is even choose the best next action from Q1 and evaluate with Q2",
        "otherwise choose from Q2 and evaluate with Q1",
        "set the target to reward plus gamma times the other table's value",
        "move the chosen table entry toward the target by alpha",
        "alternate the roles of the two tables",
        "done: report both final Q tables",
    ],
};

export default module;
