/**
 * a3c.ts - Asynchronous Advantage Actor-Critic (Toy Value and Policy)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A3C runs several workers in parallel. Each worker copies the global value
 * and policy parameters, computes a one-step advantage from its own experience,
 * updates its local copy, and pushes the accumulated changes back to the
 * shared parameters. This toy captures the essential arithmetic: workers read
 * a common snapshot, compute local deltas, and their deltas are applied to the
 * global parameters, so the result is exactly checkable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(workers * actions) for value and policy updates
 *   Space: O(states + actions) for the shared parameters and each delta
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per state shows the current global value estimate.
 *   - The state touched by the worker is highlighted each step.
 *   - Meta records the shared values, policy, advantage, and pushed delta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Worker {
    s: number;
    a: number;
    r: number;
    sp: number;
}
interface A3cInput {
    numStates?: number;
    numActions?: number;
    initV?: number[];
    initTheta?: number[];
    workers?: Worker[];
    gamma?: number;
    lrV?: number;
    lrA?: number;
}

function softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exp = logits.map((v) => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map((v) => v / sum);
}

function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `state-${index}`,
        type: "bar" as const,
        label: `V${index}=${value.toFixed(3)}`,
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, state: index },
    }));
}

/** The A3C generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as A3cInput | null) ?? {};
    const numStates = typeof task.numStates === "number" ? Math.max(2, Math.floor(task.numStates)) : 4;
    const numActions = typeof task.numActions === "number" ? Math.max(2, Math.floor(task.numActions)) : 3;
    const gamma = typeof task.gamma === "number" ? Math.min(1, Math.max(0, task.gamma)) : 0.9;
    const lrV = typeof task.lrV === "number" && task.lrV > 0 ? task.lrV : 0.2;
    const lrA = typeof task.lrA === "number" && task.lrA > 0 ? task.lrA : 0.1;
    const workers: Worker[] = Array.isArray(task.workers) && task.workers.length > 0
        ? task.workers
        : [
              { s: 0, a: 0, r: 0, sp: 1 },
              { s: 1, a: 1, r: 0, sp: 2 },
              { s: 2, a: 2, r: 1, sp: 3 },
              { s: 3, a: 0, r: 1, sp: 3 },
          ];

    const globalV = Array.from({ length: numStates }, (_, index) => (task.initV?.[index] ?? 0));
    const globalTheta = Array.from({ length: numActions }, (_, index) => (task.initTheta?.[index] ?? 0));
    const snapshot = (active: number) => makeBars(globalV, active);

    let step = 0;
    yield {
        stepNumber: step,
        entities: snapshot(-1),
        edges: [],
        description: `A3C with ${workers.length} worker(s), ${numStates} states, ${numActions} actions, gamma ${gamma}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { worker: 0, v: [...globalV], theta: [...globalTheta], policy: softmax(globalTheta), advantage: 0, deltaV: globalV.map(() => 0), deltaTheta: globalTheta.map(() => 0) },
    };
    step += 1;

    for (let index = 0; index < workers.length; index += 1) {
        const worker = workers[index];
        if (!worker) {
            continue;
        }
        const readV = [...globalV];
        const readTheta = [...globalTheta];
        const advantage = worker.r + gamma * (readV[worker.sp] ?? 0) - (readV[worker.s] ?? 0);
        const probs = softmax(readTheta);
        const localV = [...readV];
        const localTheta = [...readTheta];
        localV[worker.s] = (localV[worker.s] ?? 0) + lrV * advantage;
        for (let a = 0; a < numActions; a += 1) {
            localTheta[a] = (localTheta[a] ?? 0) + lrA * advantage * ((a === worker.a ? 1 : 0) - (probs[a] ?? 0));
        }
        const deltaV = localV.map((value, i) => value - (readV[i] ?? 0));
        const deltaTheta = localTheta.map((value, i) => value - (readTheta[i] ?? 0));
        for (let i = 0; i < numStates; i += 1) {
            globalV[i] = (globalV[i] ?? 0) + (deltaV[i] ?? 0);
        }
        for (let i = 0; i < numActions; i += 1) {
            globalTheta[i] = (globalTheta[i] ?? 0) + (deltaTheta[i] ?? 0);
        }

        yield {
            stepNumber: step,
            entities: snapshot(worker.s),
            edges: [],
            description: `Worker ${index + 1}: state ${worker.s}, action ${worker.a}, advantage ${advantage.toFixed(4)}; pushed local delta to global parameters.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { worker: index + 1, v: [...globalV], theta: [...globalTheta], policy: softmax(globalTheta), advantage, deltaV, deltaTheta, state: worker.s, action: worker.a, reward: worker.r },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: snapshot(-1),
        edges: [],
        description: `Final shared values: ${globalV.map((v) => v.toFixed(3)).join(", ")}; policy ${softmax(globalTheta).map((p) => p.toFixed(3)).join(", ")}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { worker: workers.length, v: [...globalV], theta: [...globalTheta], policy: softmax(globalTheta), advantage: 0, deltaV: globalV.map(() => 0), deltaTheta: globalTheta.map(() => 0) },
    };
}

/** The A3C module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A3C speeds up reinforcement learning by letting several workers explore different parts of an environment at once. Each worker has its own copy of the network, learns from a short slice of experience, and periodically sends its accumulated changes back to a shared set of parameters. Because workers use slightly stale copies, their updates arrive at different times and act like a useful source of noise.",
        invariants: [
            "Every worker reads one shared snapshot of the value table and policy logits.",
            "The advantage is reward plus gamma times the next state's value minus the current value.",
            "The global parameters advance by exactly the sum of the workers' pushed deltas.",
        ],
        correctness:
            "The value update is a stochastic approximation to the Bellman equation V(s) = E[r + gamma V(s')], and the advantage-based policy update is the policy gradient theorem with the value function as a baseline, which lowers variance without changing the expected gradient direction. Applying each worker's local delta to the shared parameters is asynchronous stochastic gradient descent; the stale reads introduce bounded delay but preserve convergence for small learning rates.",
        complexityRationale:
            "Each worker computes one softmax and one update over the action set and copies a value vector, costing O(states + actions); across workers the time is O(workers * (states + actions)). The shared parameters and each delta use O(states + actions) space.",
        uses: [
            "Parallel reinforcement learning on multicore machines",
            "Asynchronous training of game-playing agents",
            "A teaching model for advantage actor-critic methods",
        ],
        references: [
            "Mnih et al., Asynchronous Methods for Deep Reinforcement Learning, 2016",
            "Sutton and Barto, Reinforcement Learning: An Introduction, Chapter 13",
        ],
        workedExample:
            "With four states, values all zero, gamma 0.9, and a worker at state 1 taking action 0 with reward 0 leading to state 2, the advantage is zero and the local parameters barely move. A later worker at state 2 with reward 1 leading to state 3 has advantage 1, so its local V(2) rises by lrV and its action logit shifts, and that delta is added to the shared parameters.",
    },
    id: "a3c",
    name: "Asynchronous Advantage Actor-Critic",
    category: "ml-ai",
    complexity: { time: "O(workers * (states + actions))", space: "O(states + actions)" },
    defaultInput: {
        numStates: 4,
        numActions: 3,
        initV: [0, 0, 0, 0],
        initTheta: [0, 0, 0],
        workers: [
            { s: 0, a: 0, r: 0, sp: 1 },
            { s: 1, a: 1, r: 0, sp: 2 },
            { s: 2, a: 2, r: 1, sp: 3 },
            { s: 3, a: 0, r: 1, sp: 3 },
        ],
        gamma: 0.9,
        lrV: 0.2,
        lrA: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize global value table and policy logits",
        "for each asynchronous worker",
        "copy the global parameters into a local worker",
        "compute advantage as reward plus gamma times next value minus value",
        "add value rate times advantage to the local value",
        "add policy rate times advantage times one-hot minus probability to local logits",
        "push the accumulated local delta back to the global parameters",
        "done: report the global value table and policy",
    ],
};

export default module;
