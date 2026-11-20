/**
 * u-net.ts - U-Net Encoder-Decoder Shape and Parameter Planning
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * U-Net is a symmetric encoder-decoder for dense prediction. The encoder
 * repeatedly convolves and downsamples while doubling channels; the decoder
 * upsamples, concatenates the matching encoder feature map through a skip
 * connection, and convolves again. The skip connections let fine spatial detail
 * flow to the output, which is why U-Net dominates segmentation tasks. This
 * module computes the exact tensor shapes and convolution parameter counts of
 * that architecture.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L) for L encoder and L decoder levels
 *   Space: O(L) for the per-level shape and parameter records
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Each row of the grid is one network level with its spatial size and channels.
 *   - Encoder rows are blue, the bottleneck green, decoder rows orange.
 *   - Frame meta exposes every level record and total parameter count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface UNetInput {
    inputSize?: number;
    levels?: number;
    baseChannels?: number;
    outChannels?: number;
}

export interface LevelRecord {
    stage: "encoder" | "bottleneck" | "decoder";
    level: number;
    size: number;
    inChannels: number;
    outChannels: number;
    params: number;
}

/** Parameters of a 3 by 3 same-padded convolution followed by a bias. */
export function convParams(inChannels: number, outChannels: number): number {
    return inChannels * outChannels * 9 + outChannels;
}

/** Compute every U-Net level shape and its convolution parameter count. */
export function unetShapes(
    inputSize: number,
    levels: number,
    baseChannels: number,
    outChannels: number,
): { levels: LevelRecord[]; totalParams: number; outputSize: number } {
    const L = Math.max(1, Math.floor(levels));
    const records: LevelRecord[] = [];
    let size = Math.max(1, Math.floor(inputSize));
    let channels = Math.max(1, Math.floor(baseChannels));
    const encoderSizes: number[] = [];
    const encoderChannels: number[] = [];
    for (let level = 0; level < L - 1; level += 1) {
        const params = 2 * convParams(channels, channels);
        records.push({ stage: "encoder", level, size, inChannels: channels, outChannels: channels, params });
        encoderSizes.push(size);
        encoderChannels.push(channels);
        size = Math.max(1, Math.floor(size / 2));
        channels *= 2;
    }
    records.push({ stage: "bottleneck", level: L - 1, size, inChannels: channels, outChannels: channels, params: 2 * convParams(channels, channels) });
    for (let level = L - 2; level >= 0; level -= 1) {
        size = size * 2;
        const skipChannels = encoderChannels[level] ?? channels;
        const skipSize = encoderSizes[level] ?? size;
        size = Math.min(size, skipSize);
        const inChannels = channels + skipChannels;
        const outC = skipChannels;
        records.push({
            stage: "decoder",
            level,
            size,
            inChannels,
            outChannels: outC,
            params: 2 * convParams(inChannels, outC),
        });
        channels = outC;
    }
    const headParams = convParams(channels, Math.max(1, outChannels));
    const totalParams = records.reduce((sum, record) => sum + record.params, headParams);
    return { levels: records, totalParams, outputSize: size };
}

/** Plain records for frame meta. */
function metaLevels(records: LevelRecord[]): Array<Record<string, number | string>> {
    return records.map((record) => ({
        stage: record.stage,
        level: record.level,
        size: record.size,
        inChannels: record.inChannels,
        outChannels: record.outChannels,
        params: record.params,
    }));
}

function makeCells(records: LevelRecord[], active: number): VisualEntity[] {
    return records.map((record, col) => {
        const value = record.size;
        const state: EntityState = col === active ? "active" : record.stage === "bottleneck" ? "sorted" : record.stage === "encoder" ? "comparing" : "visited";
        return {
            id: `level-${col}`,
            type: "cell" as const,
            label: `${record.size}x${record.size}x${record.outChannels}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                row: record.stage === "encoder" ? 0 : record.stage === "bottleneck" ? 1 : 2,
                col,
                stage: record.stage,
                level: record.level,
                channels: record.outChannels,
            },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as UNetInput | null) ?? {};
    const inputSize = Math.max(2, Math.floor(task.inputSize ?? 16));
    const levels = Math.max(1, Math.min(5, Math.floor(task.levels ?? 3)));
    const baseChannels = Math.max(1, Math.floor(task.baseChannels ?? 16));
    const outChannels = Math.max(1, Math.floor(task.outChannels ?? 2));
    const result = unetShapes(inputSize, levels, baseChannels, outChannels);
    const cols = result.levels.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(result.levels, -1),
        edges: [],
        description: `U-Net with ${levels} levels: encoder, bottleneck, and decoder with skip connections.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols, inputSize, levels, baseChannels, outChannels, levelsData: metaLevels(result.levels), totalParams: result.totalParams },
    };
    step += 1;

    for (let i = 0; i < result.levels.length; i += 1) {
        const record = result.levels[i]!;
        yield {
            stepNumber: step,
            entities: makeCells(result.levels, i),
            edges: [],
            description: `${record.stage} level ${record.level}: ${record.size} by ${record.size} by ${record.outChannels}, ${record.params} convolution parameters.`,
            codeLineNumber: i === 0 ? 2 : 4,
            layout: "grid",
            meta: {
                rows: 3,
                cols,
                inputSize,
                levels,
                baseChannels,
                outChannels,
                levelsData: metaLevels(result.levels),
                totalParams: result.totalParams,
                active: i,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result.levels, -1),
        edges: [],
        description: `Output ${result.outputSize} by ${result.outputSize} by ${outChannels}; total ${result.totalParams} convolution parameters.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 3, cols, inputSize, levels, baseChannels, outChannels, levelsData: metaLevels(result.levels), totalParams: result.totalParams, outputSize: result.outputSize },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Segmentation needs a prediction for every input pixel, but ordinary classifiers discard spatial resolution. U-Net first compresses the image into a small, high-level representation, then expands it back while stitching in the earlier high-resolution feature maps. Those skip connections are the characteristic U shape and are what preserve precise boundaries.",
        invariants: [
            "Encoder channels double at each downsampling step while spatial size halves.",
            "A decoder level concatenates its upsampled feature map with the same-resolution encoder map.",
            "The output spatial size equals the input size when the input is divisible by the downsampling factor.",
        ],
        correctness:
            "Each encoder level applies two same-padded convolutions, whose parameter count is two times inChannels times outChannels times nine plus biases. Downsampling halves the side length and doubles channels. The decoder reverses these steps, and its input width is the sum of the upsampled and skip channel counts, so the computed concatenation dimensions match by construction. Cropping to the skip size keeps the final output aligned with the input.",
        complexityRationale:
            "Only a constant amount of arithmetic is done per level, so planning takes O(L) time and O(L) space. The parameter total is accumulated directly from the closed-form convolution formula.",
        uses: [
            "Biomedical image segmentation",
            "Semantic segmentation in autonomous driving",
            "Image-to-image translation and super-resolution",
        ],
        references: [
            "Ronneberger, Fischer, Brox, U-Net: Convolutional Networks for Biomedical Image Segmentation, MICCAI 2015",
            "Cicek et al., 3D U-Net, MICCAI 2016",
        ],
        workedExample:
            "With a 16 by 16 input, two levels and 16 base channels, the encoder records 16x16x16 then downsamples to 8x8x32 for the bottleneck. The decoder upsamples to 16 by 16, concatenates 32 plus 16 channels, and a final convolution produces the requested output channels at the original resolution.",
    },
    id: "u-net",
    name: "U-Net Encoder-Decoder",
    category: "ml-ai",
    complexity: { time: "O(L)", space: "O(L)" },
    defaultInput: { inputSize: 16, levels: 3, baseChannels: 16, outChannels: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "set the current spatial size and channel count from the input",
        "for each encoder level record two same-padded convolutions",
        "halve the spatial size and double channels after each encoder level",
        "record the bottleneck convolutions at the deepest level",
        "for each decoder level upsample and restore the previous size",
        "concatenate the skip feature map and record two convolutions",
        "apply the final output convolution to get class channels",
        "done: return the level shapes and total parameter count",
    ],
};

export default module;
