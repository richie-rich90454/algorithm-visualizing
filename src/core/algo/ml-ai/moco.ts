/**
 * moco.ts - Momentum Contrast
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MoCo trains an encoder with contrastive learning by keeping a large queue of
 * negative keys from previous batches. A query matches one positive key and
 * must beat all queued negatives under an InfoNCE softmax. The key encoder is
 * an exponential moving average of the query encoder, which keeps the negatives
 * consistent as the representation evolves.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(K) per step for a queue of K negatives
 *   Space: O(K + d) for the queue and encoder weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the queue of key values before and after the FIFO update.
 *   - Meta reports the InfoNCE loss and the updated key encoder.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MocoInput {
    queryWeights?: number[];
    keyWeights?: number[];
    queryInput?: number[];
    keyInput?: number[];
    queue?: number[];
    temperature?: number;
    momentum?: number;
}

function makeBars(values: number[], state: EntityState, prefix = "k"): VisualEntity[] {
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

/** Numerically stable log of a sum of exponentials. */
function logSumExp(values: number[]): number {
    if (values.length === 0) {
        return -Infinity;
    }
    const max = Math.max(...values);
    return max + Math.log(values.reduce((sum, v) => sum + Math.exp(v - max), 0));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MocoInput | null) ?? {};
    const queryWeights = [...(task.queryWeights ?? [0.5, -0.2, 0.8])];
    const keyWeights = [...(task.keyWeights ?? [0.5, -0.2, 0.8])];
    const queryInput = task.queryInput ?? [1, 0.5, -0.5];
    const keyInput = task.keyInput ?? [0.9, 0.4, -0.6];
    const queue = [...(task.queue ?? [-0.4, 0.2, -0.1, 0.6])];
    const temperature = typeof task.temperature === "number" && task.temperature > 0 ? task.temperature : 0.2;
    const momentum = typeof task.momentum === "number" ? task.momentum : 0.99;

    const query = dot(queryWeights, queryInput);
    const positiveKey = dot(keyWeights, keyInput);
    const posLogit = (query * positiveKey) / temperature;
    const negLogits = queue.map((key) => (query * key) / temperature);
    const loss = logSumExp([posLogit, ...negLogits]) - posLogit;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(queue, "idle"),
        edges: [],
        description: `MoCo with a queue of ${queue.length} negatives and temperature ${temperature}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, queueLength: queue.length, temperature, momentum, loss: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([posLogit, ...negLogits], "comparing", "logit"),
        edges: [],
        description: `Query ${query.toFixed(4)} gives positive logit ${posLogit.toFixed(4)} against ${negLogits.length} negative logits.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { step, query, positiveKey, posLogit, negLogits, loss },
    };
    step += 1;

    const before = queue.slice();
    if (queue.length > 0) {
        queue.shift();
    }
    queue.push(positiveKey);
    yield {
        stepNumber: step,
        entities: makeBars(queue, "active"),
        edges: [],
        description: `Dequeued the oldest negative and enqueued the new key ${positiveKey.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { step, previousQueue: before, queue: queue.slice(), enqueued: positiveKey },
    };
    step += 1;

    const beforeWeights = keyWeights.slice();
    for (let i = 0; i < keyWeights.length; i += 1) {
        keyWeights[i] = momentum * (keyWeights[i] ?? 0) + (1 - momentum) * (queryWeights[i] ?? 0);
    }
    yield {
        stepNumber: step,
        entities: makeBars(keyWeights, "sorted", "keyw"),
        edges: [],
        description: `Done: InfoNCE loss ${loss.toFixed(6)}, key encoder advanced by momentum ${momentum}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            step,
            loss,
            queue: queue.slice(),
            keyWeights: keyWeights.slice(),
            previousKeyWeights: beforeWeights,
            momentum,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Good visual representations put two views of the same image close together and views of different images far apart. MoCo keeps a large queue of negatives from earlier batches so the contrast can use many examples without a huge batch. The key encoder that encodes those negatives is not learned directly; it trails the query encoder by an exponential moving average, which keeps old keys comparable to new queries.",
        invariants: [
            "The positive key comes from the slowly updated key encoder, not the query encoder.",
            "The queue is first-in-first-out, so the oldest negative is removed on each step.",
            "The InfoNCE denominator contains the positive logit plus every queued negative logit.",
        ],
        correctness:
            "Scaling the query-key dot product by one over temperature gives the logit, and the InfoNCE loss is the negative log softmax probability of the positive, computed here as log-sum-exp of all logits minus the positive logit. That identity is exact and numerically stable. The key encoder update is exactly the exponential moving average, and the test independently checks the loss, the FIFO queue order, and the averaged weights.",
        complexityRationale:
            "Computing the loss scans the queue once, and the encoder update scans the d weights once, so the time is linear in K plus d with matching linear space for the queue and weights.",
        uses: [
            "Self-supervised pretraining of image encoders",
            "Visual representation learning with small batches and large negative sets",
            "Transfer to detection and segmentation with limited labels",
        ],
        references: [
            "He et al., Momentum Contrast for Unsupervised Visual Representation Learning, 2020",
            "Gutmann and Hyvarinen, Noise-Contrastive Estimation, 2010",
        ],
        workedExample:
            "With query 0.7, positive key 0.8, and temperature 0.2, the positive logit is 2.8. If the largest negative logit is 2.0, the log-sum-exp is slightly above 2.8, so the loss is a small positive number, meaning the query correctly ranks the positive above the negatives.",
    },
    id: "moco",
    name: "Momentum Contrast",
    category: "ml-ai",
    complexity: { time: "O(K + d)", space: "O(K + d)" },
    defaultInput: {
        queryWeights: [0.5, -0.2, 0.8],
        keyWeights: [0.5, -0.2, 0.8],
        queryInput: [1, 0.5, -0.5],
        keyInput: [0.9, 0.4, -0.6],
        queue: [-0.4, 0.2, -0.1, 0.6],
        temperature: 0.2,
        momentum: 0.99,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the query encoder, key encoder, and a negative queue",
        "encode the query and the positive key with their respective encoders",
        "divide the query-key dot products by the temperature",
        "compute InfoNCE as log-sum-exp of all logits minus the positive logit",
        "dequeue the oldest key and enqueue the new positive key",
        "move the key encoder by exponential moving average of the query encoder",
        "record the loss and the advanced queue",
        "done: report the contrastive loss and updated encoders",
    ],
};

export default module;
