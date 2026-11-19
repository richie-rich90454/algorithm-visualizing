/**
 * swin-transformer.ts - Swin Shifted-Window Attention
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Swin Transformer computes self-attention inside small local windows instead
 * of across the whole image, which keeps cost linear in image size. It alternates
 * a regular windowing pass with a shifted windowing pass: after shifting the
 * feature map by half a window, new windows straddle the old boundaries so
 * information can flow across them. This demo partitions a 4x4 feature map into
 * 2x2 windows, runs a scalar self-attention inside each, then repeats on a
 * cyclically shifted map.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N * w^2) for N windows of w by w tokens
 *   Space: O(N * w) for the per-window attended features
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Frames alternate between window partition and attention output.
 *   - Regular windows come first, then shifted windows and their output.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SwinInput {
    grid: number[];
    size: number;
    window: number;
}

/** Partition a square grid into row-major non-overlapping windows. */
function partition(grid: number[], size: number, window: number): number[][] {
    const windows: number[][] = [];
    for (let row = 0; row < size; row += window) {
        for (let col = 0; col < size; col += window) {
            const values: number[] = [];
            for (let dy = 0; dy < window; dy += 1) {
                for (let dx = 0; dx < window; dx += 1) {
                    values.push(grid[(row + dy) * size + (col + dx)] ?? 0);
                }
            }
            windows.push(values);
        }
    }
    return windows;
}

/** Cyclically shift a square grid by the given number of rows and columns. */
function roll(grid: number[], size: number, shift: number): number[] {
    const result = new Array<number>(grid.length);
    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            const sourceRow = (row - shift + size) % size;
            const sourceCol = (col - shift + size) % size;
            result[row * size + col] = grid[sourceRow * size + sourceCol] ?? 0;
        }
    }
    return result;
}

/** Numerically stable softmax over a vector. */
function softmax(values: number[]): number[] {
    const max = Math.max(...values);
    const exps = values.map((value) => Math.exp(value - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    return exps.map((value) => value / total);
}

/** Local scalar self-attention: each output attends over all window values. */
function localAttention(values: number[]): number[] {
    return values.map((query) => {
        const scores = values.map((key) => (query * key) / Math.sqrt(values.length));
        const weights = softmax(scores);
        return weights.reduce((sum, weight, index) => sum + weight * (values[index] ?? 0), 0);
    });
}

/** Build bar entities for a flattened vector. */
function makeBars(values: number[], stage: string, active: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `feature-${index}`,
        type: "bar" as const,
        label: value.toFixed(2),
        value,
        state: (active ? "active" : "idle") as EntityState,
        x: index * 26,
        y: 0,
        width: 14,
        height: 0,
        metadata: { index, stage, value },
    }));
}

/** The Swin Transformer generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<SwinInput> | null) ?? {};
    const grid: number[] = task.grid ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const size = typeof task.size === "number" ? task.size : 4;
    const window = typeof task.window === "number" ? task.window : 2;
    const shift = Math.floor(window / 2);

    const regular = partition(grid, size, window);
    yield {
        stepNumber: 0,
        entities: makeBars(grid, "input", false),
        edges: [],
        description: `Input feature map with ${grid.length} values in a ${size} by ${size} grid.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { stage: "input", windows: regular.length, values: grid.map((v) => Number(v.toFixed(6))) },
    };
    yield {
        stepNumber: 1,
        entities: makeBars(regular.flat(), "regular-windows", false),
        edges: [],
        description: `Regular partition produced ${regular.length} windows of ${window} by ${window} tokens.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { stage: "regular-windows", windows: regular.length, values: regular.flat().map((v) => Number(v.toFixed(6))) },
    };
    const regularOutput = regular.map(localAttention);
    yield {
        stepNumber: 2,
        entities: makeBars(regularOutput.flat(), "regular-attention", false),
        edges: [],
        description: `Local self-attention was applied independently inside each regular window.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { stage: "regular-attention", windows: regular.length, values: regularOutput.flat().map((v) => Number(v.toFixed(6))) },
    };

    const shiftedGrid = roll(grid, size, shift);
    yield {
        stepNumber: 3,
        entities: makeBars(shiftedGrid, "shifted-grid", false),
        edges: [],
        description: `Cyclically shifted the feature map by ${shift} row(s) and column(s).`,
        codeLineNumber: 4,
        layout: "array",
        meta: { stage: "shifted-grid", windows: regular.length, values: shiftedGrid.map((v) => Number(v.toFixed(6))) },
    };
    const shifted = partition(shiftedGrid, size, window);
    yield {
        stepNumber: 4,
        entities: makeBars(shifted.flat(), "shifted-windows", false),
        edges: [],
        description: `Shifted partition produced ${shifted.length} new windows crossing old boundaries.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { stage: "shifted-windows", windows: shifted.length, values: shifted.flat().map((v) => Number(v.toFixed(6))) },
    };
    const shiftedOutput = shifted.map(localAttention);
    yield {
        stepNumber: 5,
        entities: makeBars(shiftedOutput.flat(), "shifted-attention", true),
        edges: [],
        description: `Local attention on shifted windows let features mix across regular window edges.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { stage: "shifted-attention", windows: shifted.length, values: shiftedOutput.flat().map((v) => Number(v.toFixed(6))) },
    };
}

/** The Swin Transformer module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Full self-attention over an entire image grows quadratically with the number of pixels. Swin Transformer keeps attention local by chopping the image into small windows, then alternates those windows with a shifted partition so that the next pass mixes information across the previous boundaries. It is the sliding-window idea applied to attention, giving global coverage at linear cost.",
        invariants: [
            "Regular windows are non-overlapping and cover the whole feature map.",
            "The shifted partition uses the same window size and covers the map again.",
            "Attention is computed only within a window, never across the whole grid.",
        ],
        correctness:
            "The generator partitions, rolls cyclically by half a window, partitions again, and applies the same scalar self-attention to each window. The test recomputes every stage with an independent reference, verifies the exact attention outputs and window count, and confirms the shifted window contents differ from the regular ones, proving the boundary-crossing shift actually happens.",
        complexityRationale:
            "With N windows of w by w tokens, each window's attention costs O(w^2) and there are N windows, so total time is O(N * w^2), linear in the number of tokens. Only the attended features of all windows are retained, O(N * w) space.",
        uses: [
            "Swin Transformer image classification and dense prediction backbones",
            "Vision models that need linear rather than quadratic attention cost",
            "Hierarchical feature extraction with cross-window connections",
        ],
        references: [
            "Liu et al., Swin Transformer: Hierarchical Vision Transformer, ICCV 2021",
            "Liu et al., Swin Transformer V2, CVPR 2022",
        ],
        workedExample:
            "A 4x4 map with 2x2 windows yields four regular windows such as [1,2,5,6]. Shifting by one wraps the map so a new window becomes [10,11,14,15], which crosses the former boundary. Scalar attention inside each window produces a smoothed value per position, shown in the last frame.",
    },
    id: "swin-transformer",
    name: "Swin Shifted-Window Attention",
    category: "ml-ai",
    complexity: { time: "O(N * w^2)", space: "O(N * w)" },
    defaultInput: { grid: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
    visualType: "array",
    run,
    pseudocode: [
        "read the feature map, its size, and the window size",
        "partition the map into regular non-overlapping windows",
        "apply local self-attention inside each regular window",
        "cyclically shift the map by half a window",
        "partition the shifted map into new windows",
        "apply local self-attention inside each shifted window",
        "emit the cross-window mixed features",
    ],
};

export default module;
