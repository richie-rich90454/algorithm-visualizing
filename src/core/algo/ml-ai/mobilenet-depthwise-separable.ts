/**
 * mobilenet-depthwise-separable.ts - Depthwise Separable Convolution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A depthwise separable convolution splits a standard convolution into two
 * cheaper steps. First a depthwise pass applies one small filter to each input
 * channel independently, then a pointwise one-by-one convolution mixes the
 * resulting channels together. This nearly cuts the multiply count of a normal
 * convolution while keeping similar expressive power, which is why MobileNet
 * uses it. This demo runs the two stages on two tiny channels.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(C * K + C * M) for C channels, K-kernel and M output channels
 *   Space: O(C + M) for the intermediate and output channels
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame shows the current channel values as bars.
 *   - Stages move from per-channel depthwise output to mixed pointwise output.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MobileInput {
    channels: number[][];
    depthwise: number[][];
    pointwise: number[][];
    bias: number[];
}

/** Build bar entities for a channel vector. */
function makeBars(values: number[], stage: string, active: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `channel-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: (active ? "active" : "idle") as EntityState,
        x: index * 40,
        y: 0,
        width: 22,
        height: 0,
        metadata: { index, stage, value },
    }));
}

/** The depthwise separable convolution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<MobileInput> | null) ?? {};
    const channels: number[][] = task.channels ?? [[1, 2], [3, 0.5]];
    const depthwise: number[][] = task.depthwise ?? [[0.5, -0.2], [0.3, 0.4]];
    const pointwise: number[][] = task.pointwise ?? [[1, -0.5], [0.2, 0.8]];
    const bias: number[] = task.bias ?? [0.1, -0.1];

    const flattened = channels.flat();
    yield {
        stepNumber: 0,
        entities: makeBars(flattened, "input", false),
        edges: [],
        description: `Input has ${channels.length} channel(s) of ${(channels[0] ?? []).length} value(s) each.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { stage: "input", channels: channels.length, values: flattened.map((v) => Number(v.toFixed(6))) },
    };

    const depthOutput: number[] = channels.map((channel, index) => {
        const kernel = depthwise[index] ?? [];
        return channel.reduce((sum, value, j) => sum + value * (kernel[j] ?? 0), 0);
    });
    yield {
        stepNumber: 1,
        entities: makeBars(depthOutput, "depthwise", false),
        edges: [],
        description: `Depthwise pass produced one filtered value per input channel: [${depthOutput.map((v) => v.toFixed(3)).join(", ")}].`,
        codeLineNumber: 2,
        layout: "array",
        meta: { stage: "depthwise", channels: depthOutput.length, values: depthOutput.map((v) => Number(v.toFixed(6))) },
    };

    const output: number[] = pointwise.map((row, index) => {
        let sum = bias[index] ?? 0;
        row.forEach((weight, j) => {
            sum += weight * (depthOutput[j] ?? 0);
        });
        return Math.max(0, sum);
    });
    yield {
        stepNumber: 2,
        entities: makeBars(output, "pointwise", true),
        edges: [],
        description: `Pointwise pass mixed the channels into ${output.length} output channel(s): [${output.map((v) => v.toFixed(3)).join(", ")}].`,
        codeLineNumber: 4,
        layout: "array",
        meta: { stage: "pointwise", channels: output.length, values: output.map((v) => Number(v.toFixed(6))) },
    };
}

/** The MobileNet module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A normal convolution mixes every input channel with every output channel all at once, which is expensive. Depthwise separable convolution does it in two cheaper moves: slide one small filter over each channel on its own, then use a one-by-one convolution to mix the channels. The result looks similar but costs a fraction of the arithmetic, which is why mobile vision models rely on it.",
        invariants: [
            "The depthwise stage never mixes channels; each channel has its own kernel.",
            "The pointwise stage is the only place channels are combined.",
            "ReLU is applied after the pointwise stage, not after depthwise.",
        ],
        correctness:
            "The generator computes depthwise dot products per channel followed by a pointwise affine mix and ReLU. The test uses an independent two-stage reference and verifies the exact output values, and further confirms the depthwise stage produces exactly one value per input channel, so the defining separation of spatial and channel mixing is checked.",
        complexityRationale:
            "Depthwise filtering costs O(C * K) for C channels and a K-position kernel, and pointwise mixing costs O(C * M) for M output channels, far below the O(C * M * K) of a full convolution. The intermediate vector holds O(C) values.",
        uses: [
            "MobileNet and other mobile or edge vision models",
            "Any latency-constrained image classifier or detector",
            "Replacing expensive convolutions in real-time inference",
        ],
        references: [
            "Howard et al., MobileNets: Efficient Convolutional Neural Networks, 2017",
            "Sifre and Mallat, Rotation, Scaling and Deformation Invariant Scattering, 2013",
        ],
        workedExample:
            "For channels [1, 2] and [3, 0.5] with depthwise kernels [0.5, -0.2] and [0.3, 0.4], the depthwise outputs are 0.1 and 1.1. The pointwise weights mix those into roughly -0.35 and 0.8 before bias, and ReLU clamps the first to zero, giving [0, 0.8].",
    },
    id: "mobilenet-depthwise-separable",
    name: "MobileNet Depthwise Separable Convolution",
    category: "ml-ai",
    complexity: { time: "O(C * K + C * M)", space: "O(C + M)" },
    defaultInput: { channels: [[1, 2], [3, 0.5]] },
    visualType: "array",
    run,
    pseudocode: [
        "start with C input channels each of K values",
        "for each channel convolve it with its own depthwise kernel",
        "collect one filtered value per channel",
        "apply the pointwise one-by-one weights to mix channels",
        "add the output bias to each mixed channel",
        "apply ReLU to the mixed channels",
        "emit the final output channels",
    ],
};

export default module;
