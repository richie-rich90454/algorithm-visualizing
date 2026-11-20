/**
 * fedprox.ts - FedProx: Federated Averaging with a Proximal Client Term
 *
 * FedProx changes each client's local objective by adding a quadratic penalty
 * that keeps the client close to the current global model. The penalty
 * mu * ||w - w_global||^2 / 2 limits client drift caused by heterogeneous
 * (non-identical) data, which improves convergence over plain averaging.
 *
 * Time per round is O(clients * localSteps * d); space is O(d).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** One proximal gradient step on a quadratic client objective. */
export function fedProxClientStep(
    weights: number[],
    target: number[],
    globalWeights: number[],
    learningRate: number,
    mu: number,
): number[] {
    return weights.map((w, i) => {
        const clientGradient = w - (target[i] ?? 0);
        const proximalGradient = clientGradient + mu * (w - (globalWeights[i] ?? 0));
        return w - learningRate * proximalGradient;
    });
}

/** Run one FedProx round: every client trains locally, then the server averages. */
export function fedProxRound(
    globalWeights: number[],
    clientTargets: number[][],
    learningRate: number,
    mu: number,
    localSteps: number,
): number[] {
    if (clientTargets.length === 0) {
        return [...globalWeights];
    }
    const updates = clientTargets.map((target) => {
        let local = [...globalWeights];
        for (let _step = 0; _step < localSteps; _step += 1) {
            local = fedProxClientStep(local, target, globalWeights, learningRate, mu);
        }
        return local;
    });
    return globalWeights.map((_w, d) =>
        updates.reduce((sum, u) => sum + (u[d] ?? 0), 0) / updates.length,
    );
}

/** Mean squared distance of a weight vector from a set of client targets. */
function meanLoss(weights: number[], targets: number[][]): number {
    if (targets.length === 0) {
        return 0;
    }
    return (
        targets.reduce((sum, target) => {
            const sq = weights.reduce((s, w, d) => s + (w - (target[d] ?? 0)) ** 2, 0);
            return sum + sq;
        }, 0) /
        (targets.length * Math.max(1, weights.length))
    );
}

function makeBars(weights: number[], states: EntityState[]): VisualEntity[] {
    return weights.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            globalWeights?: number[];
            clientTargets?: number[][];
            learningRate?: number;
            mu?: number;
            rounds?: number;
            localSteps?: number;
        } | null
    ) ?? {};
    const globalWeights: number[] = task.globalWeights ?? [0, 0, 0];
    const clientTargets: number[][] = task.clientTargets ?? [
        [1, 1, 1],
        [-1, -1, -1],
        [2, 0, -1],
    ];
    const learningRate =
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.1;
    const mu = typeof task.mu === "number" && task.mu >= 0 ? task.mu : 0.05;
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.floor(task.rounds)) : 6;
    const localSteps = typeof task.localSteps === "number" ? Math.max(1, Math.floor(task.localSteps)) : 2;

    let weights = [...globalWeights];
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(weights, weights.map(() => "idle")),
        edges: [],
        description: `FedProx with ${clientTargets.length} clients, proximal coefficient ${mu}; global model starts at the initial weights.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { round: 0, mu, loss: meanLoss(weights, clientTargets), weights: [...weights] },
    };
    step += 1;

    for (let round = 1; round <= rounds; round += 1) {
        weights = fedProxRound(weights, clientTargets, learningRate, mu, localSteps);
        const loss = meanLoss(weights, clientTargets);
        yield {
            stepNumber: step,
            entities: makeBars(weights, weights.map(() => "comparing")),
            edges: [],
            description: `Round ${round}: proximal local steps keep clients near the server, mean squared distance ${loss.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { round, mu, loss, weights: [...weights] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(weights, weights.map(() => "sorted")),
        edges: [],
        description: `After ${rounds} rounds the global weights are [${weights.map((w) => w.toFixed(3)).join(", ")}] with mean squared distance ${meanLoss(weights, clientTargets).toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { converged: true, round: rounds, mu, loss: meanLoss(weights, clientTargets), weights: [...weights] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When client data differ, plain federated averaging lets each client wander far from the shared model, and those drifts fights each other at aggregation. FedProx adds a leash: a quadratic penalty that grows with the distance from the current global weights. Clients may still take several local steps, but the penalty keeps their updates compatible, so the average is a more useful model.",
        invariants: [
            "Each client's local gradient equals its own gradient plus mu times the displacement from the global model.",
            "With mu equal to zero, FedProx reduces exactly to federated averaging.",
            "The server model is the arithmetic mean of the client models after local training.",
        ],
        correctness:
            "A client minimizes its local objective plus the proximal penalty by gradient descent, which is the proximal point method applied approximately. The added strongly convex term bounds how far local optima can stray from the global iterate, so aggregating them yields a descent step for the global objective under standard smoothness assumptions. The implementation's round update matches an explicit per-client simulation in the tests.",
        complexityRationale:
            "Each of the clients performs localSteps gradient evaluations over d parameters, and the server averages C vectors of length d, so a round costs O(C * localSteps * d). Only one global vector and the current client vectors are stored, giving O(C * d) space.",
        uses: [
            "Federated learning with non-identical client data",
            "On-device training where devices have different data distributions",
            "Stabilizing cross-silo federated models with few participants",
        ],
        references: [
            "Li et al., Federated Optimization in Heterogeneous Networks, MLSys 2020",
            "McMahan et al., Communication-Efficient Learning of Deep Networks, AISTATS 2017",
        ],
        workedExample:
            "With global weights (0, 0), one client target (1, 1), learning rate 0.1 and mu 0.5, the client gradient at the start is (-1, -1) and the proximal term is zero, so the first step moves to (0.1, 0.1). Later local steps are pulled back toward the server because the proximal term grows as the client drifts away.",
    },
    id: "fedprox",
    name: "FedProx",
    category: "ml-ai",
    complexity: { time: "O(rounds * clients * localSteps * d)", space: "O(clients * d)" },
    defaultInput: {
        globalWeights: [0, 0, 0],
        clientTargets: [
            [1, 1, 1],
            [-1, -1, -1],
            [2, 0, -1],
        ],
        learningRate: 0.1,
        mu: 0.05,
        rounds: 6,
        localSteps: 2,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the global weights",
        "for each communication round",
        "send the global weights to every selected client",
        "each client takes local gradient steps with an added mu times its distance from the global weights",
        "the server averages the client models into the new global weights",
        "done: report the final global model and its mean loss",
    ],
};

export default module;
