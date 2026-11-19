/**
 * batch-renormalization.ts - Batch Renormalization
 *
 * Batch renormalization fixes the train and inference mismatch of ordinary
 * batch normalization. During training it uses the batch statistics but
 * corrects them with two clipped factors r and d that measure how far the batch
 * has drifted from the running statistics. At inference the correction is
 * folded away and only the running statistics are used.
 *
 * Time:  O(n) for a batch of n values
 * Space: O(n) for the drawn entities
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BatchRenormInput {
    batch?: number[];
    runningMean?: number;
    runningVar?: number;
    momentum?: number;
    rMax?: number;
    dMax?: number;
    epsilon?: number;
}

function clamp(value: number, low: number, high: number): number {
    return Math.min(high, Math.max(low, value));
}

function mean(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);
}

function variance(values: number[], mu: number): number {
    return values.reduce((sum, v) => sum + (v - mu) * (v - mu), 0) / Math.max(1, values.length);
}

function makeBars(input: number[], output: number[], showOutput: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < input.length; i += 1) {
        entities.push({
            id: `input-${i}`,
            type: "bar" as const,
            label: `x${i}: ${(input[i] ?? 0).toFixed(3)}`,
            value: input[i] ?? 0,
            state: "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "input" },
        });
        entities.push({
            id: `output-${i}`,
            type: "bar" as const,
            label: showOutput ? `y${i}: ${(output[i] ?? 0).toFixed(3)}` : `y${i}: ?`,
            value: showOutput ? output[i] ?? 0 : 0,
            state: (showOutput ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "output", shown: showOutput },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BatchRenormInput | null) ?? {};
    const batch: number[] = task.batch?.length
        ? task.batch.slice()
        : [1.2, 0.8, 2.3, -0.5, 0.1, 1.7, -1.1, 0.4];
    const momentum = typeof task.momentum === "number" && task.momentum >= 0 && task.momentum < 1 ? task.momentum : 0.9;
    const rMax = typeof task.rMax === "number" && task.rMax >= 1 ? task.rMax : 3;
    const dMax = typeof task.dMax === "number" && task.dMax >= 0 ? task.dMax : 2;
    const eps = typeof task.epsilon === "number" && task.epsilon > 0 ? task.epsilon : 1e-3;
    let runningMean = typeof task.runningMean === "number" ? task.runningMean : 0;
    let runningVar = typeof task.runningVar === "number" && task.runningVar > 0 ? task.runningVar : 1;

    const muB = mean(batch);
    const varB = variance(batch, muB);
    const stdB = Math.sqrt(varB + eps);
    const stdRunning = Math.sqrt(runningVar + eps);
    const rRaw = stdB / stdRunning;
    const dRaw = (muB - runningMean) / stdRunning;
    const r = clamp(rRaw, 1 / rMax, rMax);
    const d = clamp(dRaw, -dMax, dMax);
    const output = batch.map((x) => r * ((x - muB) / stdB) + d);
    const newRunningMean = momentum * runningMean + (1 - momentum) * muB;
    const newRunningVar = momentum * runningVar + (1 - momentum) * varB;
    const inference = batch.map((x) => (x - newRunningMean) / Math.sqrt(newRunningVar + eps));
    const base = { muB, varB, rRaw, dRaw, r, d, rMax, dMax, eps, batchSize: batch.length };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(batch, output, false),
        edges: [],
        description: `Load a batch of ${batch.length} values with running mean ${runningMean.toFixed(3)} and variance ${runningVar.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, runningMean, runningVar, phase: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(batch, output, false),
        edges: [],
        description: `Batch mean is ${muB.toFixed(4)} and batch variance is ${varB.toFixed(4)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...base, runningMean, runningVar, phase: 1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(batch, output, false),
        edges: [],
        description: `Raw correction factors r is ${rRaw.toFixed(4)} and d is ${dRaw.toFixed(4)}; after clipping r is ${r.toFixed(4)} and d is ${d.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...base, runningMean, runningVar, phase: 2 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(batch, output, true),
        edges: [],
        description: `Normalize each value with y equals r times the standardized batch value plus d; output mean is ${mean(output).toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...base, runningMean, runningVar, phase: 3, output: output.slice(), outputMean: mean(output), outputVar: variance(output, mean(output)) },
    };
    step += 1;

    runningMean = newRunningMean;
    runningVar = newRunningVar;
    yield {
        stepNumber: step,
        entities: makeBars(batch, inference, true),
        edges: [],
        description: `Update running statistics to mean ${runningMean.toFixed(4)} and variance ${runningVar.toFixed(4)} for inference.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...base, runningMean, runningVar, phase: 4, output: inference.slice(), outputMean: mean(inference), outputVar: variance(inference, mean(inference)) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(batch, inference, true),
        edges: [],
        description: `Done: inference uses only the running statistics; normalized values have mean ${mean(inference).toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...base, runningMean, runningVar, phase: 5, output: inference.slice(), outputMean: mean(inference), outputVar: variance(inference, mean(inference)), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Batch normalization subtracts the batch mean and divides by the batch standard deviation, which makes the training and inference computations disagree. Batch renormalization keeps those corrections but scales and shifts them by clipped factors r and d, so a small or drifted batch cannot distort training, while inference still uses the stable running statistics.",
        invariants: [
            "The batch variance is computed with a denominator of the batch size.",
            "The factor r is the batch standard deviation over the running standard deviation, clipped to a fixed band.",
            "The factor d is the standardized drift of the batch mean, clipped symmetrically.",
        ],
        correctness:
            "Standardizing the batch gives values of mean zero and variance one, so multiplying by r and adding d yields output mean d and variance r squared, which the test verifies numerically. Clipping r and d bounds how much a single anomalous batch can move the normalization, and the running statistics update with the usual exponential moving average.",
        complexityRationale:
            "Computing the mean, variance, factors and outputs each scan the batch once, so time is O(n) with a constant number of passes. The output entities also require O(n) space.",
        uses: [
            "Stabilizing training with small or non-independent batches",
            "Reducing the train and inference gap in convolutional networks",
            "A drop-in replacement for batch normalization layers",
        ],
        references: [
            "Ioffe, Batch Renormalization, arXiv, 2017",
            "Ioffe and Szegedy, Batch Normalization, ICML, 2015",
        ],
        workedExample:
            "With running mean zero and variance one, a batch whose mean is 0.38 and variance about 1.02 gives raw r near one and raw d near 0.38, both inside their bands. Each value is standardized with the batch statistics, multiplied by r and shifted by d, so the output has mean about 0.38 and variance about one.",
    },
    id: "batch-renormalization",
    name: "Batch Renormalization",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { batch: [1.2, 0.8, 2.3, -0.5, 0.1, 1.7, -1.1, 0.4], runningMean: 0, runningVar: 1, momentum: 0.9, rMax: 3, dMax: 2, epsilon: 0.001 },
    visualType: "array",
    run,
    pseudocode: [
        "read the batch and the running statistics",
        "compute the batch mean and variance",
        "form raw factors r and d from the batch and running statistics",
        "clip r to its band and d to its symmetric range",
        "set each output to r times standardized value plus d",
        "update the running statistics with momentum",
        "done: report inference outputs using running statistics",
    ],
};

export default module;
