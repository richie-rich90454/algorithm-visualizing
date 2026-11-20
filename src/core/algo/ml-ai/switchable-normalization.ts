/**
 * switchable-normalization.ts - Switchable Normalization
 *
 * Switchable normalization lets the network learn how much batch, instance,
 * and layer normalization to use for each channel. The three normalized
 * versions are computed from the same activation tensor and combined with
 * channel-wise weights that are normalized to sum to one.
 *
 * Time is O(B * C * S) and space is O(B * C * S) for the tensor.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A rank-three tensor indexed as tensor[batch][channel][spatial]. */
export type Tensor3 = number[][][];

/** Normalize each channel across batch and spatial positions. */
export function batchNormalize(tensor: Tensor3, eps = 1e-5): Tensor3 {
    const batches = tensor.length;
    const channels = tensor[0]?.length ?? 0;
    const spatial = tensor[0]?.[0]?.length ?? 0;
    return tensor.map((_batch, b) =>
        Array.from({ length: channels }, (_, c) => {
            let sum = 0;
            for (let bi = 0; bi < batches; bi += 1) {
                for (let s = 0; s < spatial; s += 1) {
                    sum += tensor[bi]![c]![s] ?? 0;
                }
            }
            const count = Math.max(1, batches * spatial);
            const mean = sum / count;
            let variance = 0;
            for (let bi = 0; bi < batches; bi += 1) {
                for (let s = 0; s < spatial; s += 1) {
                    variance += ((tensor[bi]![c]![s] ?? 0) - mean) ** 2;
                }
            }
            variance /= count;
            const scale = Math.sqrt(variance + eps);
            return Array.from({ length: spatial }, (_, s) => ((tensor[b]![c]![s] ?? 0) - mean) / scale);
        }),
    );
}

/** Normalize each batch-channel slice across spatial positions. */
export function instanceNormalize(tensor: Tensor3, eps = 1e-5): Tensor3 {
    return tensor.map((batch) =>
        batch.map((channel) => {
            const count = Math.max(1, channel.length);
            const mean = channel.reduce((s, x) => s + x, 0) / count;
            const variance =
                channel.reduce((s, x) => s + (x - mean) ** 2, 0) / count;
            const scale = Math.sqrt(variance + eps);
            return channel.map((x) => (x - mean) / scale);
        }),
    );
}

/** Normalize each batch sample across all channels and spatial positions. */
export function layerNormalize(tensor: Tensor3, eps = 1e-5): Tensor3 {
    return tensor.map((batch) => {
        const values = batch.flat();
        const count = Math.max(1, values.length);
        const mean = values.reduce((s, x) => s + x, 0) / count;
        const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / count;
        const scale = Math.sqrt(variance + eps);
        return batch.map((channel) => channel.map((x) => (x - mean) / scale));
    });
}

/** Normalize three non-negative weights so they sum to one. */
export function normalizeWeights(weights: number[]): number[] {
    const sum = weights.reduce((s, w) => s + Math.max(0, w), 0);
    if (sum <= 0) {
        return [1 / 3, 1 / 3, 1 / 3];
    }
    return weights.map((w) => Math.max(0, w) / sum);
}

/** Combine batch, instance, and layer normalization with per-channel weights. */
export function switchableNormalize(
    tensor: Tensor3,
    weightsPerChannel: number[][],
    eps = 1e-5,
): Tensor3 {
    const bn = batchNormalize(tensor, eps);
    const inn = instanceNormalize(tensor, eps);
    const ln = layerNormalize(tensor, eps);
    const channels = tensor[0]?.length ?? 0;
    return tensor.map((batch, b) =>
        Array.from({ length: channels }, (_, c) => {
            const [wb, wi, wl] = normalizeWeights(weightsPerChannel[c] ?? [1, 1, 1]);
            return Array.from({ length: batch[c]?.length ?? 0 }, (_, s) => {
                return (
                    wb! * (bn[b]![c]![s] ?? 0) +
                    wi! * (inn[b]![c]![s] ?? 0) +
                    wl! * (ln[b]![c]![s] ?? 0)
                );
            });
        }),
    );
}

function makeCells(tensor: Tensor3, revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const channels = tensor[0]?.length ?? 0;
    for (let b = 0; b < tensor.length; b += 1) {
        for (let c = 0; c < channels; c += 1) {
            for (let s = 0; s < (tensor[b]![c]?.length ?? 0); s += 1) {
                const index = b * channels * (tensor[b]![c]!.length) + c * (tensor[b]![c]!.length) + s;
                entities.push({
                    id: `cell-${b}-${c}-${s}`,
                    type: "cell",
                    label: index <= revealed ? `b${b}c${c}s${s}: ${(tensor[b]![c]![s] ?? 0).toFixed(3)}` : "?",
                    value: index <= revealed ? (tensor[b]![c]![s] ?? 0) : 0,
                    state: (index === revealed ? "comparing" : index < revealed ? "sorted" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: b * channels + c, col: s },
                });
            }
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { tensor?: Tensor3; weightsPerChannel?: number[][]; eps?: number } | null
    ) ?? {};
    const tensor: Tensor3 = task.tensor ?? [
        [
            [1, 2, 3],
            [4, 5, 6],
        ],
        [
            [2, 1, 4],
            [3, 6, 5],
        ],
    ];
    const weightsPerChannel: number[][] = task.weightsPerChannel ?? [
        [1, 1, 1],
        [2, 1, 0],
    ];
    const eps = typeof task.eps === "number" ? task.eps : 1e-5;
    const output = switchableNormalize(tensor, weightsPerChannel, eps);
    const total = tensor.reduce(
        (n, batch) => n + batch.reduce((m, ch) => m + ch.length, 0),
        0,
    );
    const metaBase = { rows: (tensor[0]?.length ?? 0) * tensor.length, cols: tensor[0]?.[0]?.length ?? 0 };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(output, -1),
        edges: [],
        description: `Switchable normalization over ${tensor.length} samples, ${tensor[0]?.length ?? 0} channels, blending batch, instance, and layer statistics.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { ...metaBase, weights: JSON.stringify(weightsPerChannel) },
    };
    step += 1;

    for (let i = 0; i < total; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(output, i),
            edges: [],
            description: `Activating output ${i + 1} of ${total}: the channel weights choose its blend of the three normalizers.`,
            codeLineNumber: i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 3,
            layout: "matrix",
            meta: { ...metaBase, current: i, weights: JSON.stringify(weightsPerChannel) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(output, total - 1),
        edges: [],
        description: `Done: every channel uses its learned mix; with weights (1,1,1) the output is the average of the three normalizers.`,
        codeLineNumber: 5,
        layout: "matrix",
        meta: { ...metaBase, converged: true, output: JSON.stringify(output) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Batch normalization, instance normalization, and layer normalization each choose a different set of values to average over, and each works best in a different setting. Switchable normalization stops guessing: it computes all three and lets learnable per-channel weights decide how much of each to use. The weights are normalized so the result is a genuine blend rather than a sum that could drift in scale.",
        invariants: [
            "Each individual normalizer produces values with zero mean and unit variance over the axes it normalizes.",
            "The three channel weights are non-negative and normalized to sum to one.",
            "The combined output is a convex combination of the three normalized tensors.",
        ],
        correctness:
            "Batch, instance, and layer normalization each subtract the mean and divide by the standard deviation over their stated axes, so their outputs have zero mean and unit variance, which the tests verify directly. The combination uses normalized weights and adds the three contributions, so it equals the weighted average computed by an independent implementation. Boundary weights such as (1, 0, 0) reduce the output exactly to batch normalization.",
        complexityRationale:
            "Each normalizer scans the tensor once, O(B * C * S), and the blend is another pass of the same size, so total time is O(B * C * S). The three normalized tensors and the output occupy O(B * C * S) space.",
        uses: [
            "Generative adversarial networks with varied normalization needs",
            "Domain adaptation across different data distributions",
            "Neural architecture search over normalization choices",
        ],
        references: [
            "Luo et al., Switchable Normalization, ICLR 2019",
            "Ioffe and Szegedy, Batch Normalization, ICML 2015",
        ],
        workedExample:
            "For a channel with weights (2, 1, 1), the normalized weights are (0.5, 0.25, 0.25). An activation whose batch-normalized, instance-normalized, and layer-normalized values are 1.0, 0.4, and -0.2 receives output 0.5 * 1.0 + 0.25 * 0.4 + 0.25 * (-0.2) = 0.55.",
    },
    id: "switchable-normalization",
    name: "Switchable Normalization",
    category: "ml-ai",
    complexity: { time: "O(B * C * S)", space: "O(B * C * S)" },
    defaultInput: {
        tensor: [
            [
                [1, 2, 3],
                [4, 5, 6],
            ],
            [
                [2, 1, 4],
                [3, 6, 5],
            ],
        ],
        weightsPerChannel: [
            [1, 1, 1],
            [2, 1, 0],
        ],
        eps: 1e-5,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "compute batch, instance, and layer normalized copies of the tensor",
        "for each channel take its three learnable weights",
        "normalize those weights so they sum to one",
        "multiply each normalized copy by its channel weight",
        "add the three weighted copies into the output",
        "done: report the blended normalized tensor",
    ],
};

export default module;
