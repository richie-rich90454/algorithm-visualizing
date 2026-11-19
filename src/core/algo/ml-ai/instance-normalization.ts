/**
 * instance-normalization.ts - Instance (Per-Sample) Normalization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Instance normalization standardizes every sample independently across its
 * channels, unlike batch normalization which pools across the batch. Each
 * sample's channel vector is centered and scaled to unit variance, then an
 * optional affine scale and shift is applied. It is the standard choice for
 * style transfer and generative models where the global batch statistics
 * would erase per-image appearance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(s * c) for s samples with c channels each
 *   Space: O(s * c) for the standardized output
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells form a sample-by-channel grid showing the active values.
 *   - The sample currently being standardized is highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    data?: number[][];
    gamma?: number;
    beta?: number;
    eps?: number;
}

function makeCells(data: number[][], shown: number[][], states: Map<number, EntityState>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < data.length; r += 1) {
        const original = data[r] ?? [];
        for (let c = 0; c < original.length; c += 1) {
            const value = shown[r]?.[c] ?? original[c] ?? 0;
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state: states.get(r) ?? "idle",
                x: c,
                y: r,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, value },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const data = (task.data ?? [
        [1, 2, 3, 4],
        [4, 5, 6, 7],
        [2, 4, 6, 8],
    ]).map((row) => row.slice());
    const gamma = typeof task.gamma === "number" ? task.gamma : 1;
    const beta = typeof task.beta === "number" ? task.beta : 0;
    const eps = typeof task.eps === "number" ? task.eps : 1e-5;
    const samples = data.length;
    const channels = samples > 0 ? (data[0]?.length ?? 0) : 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(data, data, new Map()),
        edges: [],
        description: `Standardize ${samples} samples across ${channels} channels independently.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: samples, cols: channels, sampleCount: samples, channelCount: channels, gamma, beta },
    };
    step += 1;

    const shown = data.map((row) => row.slice());
    const flatOutput: number[] = [];
    for (let r = 0; r < samples; r += 1) {
        const row = data[r] ?? [];
        const n = row.length;
        const mean = n > 0 ? row.reduce((a, v) => a + v, 0) / n : 0;
        const variance = n > 0 ? row.reduce((a, v) => a + (v - mean) ** 2, 0) / n : 0;
        const std = Math.sqrt(variance + eps);
        const output = row.map((v) => gamma * ((v - mean) / std) + beta);
        const displayRow = shown[r];
        for (let c = 0; c < n; c += 1) {
            if (displayRow) {
                displayRow[c] = output[c] ?? 0;
            }
            flatOutput.push(Number((output[c] ?? 0).toFixed(6)));
        }
        const states = new Map<number, EntityState>();
        for (let k = 0; k < r; k += 1) {
            states.set(k, "sorted");
        }
        states.set(r, "active");
        yield {
            stepNumber: step,
            entities: makeCells(data, shown, states),
            edges: [],
            description: `Sample ${r}: mean ${mean.toFixed(3)}, variance ${variance.toFixed(3)}; standardized across its channels.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows: samples, cols: channels, sample: r, mean, variance, output: output.map((v) => Number(v.toFixed(6))) },
        };
        step += 1;
    }

    const done = new Map<number, EntityState>();
    for (let r = 0; r < samples; r += 1) {
        done.set(r, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeCells(data, shown, done),
        edges: [],
        description: `Done: ${samples} samples standardized; each has zero mean and unit variance before the affine scale and shift.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: samples, cols: channels, output: flatOutput, samples, channels, gamma, beta },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Normalize each sample on its own instead of borrowing statistics from other samples. For every sample, compute the mean and variance over its channels, subtract the mean, divide by the standard deviation, and optionally scale and shift. Image-generation models use this so one image cannot change another image's colors.",
        invariants: [
            "Mean and variance are computed only over a single sample's channels.",
            "Before the affine term, each standardized sample has mean zero and variance one.",
            "The affine parameters gamma and beta are shared across all samples.",
        ],
        correctness:
            "For a sample vector x with mean m and variance v, the standardized value (x - m) / sqrt(v + eps) has mean zero and variance v / (v + eps), which approaches one as eps tends to zero. Applying gamma and shift beta then yields the exact output the layer is defined to produce, and no statistic crosses sample boundaries.",
        complexityRationale:
            "Each of the s samples scans its c channels a constant number of times for the mean, variance, and output, giving O(s * c) time; storing the standardized result uses O(s * c) space.",
        uses: [
            "Style transfer and neural style synthesis",
            "Generative adversarial networks for image synthesis",
            "Domain adaptation where per-instance appearance must be preserved",
        ],
        references: [
            "Ulyanov, Vedaldi & Lempitsky, Instance Normalization, 2016",
            "Goodfellow et al., Generative Adversarial Networks, 2014",
        ],
        workedExample:
            "For the single sample [1, 3, 5, 7] the mean is 4 and the variance is 5. Standardizing gives approximately [-1.34, -0.45, 0.45, 1.34], whose mean is zero and variance one. With gamma 1 and beta 0 those values are the final output, and a second sample is processed without ever mixing in these statistics.",
    },
    id: "instance-normalization",
    name: "Instance Normalization",
    category: "ml-ai",
    complexity: { time: "O(s * c)", space: "O(s * c)" },
    defaultInput: {
        data: [
            [1, 2, 3, 4],
            [4, 5, 6, 7],
            [2, 4, 6, 8],
        ],
        gamma: 1,
        beta: 0,
        eps: 1e-5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each sample in the batch",
        "compute the sample mean across its channels",
        "compute the sample variance across its channels",
        "divide each centered channel by the standard deviation",
        "scale by gamma and shift by beta",
        "store the normalized output for this sample",
        "done: return all normalized samples",
    ],
};

export default module;
