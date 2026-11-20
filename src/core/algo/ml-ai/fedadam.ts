/**
 * fedadam.ts - FedAdam: Adaptive Federated Averaging
 *
 * FedAvg treats the aggregate client update as an ordinary gradient step.
 * FedAdam instead feeds that update into an Adam optimizer on the server, with
 * bias-corrected first and second moments, so the server adapts its step to the
 * scale and noise of the aggregated client deltas.
 *
 * Time per round is O(C * d) to average C client deltas; space is O(d).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface FedAdamState {
    firstMoment: number[];
    secondMoment: number[];
    round: number;
}

/** Create the zero-initialized Adam moment state on the server. */
export function initFedAdamState(dim: number): FedAdamState {
    return {
        firstMoment: Array.from({ length: dim }, () => 0),
        secondMoment: Array.from({ length: dim }, () => 0),
        round: 0,
    };
}

/** Perform one server FedAdam update from an averaged client delta. */
export function fedAdamStep(
    globalWeights: number[],
    averageDelta: number[],
    state: FedAdamState,
    learningRate: number,
    beta1: number,
    beta2: number,
    tau: number,
): { weights: number[]; state: FedAdamState } {
    const round = state.round + 1;
    const firstMoment = globalWeights.map(
        (_, i) => beta1 * (state.firstMoment[i] ?? 0) + (1 - beta1) * (averageDelta[i] ?? 0),
    );
    const secondMoment = globalWeights.map(
        (_, i) =>
            beta2 * (state.secondMoment[i] ?? 0) + (1 - beta2) * (averageDelta[i] ?? 0) ** 2,
    );
    const hatM = firstMoment.map((m) => m / (1 - beta1 ** round));
    const hatV = secondMoment.map((v) => v / (1 - beta2 ** round));
    const weights = globalWeights.map(
        (w, i) => w + (learningRate * (hatM[i] ?? 0)) / (Math.sqrt(hatV[i] ?? 0) + tau),
    );
    return { weights, state: { firstMoment, secondMoment, round } };
}

/** Average the client deltas (clientWeights minus globalWeights). */
export function averageClientDeltas(globalWeights: number[], clientWeights: number[][]): number[] {
    if (clientWeights.length === 0) {
        return globalWeights.map(() => 0);
    }
    return globalWeights.map((_w, d) =>
        clientWeights.reduce((sum, w) => sum + ((w[d] ?? 0) - (globalWeights[d] ?? 0)), 0) /
        clientWeights.length,
    );
}

function makeBars(weights: number[], state: EntityState): VisualEntity[] {
    return weights.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state,
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
            clientDeltas?: number[][];
            learningRate?: number;
            beta1?: number;
            beta2?: number;
            tau?: number;
            rounds?: number;
        } | null
    ) ?? {};
    const globalWeights: number[] = task.globalWeights ?? [0, 0, 0];
    const clientDeltas: number[][] = task.clientDeltas ?? [
        [0.5, -0.2, 0.1],
        [0.3, 0.4, -0.1],
        [-0.1, 0.2, 0.4],
    ];
    const learningRate =
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.1;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.9;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.999;
    const tau = typeof task.tau === "number" ? task.tau : 1e-8;
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.floor(task.rounds)) : 5;

    let weights = [...globalWeights];
    let serverState = initFedAdamState(weights.length);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(weights, "idle"),
        edges: [],
        description: `FedAdam server starts at [${weights.map((w) => w.toFixed(2)).join(", ")}] with ${clientDeltas.length} client deltas per round.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { round: 0, weights: [...weights] },
    };
    step += 1;

    for (let round = 1; round <= rounds; round += 1) {
        // The provided client deltas are already client-minus-global vectors.
        const delta = globalWeights.map((_w, d) =>
            clientDeltas.reduce((sum, c) => sum + (c[d] ?? 0), 0) / Math.max(1, clientDeltas.length),
        );
        const result = fedAdamStep(weights, delta, serverState, learningRate, beta1, beta2, tau);
        weights = result.weights;
        serverState = result.state;
        yield {
            stepNumber: step,
            entities: makeBars(weights, "comparing"),
            edges: [],
            description: `Round ${round}: server applies a bias-corrected Adam step to the average client delta ${delta.map((v) => v.toFixed(3)).join(", ")}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { round, weights: [...weights], delta },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(weights, "sorted"),
        edges: [],
        description: `After ${rounds} rounds the server model is [${weights.map((w) => w.toFixed(3)).join(", ")}].`,
        codeLineNumber: 5,
        layout: "array",
        meta: { converged: true, round: rounds, weights: [...weights] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Federated averaging adds the mean client update directly to the model, which can be badly scaled when clients disagree. FedAdam keeps running averages of that aggregate update and its square on the server, then applies the Adam normalization. The server therefore takes steady, scale-aware steps even when the size of the aggregated client signal changes from round to round.",
        invariants: [
            "The server update uses the mean of the client deltas, not the raw client weights.",
            "The first and second moments are bias-corrected before the step is formed.",
            "The denominator is the square root of the corrected second moment plus a stability term tau.",
        ],
        correctness:
            "FedAdam is exactly the Adam update rule applied on the server with the averaged client delta as the gradient. Bias correction divides each moment by one minus the decay raised to the round number, which removes the zero-start bias. The tests reproduce every round with an independent Adam computation and confirm that the first server step of each coordinate has magnitude approximately the learning rate, the defining Adam behavior.",
        complexityRationale:
            "Averaging C client deltas of width d costs O(C * d), and the server moment update is O(d), so a round is O(C * d). Two moment vectors and the global model are stored, using O(d) server space.",
        uses: [
            "Cross-device federated learning with varying client participation",
            "Federated tuning where client updates have uneven scales",
            "Personalization pipelines that need a stable global server optimizer",
        ],
        references: [
            "Reddi et al., Adaptive Federated Optimization, ICLR 2021",
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
        ],
        workedExample:
            "With global weight 0, a single coordinate delta 0.4 and learning rate 0.1, the first moment is 0.04 and the second moment is 0.0016 at beta1 0.9 and beta2 0.999. After bias correction the ratio of first to square-root second moment is 1, so the server weight moves by about 0.1, independent of the delta magnitude.",
    },
    id: "fedadam",
    name: "FedAdam",
    category: "ml-ai",
    complexity: { time: "O(rounds * clients * d)", space: "O(d)" },
    defaultInput: {
        globalWeights: [0, 0, 0],
        clientDeltas: [
            [0.5, -0.2, 0.1],
            [0.3, 0.4, -0.1],
            [-0.1, 0.2, 0.4],
        ],
        learningRate: 0.1,
        beta1: 0.9,
        beta2: 0.999,
        tau: 1e-8,
        rounds: 5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize server weights and zero Adam moments",
        "for each communication round",
        "compute the average delta of the client updates",
        "accumulate the first and second moments of that delta",
        "bias-correct both moments by the round number",
        "add learning rate times corrected first moment over square root corrected second moment plus tau",
        "done: report the final server model",
    ],
};

export default module;
