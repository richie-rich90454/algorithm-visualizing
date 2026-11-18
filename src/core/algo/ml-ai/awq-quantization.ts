/**
 * awq-quantization.ts - Activation-Aware Weight Quantization (AWQ) Core
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AWQ reduces the error of low-bit weight quantization by protecting the small
 * set of weight channels that carry the most activation energy. A channel's
 * weights are scaled up by a factor derived from its calibration activation
 * magnitude before grouping and rounding, then divided back after
 * dequantization. Because rounding error is proportional to the group step
 * size, scaling a salient channel up makes its relative rounding error smaller
 * where it matters most. This module implements the exact per-group symmetric
 * quantization and the activation-aware rescaling in a small teaching model;
 * it does not perform real mixed-precision kernels or search scale factors.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n) for n weights in one pass over groups
 *   Space: O(n) for the scales, quantized codes, and reconstructed weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each bar is a weight; the current group is highlighted while quantized.
 *   - The final frame compares activation-weighted error before and after AWQ.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AwqInput {
    weights?: number[];
    activations?: number[];
    groupSize?: number;
    bits?: number;
}

function makeBars(
    weights: number[],
    vanilla: number[],
    awq: number[],
    activeGroup: number,
    groupSize: number,
): VisualEntity[] {
    return weights.map((weight, index) => {
        const group = Math.floor(index / groupSize);
        const state: EntityState = activeGroup < 0 ? "sorted" : group === activeGroup ? "active" : group < activeGroup ? "visited" : "unvisited";
        return {
            id: `w-${index}`,
            type: "bar" as const,
            label: `${weight.toFixed(2)} -> ${(awq[index] ?? 0).toFixed(2)}`,
            value: Number((awq[index] ?? 0).toFixed(6)),
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                index,
                group,
                weight: Number(weight.toFixed(6)),
                vanilla: Number((vanilla[index] ?? 0).toFixed(6)),
                awq: Number((awq[index] ?? 0).toFixed(6)),
            },
        };
    });
}

/** Symmetric group quantization: return reconstructed values and codes. */
function quantize(values: number[], groupSize: number, bits: number): { recon: number[]; codes: number[]; scales: number[] } {
    const qmax = Math.pow(2, bits - 1) - 1;
    const qmin = -Math.pow(2, bits - 1);
    const recon = new Array<number>(values.length).fill(0);
    const codes = new Array<number>(values.length).fill(0);
    const scales: number[] = [];
    for (let start = 0; start < values.length; start += groupSize) {
        const end = Math.min(start + groupSize, values.length);
        let maxAbs = 0;
        for (let i = start; i < end; i += 1) {
            maxAbs = Math.max(maxAbs, Math.abs(values[i] ?? 0));
        }
        const scale = maxAbs / qmax;
        scales.push(scale);
        for (let i = start; i < end; i += 1) {
            const raw = scale > 0 ? (values[i] ?? 0) / scale : 0;
            const q = Math.max(qmin, Math.min(qmax, Math.round(raw)));
            codes[i] = q;
            recon[i] = q * scale;
        }
    }
    return { recon, codes, scales };
}

/** Demonstrate group quantization with and without activation-aware scaling. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AwqInput | null) ?? {};
    const weights: number[] = Array.isArray(task.weights) && task.weights.length > 0 ? task.weights.slice() : [0.6, 0.4, 0.9, 0.1];
    const activations: number[] = Array.isArray(task.activations) && task.activations.length === weights.length ? task.activations.slice() : [10, 1, 1, 1];
    const groupSize = Math.max(1, Math.min(typeof task.groupSize === "number" ? Math.trunc(task.groupSize) : 4, weights.length));
    const bits = Math.max(2, Math.min(typeof task.bits === "number" ? Math.trunc(task.bits) : 2, 8));
    const n = weights.length;

    const meanActivation = activations.reduce((a, b) => a + b, 0) / n;
    const factors = activations.map((a) => {
        const ratio = meanActivation > 0 ? a / meanActivation : 1;
        return Math.max(1, Math.min(2, Math.sqrt(Math.max(0, ratio))));
    });

    const vanilla = quantize(weights, groupSize, bits);
    const scaledWeights = weights.map((w, i) => w * (factors[i] ?? 1));
    const awqScaled = quantize(scaledWeights, groupSize, bits);
    const awqRecon = awqScaled.recon.map((value, i) => value / (factors[i] ?? 1));

    const errorOf = (recon: number[]) =>
        Number(weights.reduce((total, w, i) => total + Math.abs(w - (recon[i] ?? 0)) * (activations[i] ?? 0), 0).toFixed(6));
    const vanillaError = errorOf(vanilla.recon);
    const awqError = errorOf(awqRecon);

    const zeroRecon = new Array<number>(n).fill(0);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(weights, zeroRecon, zeroRecon, -1, groupSize),
        edges: [],
        description: `AWQ: ${n} weights, ${bits}-bit symmetric groups of ${groupSize}; activations flag salient channels.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, bits, groupSize, weights: weights.slice(), activations: activations.slice(), factors, vanillaError: 0, awqError: 0, improved: false },
    };
    step += 1;

    for (let start = 0; start < n; start += groupSize) {
        const group = start / groupSize;
        yield {
            stepNumber: step,
            entities: makeBars(weights, vanilla.recon, zeroRecon, group, groupSize),
            edges: [],
            description: `Plain group ${group}: scale ${(vanilla.scales[group] ?? 0).toFixed(4)}, codes ${vanilla.codes.slice(start, Math.min(start + groupSize, n)).join(", ")}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, bits, groupSize, weights: weights.slice(), activations: activations.slice(), factors, vanillaError: 0, awqError: 0, improved: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(weights, vanilla.recon, awqRecon, -1, groupSize),
        edges: [],
        description: `Activation-aware: salient channels use scale factor up to 2 before rounding, then divide it back out.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, bits, groupSize, weights: weights.slice(), activations: activations.slice(), factors, vanillaError, awqError, improved: awqError <= vanillaError },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(weights, vanilla.recon, awqRecon, -1, groupSize),
        edges: [],
        description: `Done: activation-weighted error ${vanillaError} plain versus ${awqError} with AWQ.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            n,
            bits,
            groupSize,
            weights: weights.slice(),
            activations: activations.slice(),
            factors,
            vanillaRecon: vanilla.recon,
            awqRecon,
            vanillaCodes: vanilla.codes,
            awqCodes: awqScaled.codes,
            vanillaError,
            awqError,
            improved: awqError <= vanillaError,
        },
    };
}

/** The AWQ quantization module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Not all weights hurt equally when quantized: a tiny error on a channel that sees large activations can corrupt the output far more than a bigger error on a quiet channel. AWQ looks at calibration activations, marks the salient channels, and multiplies their weights by a constant before rounding. After dequantization it divides that constant back out, so the stored model is unchanged but the rounding error lands where it does the least harm.",
        invariants: [
            "Each group uses one symmetric scale set by the largest absolute value in that group.",
            "Quantized codes are clamped to the signed integer range for the chosen bit width.",
            "The activation-aware factor is applied before quantization and inverted after dequantization.",
        ],
        correctness:
            "For a group with max absolute weight M and b bits, the step is M / (2^(b-1) - 1), so every reconstructed value q times the step lies within half a step of the original before clamping. With an activation factor s, the scaled group uses step s times larger precision for that channel and dividing the reconstruction by s restores the original magnitude, so the reconstruction is exact up to the smaller scaled rounding error. Computing the activation-weighted absolute error directly from the reported reconstructions reproduces both totals.",
        complexityRationale:
            "Quantization scans each weight a constant number of times to find group maxima, round codes, and reconstruct, giving O(n) time. Storing scales, codes, factors, and reconstructed weights is also O(n).",
        uses: [
            "Compressing large language models to 4-bit or lower for edge deployment",
            "Reducing memory bandwidth during inference",
            "Teaching how calibration data can guide lossy compression",
        ],
        references: [
            "Lin et al., AWQ: Activation-aware Weight Quantization for LLM Compression, 2024",
            "Frantar et al., GPTQ: Accurate Post-Training Quantization, 2022",
        ],
        workedExample:
            "With weights 0.6, 0.4, 0.9, 0.1, activations 10, 1, 1, 1 and 2-bit groups, the plain step is 0.9 and the salient first weight rounds to 0.9, a large relative error. AWQ scales that channel by about 1.75 before rounding so it reconstructs back to 0.6, dropping the activation-weighted error sharply while barely affecting the other channels.",
    },
    id: "awq-quantization",
    name: "AWQ Quantization (Activation-Aware Core)",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { weights: [0.6, 0.4, 0.9, 0.1], activations: [10, 1, 1, 1], groupSize: 4, bits: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "read weights, calibration activations, group size, and bit width",
        "compute each channel's activation scale factor and clamp it",
        "for every group find the maximum absolute scaled weight",
        "set the step to that maximum over the signed integer range",
        "round each weight over the step, clamp, and multiply back",
        "divide activation-scaled reconstructions by their factors",
        "compare activation-weighted error with and without AWQ",
        "done: report codes and reconstructed weights",
    ],
};

export default module;
