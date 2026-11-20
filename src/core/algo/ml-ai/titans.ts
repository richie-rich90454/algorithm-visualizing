/**
 * titans.ts - Titans Surprise-Driven Memory
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Titans gives a neural network a long-term memory that is trained at test
 * time by gradient descent. Each incoming token produces a prediction; the
 * gradient of its prediction error measures how surprised the memory is. That
 * surprise drives a momentum update, while a decay term gently forgets older
 * information so the memory adapts to a changing stream.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d) for memory dimension d
 *   Space: O(d) for the memory and its momentum
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the memory vector after each token.
 *   - Meta reports the surprise magnitude that drove the update.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TitansInput {
    tokens?: number[][];
    targets?: number[];
    memory?: number[];
    learningRate?: number;
    momentum?: number;
    decay?: number;
}

function makeBars(values: number[], state: EntityState, prefix = "m"): VisualEntity[] {
    return values.map((value, index) => ({
        id: `${prefix}-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function dot(a: number[], b: number[]): number {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
        total += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return total;
}

function magnitude(values: number[]): number {
    return Math.sqrt(dot(values, values));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TitansInput | null) ?? {};
    const tokens = task.tokens ?? [
        [1, 0],
        [0, 1],
        [1, 1],
        [-1, 0.5],
    ];
    const targets = task.targets ?? [0.5, 0.8, 1.2, -0.4];
    const memory = [...(task.memory ?? [0, 0])];
    const learningRate = typeof task.learningRate === "number" ? task.learningRate : 0.1;
    const momentum = typeof task.momentum === "number" ? task.momentum : 0.9;
    const decay = typeof task.decay === "number" ? task.decay : 0.01;

    const velocity = memory.map(() => 0);
    const surprises: number[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(memory, "idle"),
        edges: [],
        description: `Titans memory with dimension ${memory.length}, learning rate ${learningRate}, and decay ${decay}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, learningRate, momentum, decay, surprise: 0, loss: 0 },
    };
    step += 1;

    for (let t = 0; t < tokens.length; t += 1) {
        const token = tokens[t] ?? [];
        const prediction = dot(memory, token);
        const error = prediction - (targets[t] ?? 0);
        const gradient = memory.map((m, i) => error * (token[i] ?? 0));
        const surprise = magnitude(gradient);
        surprises.push(surprise);

        for (let i = 0; i < memory.length; i += 1) {
            velocity[i] = momentum * (velocity[i] ?? 0) + learningRate * (gradient[i] ?? 0);
            memory[i] = (1 - decay) * (memory[i] ?? 0) - (velocity[i] ?? 0);
        }

        yield {
            stepNumber: step,
            entities: makeBars(memory, "active"),
            edges: [],
            description: `Token ${t}: prediction ${prediction.toFixed(4)} versus target ${(targets[t] ?? 0).toFixed(4)} produced surprise ${surprise.toFixed(4)} and moved the memory.`,
            codeLineNumber: 4,
            layout: "array",
            meta: {
                step,
                token: t,
                prediction,
                error,
                surprise,
                loss: 0.5 * error * error,
                memory: memory.slice(),
                surprises: surprises.slice(),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(memory, "sorted"),
        edges: [],
        description: `Done: processed ${tokens.length} tokens; latest memory vector is [${memory.map((m) => m.toFixed(4)).join(", ")}].`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step, memory: memory.slice(), surprises, totalSurprise: surprises.reduce((a, v) => a + v, 0) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Most networks freeze their weights after training, so they cannot adapt to new information at inference time. Titans adds a fast memory that is trained on the fly: every token is compared with a prediction, and the size of the prediction error tells the system how surprised it should be. A large surprise produces a large gradient step, while momentum smooths the updates and decay slowly forgets stale content.",
        invariants: [
            "The surprise gradient equals the prediction error times the input token.",
            "The velocity accumulates a discounted history of surprise gradients.",
            "The memory is pulled toward its previous value by the decay factor before the velocity is subtracted.",
        ],
        correctness:
            "The prediction is a dot product of memory and token, so differentiating the squared error with respect to the memory gives exactly the error times the token. Applying the momentum recurrence and the decayed descent step therefore performs gradient descent on running surprise. The test replays the recurrence independently and checks that a token with a bigger prediction error always yields a bigger surprise magnitude.",
        complexityRationale:
            "Each token requires a dot product and an elementwise update of the d-dimensional memory, so the work is linear in the number of tokens times d, and only the memory and velocity vectors are stored.",
        uses: [
            "Language models with test-time adaptation to long contexts",
            "Streaming anomaly detection where surprise signals novelty",
            "Continual learning without replaying past examples",
        ],
        references: [
            "Behrouz et al., Titans: Learning to Memorize at Test Time, 2025",
            "Graves et al., Neural Turing Machines, 2014",
        ],
        workedExample:
            "Starting from memory zero, a token (1, 0) with target 0.5 predicts zero and errs by minus 0.5, giving gradient (-0.5, 0) and surprise 0.5. The velocity becomes negative and the memory moves positive, so the next similar token is predicted more accurately.",
    },
    id: "titans",
    name: "Titans Surprise-Driven Memory",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: {
        tokens: [
            [1, 0],
            [0, 1],
            [1, 1],
            [-1, 0.5],
        ],
        targets: [0.5, 0.8, 1.2, -0.4],
        memory: [0, 0],
        learningRate: 0.1,
        momentum: 0.9,
        decay: 0.01,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the memory vector and a zero velocity",
        "for each token compute the prediction as memory dot token",
        "set surprise to the gradient of the squared prediction error",
        "update velocity as momentum times velocity plus learning rate times surprise",
        "apply decay and subtract velocity to obtain the new memory",
        "record the surprise magnitude for this token",
        "done: report the final memory vector",
    ],
};

export default module;
