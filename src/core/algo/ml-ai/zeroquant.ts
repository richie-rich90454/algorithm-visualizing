/**
 * zeroquant.ts - ZeroQuant Group-Wise Post-Training Quantization
 *
 * ZeroQuant quantizes a trained weight vector without retraining by splitting
 * it into small groups and applying a separate affine mapping to each group.
 * Every group gets its own scale and zero point, so a few outlier groups do not
 * force the rest of the weights into a tiny part of the integer range. The
 * dequantized weights stay close to the originals while using far fewer bits.
 *
 * Time O(n), space O(n + g) for n weights in g groups.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface ZeroQuantResult {
    levels: number[];
    dequantized: number[];
    scales: number[];
    zeroPoints: number[];
    meanSquaredError: number;
}

/** Quantize weights group by group with asymmetric affine levels. */
export function zeroQuantize(weights: number[], groupSize: number, bits: number): ZeroQuantResult {
    const maxLevel = (1 << bits) - 1;
    const levels: number[] = [];
    const dequantized: number[] = [];
    const scales: number[] = [];
    const zeroPoints: number[] = [];

    for (let start = 0; start < weights.length; start += groupSize) {
        const group = weights.slice(start, start + groupSize);
        const min = Math.min(...group);
        const max = Math.max(...group);
        const scale = (max - min) / maxLevel || 1;
        const zeroPoint = min;
        scales.push(scale);
        zeroPoints.push(zeroPoint);
        group.forEach((w) => {
            const level = Math.max(0, Math.min(maxLevel, Math.round((w - zeroPoint) / scale)));
            levels.push(level);
            dequantized.push(zeroPoint + level * scale);
        });
    }

    const mse = weights.length > 0
        ? weights.reduce((sum, w, i) => sum + (w - dequantized[i]) ** 2, 0) / weights.length
        : 0;
    return { levels, dequantized, scales, zeroPoints, meanSquaredError: mse };
}

function makeBars(original: number[], result: ZeroQuantResult, current: number): VisualEntity[] {
    return result.dequantized.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: `${value.toFixed(2)}`,
        value,
        state: (i === current ? "active" : Math.abs(value - original[i]) < 1e-9 ? "sorted" : "comparing") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, original: original[i], level: result.levels[i] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<{ weights: number[]; groupSize: number; bits: number }> | null) ?? {};
    const weights: number[] = Array.isArray(task.weights) && task.weights.length > 0
        ? task.weights
        : [0.12, 0.31, -0.08, 0.55, -1.20, -0.95, 0.02, 0.44];
    const groupSize = typeof task.groupSize === "number" ? Math.max(1, task.groupSize) : 4;
    const bits = typeof task.bits === "number" ? Math.max(1, Math.min(8, task.bits)) : 4;
    const result = zeroQuantize(weights, groupSize, bits);
    const baseMeta = {
        count: weights.length,
        groupSize,
        bits,
        scales: result.scales,
        zeroPoints: result.zeroPoints,
        meanSquaredError: result.meanSquaredError,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(weights, result, -1),
        edges: [],
        description: `Quantize ${weights.length} weights in groups of ${groupSize} at ${bits} bits per weight.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...baseMeta, dequantized: result.dequantized },
    };
    step += 1;

    for (let i = 0; i < weights.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(weights, result, i),
            edges: [],
            description: `Weight ${i}: level ${result.levels[i]} in group ${Math.floor(i / groupSize)} gives ${result.dequantized[i].toFixed(3)}.`,
            codeLineNumber: i === 0 ? 2 : 3,
            layout: "array",
            meta: { ...baseMeta, current: i, dequantized: result.dequantized },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(weights, result, -1),
        edges: [],
        description: `Done: dequantized weights differ from the originals with mean squared error ${result.meanSquaredError.toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...baseMeta, dequantized: result.dequantized, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Post-training quantization compresses a model by mapping real weights onto a small set of integer levels without any retraining. ZeroQuant improves on a single global scale by giving each small group of weights its own scale and zero point. That way a group containing an outlier can use a wide range while a calm group keeps fine precision.",
        invariants: [
            "Every quantized level lies between zero and 2 to the bits power minus one.",
            "Each group scale equals its range divided by the number of levels.",
            "Every dequantized value is the zero point plus the level times the group scale.",
        ],
        correctness:
            "For each group the scale and zero point are computed from the group minimum and maximum, and each weight is mapped to the nearest clamped integer level; dequantization applies the affine map back. The tests recompute the levels and dequantized values independently and confirm that the absolute error never exceeds half a group scale. Because levels are clamped, outputs are always within the representable range.",
        complexityRationale:
            "Each weight is visited a constant number of times and each group is summarized by one min and max, so the method runs in O(n) time and O(n + g) space.",
        uses: [
            "Compressing large language models for inference",
            "On-device and edge deployment with tight memory budgets",
            "Post-training quantization pipelines that cannot retrain",
        ],
        references: [
            "Yao et al., ZeroQuant: Efficient and Affordable Post-Training Quantization for Large-Scale Transformers, 2022",
            "Nagel et al., A White Paper on Neural Network Quantization, 2021",
        ],
        workedExample:
            "For the group 0.12, 0.31, -0.08, 0.55 at four bits the minimum is -0.08 and maximum 0.55, giving scale 0.63 / 15 about 0.042. The value 0.12 maps near level five and dequantizes to about 0.13, an error well below half a scale.",
    },
    id: "zeroquant",
    name: "ZeroQuant",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n + g)" },
    defaultInput: {
        weights: [0.12, 0.31, -0.08, 0.55, -1.20, -0.95, 0.02, 0.44],
        groupSize: 4,
        bits: 4,
    },
    visualType: "array",
    run,
    pseudocode: [
        "split the weights into consecutive groups",
        "for each group find the minimum and maximum",
        "set scale to the range over the number of levels",
        "round each weight to its nearest integer level",
        "dequantize by the zero point plus level times scale",
        "done: report the compressed weights and error",
    ],
};

export default module;
