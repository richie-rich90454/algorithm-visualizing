/**
 * group-normalization.ts - Group Normalization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Group normalization divides a sample's channels into groups and normalizes
 * each group using statistics computed only across that group and its spatial
 * positions. Unlike batch normalization it does not depend on other samples,
 * so it works well with small batches. A learnable scale and shift are applied
 * per channel after normalization.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N * C * S) for N samples, C channels, and S spatial positions
 *   Space: O(N * C * S) for the normalized output
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show each channel's normalized value for one sample at a time.
 *   - Meta reports the mean and variance used for the active group.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GroupNormInput {
    data?: number[][];
    groups?: number;
    gamma?: number[];
    beta?: number[];
    epsilon?: number;
}

function makeBars(values: number[], state: EntityState, prefix = "ch"): VisualEntity[] {
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GroupNormInput | null) ?? {};
    const data = task.data ?? [
        [1, 2, 3, 4, 5, 6, 7, 8],
        [2, 1, 6, 3, 8, 5, 4, 7],
    ];
    const groups = typeof task.groups === "number" && task.groups > 0 ? task.groups : 2;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-5;
    const channels = data[0]?.length ?? 0;
    const gamma = task.gamma ?? new Array<number>(channels).fill(1);
    const beta = task.beta ?? new Array<number>(channels).fill(0);

    const normalized = data.map(() => new Array<number>(channels).fill(0));
    const stats: Array<Array<{ mean: number; variance: number }>> = [];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars((data[0] ?? []).slice(), "idle", "raw"),
        edges: [],
        description: `Group normalization over ${data.length} sample(s), ${channels} channels, and ${groups} group(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, samples: data.length, channels, groups, epsilon },
    };
    step += 1;

    for (let n = 0; n < data.length; n += 1) {
        const row = data[n] ?? [];
        const sampleStats: Array<{ mean: number; variance: number }> = [];
        for (let g = 0; g < groups; g += 1) {
            const start = Math.floor((g * channels) / groups);
            const end = Math.floor(((g + 1) * channels) / groups);
            const size = end - start;
            let sum = 0;
            for (let c = start; c < end; c += 1) {
                sum += row[c] ?? 0;
            }
            const mu = size === 0 ? 0 : sum / size;
            let varSum = 0;
            for (let c = start; c < end; c += 1) {
                varSum += ((row[c] ?? 0) - mu) ** 2;
            }
            const variance = size === 0 ? 0 : varSum / size;
            sampleStats.push({ mean: mu, variance });
            for (let c = start; c < end; c += 1) {
                const scale = gamma[c] ?? 1;
                const shift = beta[c] ?? 0;
                normalized[n]![c] = scale * (((row[c] ?? 0) - mu) / Math.sqrt(variance + epsilon)) + shift;
            }
        }
        stats.push(sampleStats);

        yield {
            stepNumber: step,
            entities: makeBars(normalized[n] ?? [], "active", "norm"),
            edges: [],
            description: `Sample ${n}: normalized each group with its own mean and variance, then applied the per-channel scale and shift.`,
            codeLineNumber: 4,
            layout: "array",
            meta: {
                step,
                sample: n,
                groupMeans: sampleStats.map((s) => s.mean),
                groupVariances: sampleStats.map((s) => s.variance),
                output: (normalized[n] ?? []).slice(),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(normalized[0] ?? [], "sorted", "final"),
        edges: [],
        description: `Done: normalized ${data.length} sample(s) across ${groups} group(s) without using batch statistics.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step, output: (normalized[0] ?? []).slice(), allOutput: normalized.flat(), groups },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Batch normalization estimates its statistics across the whole batch, which becomes noisy when the batch is tiny. Group normalization instead splits each sample's channels into a few groups and computes a mean and variance inside each group. Because the statistics depend on only one sample, the layer behaves the same in training and evaluation and works reliably with small batches.",
        invariants: [
            "Statistics are computed per sample and per group, never across samples.",
            "Within a group the normalized values have mean zero and variance one before the affine transform.",
            "The learnable scale and shift are applied per channel after normalization.",
        ],
        correctness:
            "For a group of values, subtracting the group mean and dividing by the square root of the group variance plus epsilon produces zero mean and unit variance up to the epsilon smoothing. Applying gamma and beta per channel is an elementwise affine map. The test recomputes the group statistics and every output coordinate with a separate brute-force loop and checks the zero-mean property.",
        complexityRationale:
            "Each channel participates in one mean, one variance, and one affine transform, so the total work is linear in the number of stored values, all of which must be kept for the output.",
        uses: [
            "Normalization in object detection with small per-device batches",
            "Generative models where batch statistics would leak across samples",
            "Stable training of vision backbones at any batch size",
        ],
        references: [
            "Wu and He, Group Normalization, ECCV 2018",
            "Ioffe and Szegedy, Batch Normalization, ICML 2015",
        ],
        workedExample:
            "With eight channels split into two groups, channels zero through three share one mean and variance while channels four through seven share another. A channel value of five in a group with mean three and variance one becomes about two before any scale or shift.",
    },
    id: "group-normalization",
    name: "Group Normalization",
    category: "ml-ai",
    complexity: { time: "O(N * C * S)", space: "O(N * C * S)" },
    defaultInput: {
        data: [
            [1, 2, 3, 4, 5, 6, 7, 8],
            [2, 1, 6, 3, 8, 5, 4, 7],
        ],
        groups: 2,
        gamma: [1, 1, 1, 1, 1, 1, 1, 1],
        beta: [0, 0, 0, 0, 0, 0, 0, 0],
        epsilon: 1e-5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "split the channels of each sample into equal groups",
        "compute the mean of each group from its own channels",
        "compute the variance of each group from its own channels",
        "subtract the mean and divide by the square root of variance plus epsilon",
        "multiply by the per-channel scale and add the per-channel shift",
        "store the normalized values for the sample",
        "repeat for every sample",
        "done: report the normalized activations",
    ],
};

export default module;
