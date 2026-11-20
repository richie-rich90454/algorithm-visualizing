/**
 * stochastic-shortest-path.ts - Stochastic Shortest Path (Bellman optimality)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A stochastic shortest path problem is a Markov decision process with a
 * designated goal state. At each state the decision maker picks an action and
 * a random outcome moves the process to a successor state while paying a cost.
 * The objective is a policy that minimizes the expected total cost of reaching
 * the goal. Value iteration applies the Bellman optimality operator
 * V(s) = min over actions of the expected immediate cost plus V(successor),
 * iterating until the largest change is below a tolerance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(I * S * A * O) for I iterations, S states, A actions, O outcomes
 *   Space: O(S) for the current and next value arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per state shows the current expected-cost estimate.
 *   - The bar whose value changed most in an iteration flashes YELLOW.
 *   - The final frame reports the value table and the greedy optimal policy.
 */
import type { AlgorithmModule, EntityState, MetaValue, VisualEntity, VisualFrame } from "@/types";

type Outcome = [next: number, probability: number, cost: number];
type Transitions = Outcome[][][];

interface In {
    transitions?: Transitions;
    goal?: number;
    tolerance?: number;
    maxIterations?: number;
    labels?: string[];
}

function makeBars(values: number[], changed: number, labels: string[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${labels[index] ?? `s${index}`}=${Number.isFinite(value) ? value.toFixed(2) : "inf"}`,
        value: Number.isFinite(value) ? value : 0,
        state: (index === changed ? "comparing" : index === values.length - 1 ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { state: index, value: Number.isFinite(value) ? value : 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as In | null) ?? {};
    const transitions: Transitions = task.transitions ?? [];
    const states = transitions.length;
    const goal = typeof task.goal === "number" ? task.goal : states - 1;
    const tolerance = typeof task.tolerance === "number" ? Math.max(0, task.tolerance) : 1e-9;
    const maxIterations = typeof task.maxIterations === "number" ? Math.max(1, task.maxIterations) : 200;
    const labels = states > 0
        ? Array.from({ length: states }, (_, i) => task.labels?.[i] ?? `s${i}`)
        : ["goal"];

    const frame = (
        stepNumber: number,
        values: number[],
        changed: number,
        description: string,
        codeLineNumber: number,
        meta: Record<string, MetaValue>,
    ): VisualFrame => ({
        stepNumber,
        entities: makeBars(values, changed, labels),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta,
    });

    let step = 0;
    if (states === 0) {
        yield frame(step, [0], -1, "Empty problem - there are no states to evaluate.", 0, { states: 0, converged: true });
        return;
    }

    const values = new Array<number>(states).fill(0);
    if (goal >= 0 && goal < states) values[goal] = 0;
    const policy = new Array<number>(states).fill(-1);
    yield frame(step, values, -1, `Solving a stochastic shortest path over ${states} state(s) with goal ${labels[goal] ?? goal}.`, 0, {
        states,
        goal,
        tolerance,
    });
    step += 1;

    let iterations = 0;
    let converged = false;
    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
        const next = values.slice();
        let maxDelta = 0;
        let changedState = -1;
        for (let s = 0; s < states; s += 1) {
            if (s === goal) continue;
            const actions = transitions[s] ?? [];
            let best = Infinity;
            let bestAction = -1;
            for (let a = 0; a < actions.length; a += 1) {
                const outcomes = actions[a] ?? [];
                let expected = 0;
                for (const outcome of outcomes) {
                    const successor = outcome[0] ?? 0;
                    const probability = outcome[1] ?? 0;
                    const cost = outcome[2] ?? 0;
                    expected += probability * (cost + (values[successor] ?? 0));
                }
                if (expected < best) {
                    best = expected;
                    bestAction = a;
                }
            }
            const candidate = Number.isFinite(best) ? best : 0;
            next[s] = candidate;
            policy[s] = bestAction;
            const delta = Math.abs(candidate - (values[s] ?? 0));
            if (delta > maxDelta) {
                maxDelta = delta;
                changedState = s;
            }
        }
        const before = values.slice();
        for (let s = 0; s < states; s += 1) values[s] = next[s] ?? 0;
        iterations = iteration;
        yield frame(
            step,
            values,
            changedState,
            `Iteration ${iteration}: largest value change ${maxDelta.toExponential(2)} at ${labels[changedState] ?? "goal"}.`,
            4,
            { iteration, delta: maxDelta, values: before.slice(0, Math.min(states, 32)), converged: maxDelta < tolerance },
        );
        step += 1;
        if (maxDelta < tolerance) {
            converged = true;
            break;
        }
    }

    yield frame(
        step,
        values,
        -1,
        `Done after ${iterations} iteration(s): ${converged ? "converged" : "stopped at the iteration limit"}; goal cost ${(values[goal] ?? 0).toFixed(3)}.`,
        7,
        { values: values.slice(0, Math.min(states, 64)), policy: policy.slice(0, Math.min(states, 64)), iterations, converged },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When the next state after an action is random, the cost of that action is an average over its possible outcomes. The Bellman optimality equation says a state's best expected remaining cost is the minimum, over actions, of the immediate cost plus the already-known cost of whatever state follows. Starting from zero estimates and repeatedly applying that equation is value iteration, and the estimates settle on the optimal costs.",
        invariants: [
            "The goal state always has value zero and no outgoing cost.",
            "Each iteration replaces every state value with the minimum expected cost computed from the previous iterate.",
            "For a proper problem the value sequence converges to the unique solution of the Bellman optimality equations.",
        ],
        correctness:
            "The Bellman optimality operator is a contraction on the space of value vectors when every proper policy reaches the goal, so iteration converges to its unique fixed point. At that fixed point each state value equals the minimum achievable expected cost, and the arg-min action stored in the policy attains it; therefore the policy is optimal. Termination at the fixed point leaves a Bellman residual below the tolerance.",
        complexityRationale:
            "Each of up to I iterations visits S states, A actions, and O stochastic outcomes, giving O(I S A O) time. Only the current and next value arrays of length S are kept, for O(S) space.",
        uses: [
            "Robot navigation with noisy motion and uncertain terrain costs",
            "Inventory and maintenance planning under stochastic demand",
            "Scheduling and routing where travel times are random",
        ],
        references: [
            "Bertsekas, Dynamic Programming and Optimal Control, Vol. II, stochastic shortest paths",
            "Puterman, Markov Decision Processes: Discrete Stochastic Dynamic Programming",
        ],
        workedExample:
            "States 0,1,2 have goal 3. From state 0, action 1 goes to state 2 with cost 2 and V(2)=3, so it costs 5. Action 0 goes to state 1 with chance 0.5 at cost 1 and to state 2 with chance 0.5 at cost 4, giving 0.5(1+4)+0.5(4+3)=6. The minimum is 5, so V(0)=5 with action 1. Working backward gives V(1)=4 and V(2)=3.",
    },
    id: "stochastic-shortest-path",
    name: "Stochastic Shortest Path (Value Iteration)",
    category: "shortest-path",
    complexity: { time: "O(I * S * A * O)", space: "O(S)" },
    defaultInput: {
        transitions: [
            [
                [[1, 0.5, 1], [2, 0.5, 4]],
                [[2, 1, 2]],
            ],
            [
                [[2, 1, 1]],
                [[3, 1, 5]],
            ],
            [
                [[3, 1, 3]],
            ],
            [],
        ],
        goal: 3,
        tolerance: 1e-10,
        maxIterations: 200,
        labels: ["s0", "s1", "s2", "goal"],
    },
    visualType: "array",
    run,
    pseudocode: [
        "set the goal state value to zero and all others to zero",
        "repeat until the largest value change is below the tolerance",
        "for every state other than the goal",
        "compute each action expected cost from its outcome probabilities",
        "choose the action with the smallest expected cost",
        "record that value and the greedy action for the state",
        "stop early when a full pass changes no value appreciably",
        "done: report optimal values and the greedy policy",
    ],
};

export default module;
