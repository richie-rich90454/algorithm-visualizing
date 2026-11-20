/**
 * mask-rcnn.ts - Mask R-CNN RoIAlign and Mask Prediction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Mask R-CNN extends Faster R-CNN with a pixel-level mask branch. Its key
 * change is RoIAlign, which removes the rounding of RoI Pooling: sample points
 * are placed at fractional bin centers and their feature values come from
 * bilinear interpolation. This alignment preserves exact spatial correspondence,
 * which matters when predicting a mask for every pixel of the region.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(ph * pw * s^2) for s by s samples per output bin
 *   Space: O(ph * pw + classes * ph * pw) for aligned features and logits
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - The aligned feature grid is drawn first, then the per-class mask scores.
 *   - The winning class cell is highlighted for every spatial position.
 *   - Frame meta exposes sampled points, aligned values, and mask argmax.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Box = [number, number, number, number];

interface MaskInput {
    featureMap?: number[][];
    roi?: Box;
    alignedSize?: [number, number];
    samplingRatio?: number;
    maskLogits?: number[][][];
}

/** Bilinear interpolation of a feature map at fractional (row, col). */
export function bilinearSample(featureMap: number[][], y: number, x: number): number {
    const y0 = Math.floor(y);
    const x0 = Math.floor(x);
    const y1 = y0 + 1;
    const x1 = x0 + 1;
    const dy = y - y0;
    const dx = x - x0;
    const v00 = featureMap[y0]?.[x0] ?? 0;
    const v01 = featureMap[y0]?.[x1] ?? 0;
    const v10 = featureMap[y1]?.[x0] ?? 0;
    const v11 = featureMap[y1]?.[x1] ?? 0;
    return (1 - dy) * ((1 - dx) * v00 + dx * v01) + dy * ((1 - dx) * v10 + dx * v11);
}

/** RoIAlign: average bilinear samples taken at fractional bin centers. */
export function roiAlign(
    featureMap: number[][],
    roi: Box,
    outH: number,
    outW: number,
    samplingRatio: number,
): { aligned: number[][]; samples: number[][][] } {
    const [x1, y1, x2, y2] = roi;
    const height = (y2 ?? 0) - (y1 ?? 0);
    const width = (x2 ?? 0) - (x1 ?? 0);
    const binH = height / outH;
    const binW = width / outW;
    const aligned: number[][] = [];
    const samples: number[][][] = [];
    for (let r = 0; r < outH; r += 1) {
        const row: number[] = [];
        const sampleRow: number[][] = [];
        for (let c = 0; c < outW; c += 1) {
            const values: number[] = [];
            for (let sy = 0; sy < samplingRatio; sy += 1) {
                for (let sx = 0; sx < samplingRatio; sx += 1) {
                    const sampleY = (y1 ?? 0) + (r + (sy + 0.5) / samplingRatio) * binH;
                    const sampleX = (x1 ?? 0) + (c + (sx + 0.5) / samplingRatio) * binW;
                    values.push(bilinearSample(featureMap, sampleY, sampleX));
                }
            }
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            row.push(mean);
            sampleRow.push(values);
        }
        aligned.push(row);
        samples.push(sampleRow);
    }
    return { aligned, samples };
}

/** Per spatial cell pick the class with the largest mask logit. */
export function maskArgmax(maskLogits: number[][][]): { mask: number[][]; scores: number[] } {
    const classes = maskLogits.length;
    const rows = maskLogits[0]?.length ?? 0;
    const cols = maskLogits[0]?.[0]?.length ?? 0;
    const mask: number[][] = [];
    for (let r = 0; r < rows; r += 1) {
        const row: number[] = [];
        for (let c = 0; c < cols; c += 1) {
            let best = 0;
            let bestScore = -Infinity;
            for (let k = 0; k < classes; k += 1) {
                const score = maskLogits[k]?.[r]?.[c] ?? -Infinity;
                if (score > bestScore) {
                    bestScore = score;
                    best = k;
                }
            }
            row.push(best);
        }
        mask.push(row);
    }
    return { mask, scores: mask.flat() };
}

function makeCells(aligned: number[][], mask: number[][]): VisualEntity[] {
    const rows = aligned.length;
    const cols = aligned[0]?.length ?? 0;
    const entities: VisualEntity[] = [];
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const value = aligned[r]?.[c] ?? 0;
            entities.push({
                id: `aligned-${r}-${c}`,
                type: "cell",
                label: value.toFixed(2),
                value,
                state: "active",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, kind: "aligned" },
            });
        }
    }
    mask.forEach((row, r) => row.forEach((cls, c) => {
        entities.push({
            id: `mask-${r}-${c}`,
            type: "cell",
            label: `${cls}`,
            value: cls,
            state: "sorted",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: r, col: c, kind: "mask" },
        });
    }));
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MaskInput | null) ?? {};
    const featureMap = (task.featureMap ?? [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 15, 16],
    ]).map((row) => [...row]);
    const roi: Box = [...(task.roi ?? [0, 0, 4, 4])] as Box;
    const [outH, outW] = task.alignedSize ?? [2, 2];
    const samplingRatio = Math.max(1, Math.floor(task.samplingRatio ?? 2));
    const maskLogits = (task.maskLogits ?? [
        [[0.1, 0.2], [1.5, 0.3]],
        [[0.9, 1.2], [0.1, 2.0]],
    ]).map((cls) => cls.map((row) => [...row]));
    const { aligned, samples } = roiAlign(featureMap, roi, outH, outW, samplingRatio);
    const { mask } = maskArgmax(maskLogits);
    const rows = outH * 2;
    const cols = Math.max(outW, mask[0]?.length ?? outW);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(aligned, mask.map((row) => row.map(() => -1))),
        edges: [],
        description: `Mask R-CNN: RoIAlign over ${(roi ?? []).join(",")} into ${outH} by ${outW} with ${samplingRatio} samples per axis.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, featureMap, roi, outH, outW, samplingRatio, aligned: [], samples, maskLogits },
    };
    step += 1;

    for (let r = 0; r < outH; r += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(aligned.slice(0, r + 1), mask.map((row) => row.map(() => -1))),
            edges: [],
            description: `Aligned row ${r}: ${(aligned[r] ?? []).map((v) => v.toFixed(2)).join(",")} from bilinear samples.`,
            codeLineNumber: r === 0 ? 2 : 4,
            layout: "grid",
            meta: { rows, cols, roi, outH, outW, aligned: aligned.slice(0, r + 1), samples, maskLogits },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(aligned, mask),
        edges: [],
        description: `Mask branch picked classes ${mask.flat().join(",")} for each spatial cell.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows, cols, roi, outH, outW, aligned, samples, maskLogits, mask },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A detection mask must line up with the object at the pixel level, so rounding a region's coordinates to integers loses too much information. RoIAlign samples the feature map at fractional positions inside each bin and interpolates between neighboring cells. That aligned grid feeds a small convolutional mask branch that predicts a class for every position.",
        invariants: [
            "Sample positions lie at fractional centers inside their output bin, never at rounded integers.",
            "Bilinear interpolation at an exact grid coordinate returns that grid value.",
            "Each aligned bin averages exactly samplingRatio squared bilinear samples.",
        ],
        correctness:
            "Bilinear interpolation is the unique affine combination of the four surrounding grid values that matches them at integer coordinates. Sampling at fractional bin centers and averaging is the RoIAlign operator, which preserves the spatial mapping from input pixels to output bins. Taking the argmax of the mask logits at each position yields the most likely class independently for every pixel of the region.",
        complexityRationale:
            "Each of the ph times pw bins evaluates s squared bilinear samples, each a constant number of operations, giving O(ph * pw * s squared) time. Storage is the aligned grid plus the class logits, O(ph * pw * classes).",
        uses: [
            "Instance segmentation of objects in images",
            "Medical image contour prediction",
            "Pixel-accurate masking in autonomous perception",
        ],
        references: [
            "He, Gkioxari, Dollar, Girshick, Mask R-CNN, ICCV 2017",
            "Jiang et al., ROI Align Layer, Facebook AI Research, 2017",
        ],
        workedExample:
            "Over region [0,0,4,4] with a 2 by 2 output and two samples per axis, one bin samples at rows 1 and 3 and columns 1 and 3 of the feature map. Because these are integer coordinates, bilinear interpolation returns the exact feature values and the bin is their average.",
    },
    id: "mask-rcnn",
    name: "Mask R-CNN RoIAlign",
    category: "ml-ai",
    complexity: { time: "O(ph * pw * s^2)", space: "O(ph * pw * classes)" },
    defaultInput: {
        featureMap: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]],
        roi: [0, 0, 4, 4],
        alignedSize: [2, 2],
        samplingRatio: 2,
        maskLogits: [
            [[0.1, 0.2], [1.5, 0.3]],
            [[0.9, 1.2], [0.1, 2.0]],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the region box and target aligned grid size",
        "divide the box into equal fractional bins",
        "place sampling points at fractional bin centers",
        "bilinearly interpolate the feature map at each point",
        "average the samples to fill one aligned cell",
        "feed the aligned grid to the mask branch",
        "choose the highest scoring class at every position",
        "done: return the aligned grid and predicted mask",
    ],
};

export default module;
