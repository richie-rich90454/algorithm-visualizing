/**
 * value-iteration-dp.ts - Markov Decision Process Value Iteration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Solves an infinite-horizon discounted Markov decision process by repeatedly
 * applying the Bellman optimality operator. Each state's value becomes the
 * best expected immediate reward plus the discounted value of the next state,
 * and iteration stops once the largest change falls below a tolerance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * states * actions * outcomes)
 *   Space: O(states) for the current and next value arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per state shows its current value estimate.
 *   - The bar of the state with the largest change flashes YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Values converge to the unique fixed point for a discount gamma below one.
 *   - The best action recorded for each state is greedy with respect to V.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Outcome = [next: number, probability: number, reward: number];
type Transitions = Outcome[][][];

function makeBars(values: number[], changed: number, bestActions: number[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `s${index}=${value.toFixed(2)}`,
        value,
        state: (index === changed ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { state: index, value, bestAction: bestActions[index] ?? -1 },
    }));
}

function evaluate(transitions: Transitions, state: number, action: number, v: number[], gamma: number): number {
    const outcomes = transitions[state]?.[action] ?? [];
    let total = 0;
    for (const outcome of outcomes) {
        const next = outcome[0] ?? 0;
        const probability = outcome[1] ?? 0;
        const reward = outcome[2] ?? 0;
        total += probability * (reward + gamma * (v[next] ?? 0));
    }
    return total;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            states?: number;
            gamma?: number;
            transitions?: Transitions;
            iterations?: number;
            epsilon?: number;
        } | null
    ) ?? {};
    const states = typeof task.states === "number" ? Math.max(0, Math.floor(task.states)) : 3;
    const gamma = typeof task.gamma === "number" ? task.gamma : 0.5;
    const transitions: Transitions = Array.isArray(task.transitions)
        ? task.transitions
        : [
              [
                  [[1, 1, 0]],
                  [[2, 1, 5]],
              ],
              [[[1, 1, 2]]],
              [[[2, 1, 0]]],
          ];
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 60;
    const epsilon = typeof task.epsilon === "number" && task.epsilon > 0 ? task.epsilon : 1e-8;

    let v = new Array<number>(states).fill(0);
    let bestActions = new Array<number>(states).fill(-1);
    let step = 0;

    if (states === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No states in this Markov decision process - nothing to evaluate.",
            codeLineNumber: 0,
            layout: "array",
            meta: { iteration: 0, delta: 0, values: [], actions: [] },
        };
        return;
    }

    yield {
        stepNumber: step,
        entities: makeBars(v, -1, bestActions),
        edges: [],
        description: `Applying value iteration to ${states} states with discount ${gamma}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, delta: 0, values: [...v], actions: [...bestActions] },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const next = new Array<number>(states).fill(0);
        const nextActions = new Array<number>(states).fill(-1);
        let delta = 0;
        let changed = -1;
        for (let s = 0; s < states; s += 1) {
            const actions = transitions[s] ?? [];
            let best = actions.length === 0 ? 0 : Number.NEGATIVE_INFINITY;
            let bestAction = -1;
            for (let a = 0; a < actions.length; a += 1) {
                const q = evaluate(transitions, s, a, v, gamma);
                if (q > best) {
                    best = q;
                    bestAction = a;
                }
            }
            next[s] = best;
            nextActions[s] = bestAction;
            const diff = Math.abs(best - (v[s] ?? 0));
            if (diff > delta) {
                delta = diff;
                changed = s;
            }
        }
        v = next;
        bestActions = nextActions;
        yield {
            stepNumber: step,
            entities: makeBars(v, changed, bestActions),
            edges: [],
            description: `Iteration ${iteration}: largest value change ${delta.toExponential(2)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: {
                iteration,
                delta: Number(delta.toExponential(6)),
                values: [...v],
                actions: [...bestActions],
            },
        };
        step += 1;
        if (delta < epsilon) break;
    }

    yield {
        stepNumber: step,
        entities: makeBars(v, -1, bestActions),
        edges: [],
        description: `Done: value iteration settled with state values ${v.map((x) => x.toFixed(2)).join(", ")}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { iteration: step - 2, delta: 0, values: [...v], actions: [...bestActions] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A state's value is the best reward you can expect from it. If you know the values of all successor states, you can compute a better estimate by trying every action and taking the best immediate reward plus the discounted successor value. Repeating this across all states makes the estimates settle on the true values.",
        invariants: [
            "Each sweep applies the Bellman optimality operator to every state once.",
            "The discount gamma below one makes the operator a contraction, so values converge.",
            "The recorded best action is greedy with respect to the current value estimate.",
        ],
        correctness:
            "For gamma below one the Bellman optimality operator is a contraction in the maximum norm, so repeated application converges to its unique fixed point regardless of the starting values. At that fixed point each state's value equals the maximum expected return over its actions, which is the definition of the optimal value function, and a greedy action attains it.",
        complexityRationale:
            "Each sweep evaluates every action and each action's listed outcomes, costing O(states * actions * outcomes); with T sweeps the time is O(T * states * actions * outcomes) and only two value arrays are kept, O(states) space.",
        uses: [
            "Reinforcement learning with a known transition model",
            "Inventory and maintenance planning under uncertainty",
            "A baseline for comparing sample-based learning methods",
        ],
        references: [
            "Bellman, Dynamic Programming, 1957",
            "Sutton and Barto, Reinforcement Learning: An Introduction, Chapter 4",
        ],
        workedExample:
            "With two states, a discount of 0.5, and state zero leading to state one for reward 1 while state one loops on itself for reward 0, state one's value is 0 and state zero's value is 1 plus half of 0, so the estimates converge to 1 and 0.",
    },
    id: "value-iteration-dp",
    name: "Value Iteration for Markov Decision Processes",
    category: "dynamic-programming",
    complexity: { time: "O(T * states * actions * outcomes)", space: "O(states)" },
    defaultInput: {
        states: 3,
        gamma: 0.5,
        transitions: [
            [
                [[1, 1, 0]],
                [[2, 1, 5]],
            ],
            [[[1, 1, 2]]],
            [[[2, 1, 0]]],
        ],
        iterations: 60,
        epsilon: 1e-8,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize every state value to zero",
        "repeat for a bounded number of sweeps",
        "for each state try every available action",
        "compute expected reward plus discounted successor value",
        "set the new value to the largest action value",
        "track the largest change across all states",
        "stop early when the largest change is below tolerance",
        "done: report the converged values and greedy actions",
    ],
};

export default module;
