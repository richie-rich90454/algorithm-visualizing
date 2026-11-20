/**
 * federated-averaging.ts - Federated Averaging (FedAvg)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Federated averaging trains one shared model across clients that keep their
 * data local. In each communication round the server sends the current global
 * weights to a set of clients. Each client runs a few steps of gradient descent
 * on its own data and returns its updated weights, never the data itself. The
 * server replaces the global weights with the sample-count-weighted average of
 * the client updates. Clients with more local examples therefore contribute
 * more to the next global model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * clients * steps * d) for d model dimensions
 *   Space: O(clients * d) for the returned client models
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the global weight and each client's local weight per dimension.
 *   - The client currently training is highlighted yellow; the aggregated
 *     global model after each round is green.
 *   - The final frame reports the learned global model and total sample count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FedClient {
    samples?: number;
    target?: number[];
}

interface FedAvgInput {
    dim?: number;
    rounds?: number;
    lr?: number;
    localSteps?: number;
    clients?: FedClient[];
}

/** Run local gradient steps on squared error toward a client's local optimum. */
function localTrain(global: number[], target: number[], lr: number, steps: number): number[] {
    let w = [...global];
    for (let s = 0; s < steps; s += 1) {
        w = w.map((wi, j) => wi - lr * (wi - (target[j] ?? 0)));
    }
    return w;
}

/** Sample-count-weighted average of the client models. */
function aggregate(models: number[][], counts: number[], dim: number): number[] {
    const total = counts.reduce((sum, c) => sum + c, 0);
    const result = Array.from({ length: dim }, () => 0);
    for (let k = 0; k < models.length; k += 1) {
        const weight = counts[k] ?? 0;
        for (let j = 0; j < dim; j += 1) {
            result[j] = (result[j] ?? 0) + (weight / total) * (models[k]![j] ?? 0);
        }
    }
    return result;
}

/** Build the model bars for one frame. */
function makeBars(
    dim: number,
    global: number[],
    locals: number[][],
    highlightedClient: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let j = 0; j < dim; j += 1) {
        entities.push({
            id: `bar-global-${j}`,
            type: "bar" as const,
            label: `w${j} global: ${(global[j] ?? 0).toFixed(3)}`,
            value: global[j] ?? 0,
            state: done ? "sorted" : "active",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { dimension: j, client: -1, role: "global" },
        });
        for (let k = 0; k < locals.length; k += 1) {
            entities.push({
                id: `bar-client-${k}-${j}`,
                type: "bar" as const,
                label: `w${j} C${k}: ${(locals[k]![j] ?? 0).toFixed(3)}`,
                value: locals[k]![j] ?? 0,
                state: k === highlightedClient ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { dimension: j, client: k, role: "local" },
            });
        }
    }
    return entities;
}

/** The federated averaging generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FedAvgInput | null) ?? {};
    const clientsRaw: FedClient[] = Array.isArray(task.clients) && task.clients.length > 0
        ? task.clients
        : [
              { samples: 10, target: [1, 1] },
              { samples: 20, target: [-1, 2] },
              { samples: 30, target: [3, -2] },
          ];
    const dim = Math.max(1, Math.min(4, Math.floor(task.dim ?? 2)));
    const rounds = Math.max(1, Math.min(8, Math.floor(task.rounds ?? 3)));
    const lr = typeof task.lr === "number" && task.lr > 0 ? Math.min(1, task.lr) : 0.3;
    const localSteps = Math.max(1, Math.min(10, Math.floor(task.localSteps ?? 2)));
    const defaults = [[1, 1], [-1, 2], [3, -2]];
    const counts = clientsRaw.map((c, k) => Math.max(1, Math.floor((c.samples ?? 10))));
    const targets = clientsRaw.map((c, k) => {
        const t = Array.isArray(c.target) ? c.target : (defaults[k % defaults.length] ?? [0, 0]);
        return Array.from({ length: dim }, (_, j) => t[j] ?? 0);
    });
    const totalSamples = counts.reduce((sum, c) => sum + c, 0);
    let global = Array.from({ length: dim }, () => 0);
    let step = 0;

    const makeMeta = (round: number, client: number, done: boolean) => ({
        dim,
        rounds,
        round,
        client,
        lr,
        localSteps,
        totalSamples,
        globalModel: [...global],
        done,
    });

    yield {
        stepNumber: step++,
        entities: makeBars(dim, global, targets.map(() => Array.from({ length: dim }, () => 0)), -1, false),
        edges: [],
        description: `Server initializes a ${dim}-weight global model; ${clientsRaw.length} clients hold ${totalSamples} local examples.`,
        codeLineNumber: 0,
        layout: "array",
        meta: makeMeta(0, -1, false),
    };

    for (let round = 1; round <= rounds; round += 1) {
        const locals: number[][] = targets.map((target) => localTrain(global, target, lr, localSteps));
        for (let k = 0; k < targets.length; k += 1) {
            yield {
                stepNumber: step++,
                entities: makeBars(dim, global, locals, k, false),
                edges: [],
                description: `Round ${round}: client ${k} trains locally on ${counts[k]} example(s) for ${localSteps} step(s) and returns its weights.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { ...makeMeta(round, k, false), localModel: [...locals[k]!] },
            };
        }
        global = aggregate(locals, counts, dim);
        yield {
            stepNumber: step++,
            entities: makeBars(dim, global, locals, -1, false),
            edges: [],
            description: `Round ${round}: server averages client models weighted by sample count into the new global model.`,
            codeLineNumber: 4,
            layout: "array",
            meta: makeMeta(round, -1, false),
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(dim, global, targets.map(() => [...global]), -1, true),
        edges: [],
        description: `After ${rounds} rounds the global model is [${global.map((w) => w.toFixed(3)).join(", ")}].`,
        codeLineNumber: 6,
        layout: "array",
        meta: makeMeta(rounds, -1, true),
    };
}

/** The federated averaging module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of shipping everyone's data to one machine, send the model to the data. Clients train briefly on their own examples and send back only weight updates. The server averages those updates, weighting each client by how many examples it holds, so a phone with a large local dataset influences the shared model more than one with a tiny dataset.",
        invariants: [
            "Raw client data never leaves a client; only model weights are returned.",
            "The aggregation weights are the sample counts divided by the total sample count.",
            "The global weights always equal a convex combination of the client weights.",
        ],
        correctness:
            "Each client performs gradient descent on its local squared-error objective, moving its weights toward the least-squares optimum of its own data. The server update is the sample-weighted mean of those local models, which is exactly the minimizer of the weighted sum of the local objectives when those objectives are quadratic and share the same curvature. Repeating the rounds composes these local improvements into a global model that fits the pooled data distribution without centralizing the examples.",
        complexityRationale:
            "Each round runs localSteps gradient steps for each of K clients over d weights, O(rounds * K * localSteps * d) time, and the aggregation is O(K * d). The server holds one model per client during aggregation, so space is O(K * d).",
        uses: [
            "Training models on data stored on mobile phones and edge devices",
            "Collaborative learning across hospitals with privacy constraints",
            "Cross-device and cross-silo learning where data cannot be centralized",
        ],
        references: [
            "McMahan et al., Communication-Efficient Learning of Deep Networks from Decentralized Data, 2017",
            "Kairouz et al., Advances and Open Problems in Federated Learning, 2021",
        ],
        workedExample:
            "Two clients hold 10 and 30 examples with local optima 1 and 3. Starting from global weight 0, one full local step with learning rate 0.5 gives local weights 0.5 and 1.5. The server averages them as (10 times 0.5 plus 30 times 1.5) over 40, giving 1.25, closer to the larger client's optimum.",
    },
    id: "federated-averaging",
    name: "Federated Averaging (FedAvg)",
    category: "parallel-distributed",
    complexity: { time: "O(rounds * clients * steps * d)", space: "O(clients * d)" },
    defaultInput: {
        dim: 2,
        rounds: 3,
        lr: 0.3,
        localSteps: 2,
        clients: [
            { samples: 10, target: [1, 1] },
            { samples: 20, target: [-1, 2] },
            { samples: 30, target: [3, -2] },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the global model at the server",
        "for each communication round",
        "send the current global weights to the clients",
        "each client runs local gradient steps on its own data",
        "clients return their updated weights and sample counts",
        "average the weights weighted by each client's sample count",
        "install the weighted average as the new global model",
        "done: report the final global model",
    ],
};

export default module;
