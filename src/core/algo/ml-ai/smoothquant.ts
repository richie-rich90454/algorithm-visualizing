/**
 * smoothquant.ts - SmoothQuant Activation-Weight Scaling (teachable core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SmoothQuant makes post-training int8 quantization easier by moving the
 * large outliers of an activation vector into the weight matrix. For each
 * channel it computes a migration strength from the activation magnitude over
 * the weight magnitude, multiplies the weight channel by that factor, and
 * divides the activation channel by it. The product is nearly
 * unchanged, but both operands now have a smoother range that quantizes well.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * d) for an m by d weight matrix and d activation channels
 *   Space: O(m * d) for the smoothed and quantized weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the activation channels, the per-channel migration scales,
 *     and the quantized activation after smoothing.
 *   - Metadata carries the integer codes and the output error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SmoothQuantInput {
    weights?: number[][];
    x?: number[];
    alpha?: number;
}

/** Per-channel migration strength s_j = max|X_j|^alpha / max|W_j|^(1-alpha). */
export function smoothQuantScales(weights: number[][], x: number[], alpha: number): number[] {
    const d = x.length;
    return Array.from({ length: d }, (_, j) => {
        let wmax = 0;
        for (const row of weights) {
            wmax = Math.max(wmax, Math.abs(row[j] ?? 0));
        }
        const xmax = Math.abs(x[j] ?? 0);
        const numerator = Math.pow(xmax, alpha);
        const denominator = Math.pow(wmax, 1 - alpha);
        return denominator === 0 ? 1 : Math.max(1e-6, numerator / denominator);
    });
}

/** Symmetric int8 quantization with a single scale factor. */
export function quantizeSymmetric(values: number[]) {
    const max = values.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    const scale = max === 0 ? 1 : max / 127;
    const q = values.map((value) => Math.max(-127, Math.min(127, Math.round(value / scale))));
    const dequantized = q.map((code) => code * scale);
    return { q, scale, dequantized };
}

/** Smooth the weight and activation, quantize both, and compare products. */
export function smoothQuant(weights: number[][], x: number[], alpha: number) {
    const scales = smoothQuantScales(weights, x, alpha);
    const smoothedWeights = weights.map((row) => row.map((value, j) => value * (scales[j] ?? 1)));
    const smoothedX = x.map((value, j) => value / (scales[j] ?? 1));
    const wq = quantizeSymmetric(smoothedWeights.flat());
    const xq = quantizeSymmetric(smoothedX);
    const deqWeights: number[][] = [];
    for (let i = 0; i < weights.length; i += 1) {
        deqWeights.push(wq.dequantized.slice(i * x.length, (i + 1) * x.length));
    }
    const exact = weights.map((row) => row.reduce((sum, value, j) => sum + value * (x[j] ?? 0), 0));
    const approx = deqWeights.map((row) => row.reduce((sum, value, j) => sum + value * (xq.dequantized[j] ?? 0), 0));
    const maxError = exact.reduce((m, value, i) => Math.max(m, Math.abs(value - (approx[i] ?? 0))), 0);
    return { scales, smoothedWeights, smoothedX, wq, xq, exact, approx, maxError };
}

function bars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `chan-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SmoothQuantInput | null) ?? {};
    const weights: number[][] = task.weights ?? [
        [0.9, 0.1, 0.4],
        [-0.2, 1.5, 0.3],
    ];
    const x: number[] = Array.isArray(task.x) && task.x.length > 0 ? task.x.slice() : [3, 0.2, 1.5];
    const alpha = typeof task.alpha === "number" && task.alpha >= 0 ? task.alpha : 0.5;
    const r = smoothQuant(weights, x, alpha);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(x, "idle"),
        edges: [],
        description: `Smooth quantization difficulty across ${x.length} activation channels with alpha ${alpha}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x, alpha, scales: r.scales, phase: "input" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.scales, "comparing"),
        edges: [],
        description: "Per-channel scale moves activation magnitude into the weight matrix.",
        codeLineNumber: 1,
        layout: "array",
        meta: { x, alpha, scales: r.scales, phase: "scales" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.xq.q, "active"),
        edges: [],
        description: `Quantize the smoothed activation to int8 codes ${r.xq.q.join(", ")}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { x, alpha, scales: r.scales, qx: r.xq.q, qw: r.wq.q, phase: "quantize" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.approx, "sorted"),
        edges: [],
        description: `Dequantized product differs from the exact result by at most ${r.maxError.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            x,
            alpha,
            scales: r.scales,
            qx: r.xq.q,
            qw: r.wq.q,
            exact: r.exact,
            approx: r.approx,
            maxError: Number(r.maxError.toFixed(8)),
            phase: "done",
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Int8 quantization fails when a few activation channels have huge outliers. SmoothQuant notices that the same output can be written with a larger activation and a smaller weight, or the reverse, by rescaling a channel. It deliberately shifts the activation outlier into the weight, where per-channel quantization handles it better. The mathematical product stays the same while both operands become easier to round.",
        invariants: [
            "Each migration scale depends only on that channel's activation and weight magnitudes.",
            "Multiplying a weight channel by s and dividing the activation by s leaves their product unchanged.",
            "All integer codes stay within the signed int8 range of minus 127 to 127.",
        ],
        correctness:
            "For channel j the product sum over j of W_ij times x_j is unchanged when W_ij is replaced by W_ij times s_j and x_j by x_j divided by s_j, because the factors cancel exactly in each term. Quantization then rounds both smoothed operands to int8 codes with a shared scale, so the dequantized product approximates the original; the reported error is the direct maximum absolute difference and is therefore exact for the given codes.",
        complexityRationale:
            "Finding each channel's weight maximum and applying the scales scans the m by d matrix a constant number of times, O(m*d). Quantization is linear in the number of entries, and storage remains O(m*d) for the smoothed and quantized weights.",
        uses: [
            "Post-training int8 quantization of transformer layers",
            "Accelerating inference with integer arithmetic",
            "Handling activation outliers in large language models",
        ],
        references: [
            "Xiao et al., SmoothQuant: Accurate and Efficient Post-Training Quantization, ICML 2023",
            "Jacob et al., Quantization and Training of Neural Networks for Efficient Integer Inference, 2018",
        ],
        workedExample:
            "If an activation channel is 3 and the largest weight in that channel is 0.5, then with alpha 0.5 the migration scale is the square root of 3 over 0.5, about 2.45. Multiplying the weight channel by 2.45 and dividing the activation by 2.45 leaves the product unchanged, but the activation outlier is now the weight's concern.",
    },
    id: "smoothquant",
    name: "SmoothQuant Scaling",
    category: "ml-ai",
    complexity: { time: "O(m * d)", space: "O(m * d)" },
    defaultInput: {
        weights: [
            [0.9, 0.1, 0.4],
            [-0.2, 1.5, 0.3],
        ],
        x: [3, 0.2, 1.5],
        alpha: 0.5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "for each channel find the largest absolute weight entry",
        "set the migration scale from activation magnitude over weight magnitude",
        "multiply the weight channel by its migration scale",
        "divide the activation channel by its migration scale",
        "quantize both smoothed operands to signed int8 codes",
        "dequantize and multiply to check the approximation",
        "done: report codes and maximum product error",
    ],
};

export default module;
