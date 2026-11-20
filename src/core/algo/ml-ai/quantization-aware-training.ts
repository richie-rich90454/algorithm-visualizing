/**
 * quantization-aware-training.ts - Quantization-Aware Training (Fake Quantization)
 *
 * QAT simulates low-precision inference during training. Each real-valued
 * weight is rounded to an integer level and immediately dequantized back to a
 * float, so the forward pass sees the same rounding the deployed model will.
 * The straight-through estimator lets gradients pass through the rounding
 * unchanged, allowing ordinary gradient descent to adapt the weights.
 *
 * Time O(n) per simulated step, space O(n) for the stored weights.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface QatInput {
    weights?: number[];
    bits?: number;
    scale?: number;
    zeroPoint?: number;
    gradients?: number[];
    learningRate?: number;
}

/** Round a real value to a simulated integer level, clamp, then dequantize. */
export function fakeQuantize(x: number, scale: number, zeroPoint: number, qmin: number, qmax: number): { q: number; value: number } {
    const q = Math.min(qmax, Math.max(qmin, Math.round(x / scale) + zeroPoint));
    return { q, value: (q - zeroPoint) * scale };
}

const COLUMNS = ["weight", "int q", "dequant", "error"];

function makeCells(weights: number[], dequant: number[], levels: number[], revealed: number, active: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    weights.forEach((x, row) => {
        const values = [x, levels[row] ?? 0, dequant[row] ?? 0, x - (dequant[row] ?? 0)];
        COLUMNS.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === active ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${column} ${(values[col] ?? 0).toFixed(4)}` : "?",
                value: shown ? (values[col] ?? 0) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as QatInput | null) ?? {};
    const weights: number[] = Array.isArray(task.weights) && task.weights.length > 0
        ? task.weights
        : [-1.8, -0.9, -0.2, 0.15, 0.7, 1.4];
    const bits = Math.max(2, Math.min(8, Math.floor(Number(task.bits ?? 4)) || 4));
    const qmin = -(2 ** (bits - 1));
    const qmax = 2 ** (bits - 1) - 1;
    const maxAbs = Math.max(...weights.map(Math.abs));
    const scale = typeof task.scale === "number" && task.scale > 0 ? task.scale : maxAbs > 0 ? maxAbs / qmax : 1;
    const zeroPoint = typeof task.zeroPoint === "number" ? Math.round(task.zeroPoint) : 0;
    const quantized = weights.map((x) => fakeQuantize(x, scale, zeroPoint, qmin, qmax));
    const levels = quantized.map((q) => q.q);
    const dequant = quantized.map((q) => q.value);
    const mse = weights.reduce((sum, x, i) => sum + (x - (dequant[i] ?? 0)) ** 2, 0) / weights.length;
    const gradients = Array.isArray(task.gradients) && task.gradients.length === weights.length ? task.gradients : undefined;
    const lr = Number(task.learningRate ?? 0.1);
    const weightsAfter = gradients ? weights.map((x, i) => x - lr * (gradients[i] ?? 0)) : undefined;
    const base = { rows: weights.length, cols: COLUMNS.length, bits, scale, zeroPoint, qmin, qmax, mse, levels, dequant };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(weights, dequant, levels, -1, -1),
        edges: [],
        description: `QAT fake-quantizes ${weights.length} weights to ${bits}-bit levels with scale ${scale.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, ...(weightsAfter ? { weightsAfter } : {}) },
    };
    step += 1;

    for (let i = 0; i < weights.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(weights, dequant, levels, i, i),
            edges: [],
            description: `Weight ${i}: ${(weights[i] ?? 0).toFixed(4)} maps to integer ${levels[i]}, dequantizes to ${(dequant[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: levels[i] === qmin || levels[i] === qmax ? 3 : 2,
            layout: "grid",
            meta: { ...base, active: i, ...(weightsAfter ? { weightsAfter } : {}) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(weights, dequant, levels, weights.length - 1, -1),
        edges: [],
        description: gradients
            ? `Done: mean square error ${mse.toFixed(6)}; straight-through step moved weights by the gradient.`
            : `Done: mean square quantization error is ${mse.toFixed(6)}.`,
        codeLineNumber: gradients ? 6 : 7,
        layout: "grid",
        meta: { ...base, mse, done: true, ...(weightsAfter ? { weightsAfter } : {}), stepped: Boolean(gradients) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A model trained in full precision can lose accuracy once its weights are rounded for deployment. Quantization-aware training inserts a fake quantization operation into the forward pass: round each weight to a low-precision level, then immediately convert it back to a float. The network therefore learns weights that already tolerate rounding. During backward pass the straight-through estimator pretends the rounding was the identity, so gradients still flow.",
        invariants: [
            "Every simulated integer level lies within the signed range defined by the bit width.",
            "The dequantized value is the integer level minus the zero point times the scale.",
            "The straight-through estimator passes the gradient through unchanged, so the weight update is the ordinary gradient step.",
        ],
        correctness:
            "The fake quantizer divides by the scale, adds the zero point, rounds to the nearest integer, clamps to the signed range, and multiplies back by the scale, which is exactly the affine quantization map used at inference. The reported mean square error is the average of the squared differences between original and dequantized weights, so it is nonnegative and zero only when every weight lands on a level. The straight-through step updates the real weight by minus the learning rate times its gradient, bypassing the nondifferentiable rounding. The tests recompute all of this independently and verify the level bounds, the reconstruction formula, and the update.",
        complexityRationale:
            "Quantizing and updating each of the n weights is constant work, so one simulated step costs O(n) time and O(n) space for the stored tables.",
        uses: [
            "Deploying accurate integer-quantized neural networks on edge devices",
            "Low-bit inference for mobile and embedded accelerators",
            "Reducing model size and memory bandwidth before deployment",
        ],
        references: [
            "Jacob et al., Quantization and Training of Neural Networks for Efficient Integer-Arithmetic-Only Inference, CVPR, 2018",
            "Bengio, Leonard, and Courville, Estimating or Propagating Gradients Through Stochastic Neurons, 2013",
        ],
        workedExample:
            "With four bits the signed range is minus eight to seven, and weights in minus 1.8 to 1.4 give a scale around 0.2. A weight of 0.15 rounds to level 1 and dequantizes to 0.2, an error of 0.05. A gradient step then adjusts the underlying real weight, and the next forward pass re-quantizes it.",
    },
    id: "quantization-aware-training",
    name: "Quantization-Aware Training",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        weights: [-1.8, -0.9, -0.2, 0.15, 0.7, 1.4],
        bits: 4,
        learningRate: 0.1,
        gradients: [0.2, -0.1, 0.05, -0.3, 0.15, 0.1],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a scale and zero point from the weight range and bit width",
        "for each real weight divide by scale and add the zero point",
        "round to the nearest integer and clamp to the signed level range",
        "multiply the integer level back by the scale to get the fake-quantized weight",
        "record the squared difference as the quantization error",
        "on a training step pass the gradient through the rounding unchanged",
        "subtract the learning rate times the gradient from each real weight",
        "done: report the error and the updated weights",
    ],
};

export default module;
