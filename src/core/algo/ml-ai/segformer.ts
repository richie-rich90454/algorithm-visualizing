/**
 * segformer.ts - SegFormer Mix-MLP Encoder and MLP Decoder
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SegFormer replaces attention with a hierarchy of Mix-MLP blocks: a depthwise
 * convolution mixes spatial positions, then a small channel MLP transforms each
 * cell, and a lightweight MLP decoder maps the features to a per-cell class.
 * This module implements the exact arithmetic core on a single-channel grid:
 * a fixed 3x3 spatial kernel, a two-layer pointwise MLP, and a class decision.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rows * cols * 9) for the depthwise mixing step
 *   Space: O(rows * cols) for each feature and output grid
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the input, mixed features, activation, and class map.
 *   - The final frame marks predicted class-1 cells as sorted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SegformerInput {
    grid?: number[][];
    kernel?: number[][];
    w1?: number;
    b1?: number;
    w2?: number;
    b2?: number;
}

export interface SegformerResult {
    mixed: number[][];
    activated: number[][];
    logits: number[][];
    predicted: number[][];
}

/** Run one SegFormer Mix-MLP block plus the MLP decoder on a single-channel grid. */
export function segformer(
    grid: number[][],
    opts: { kernel?: number[][]; w1?: number; b1?: number; w2?: number; b2?: number } = {},
): SegformerResult {
    const kernel = opts.kernel ?? [
        [0, 1, 0],
        [1, -4, 1],
        [0, 1, 0],
    ];
    const w1 = opts.w1 ?? 0.5;
    const b1 = opts.b1 ?? 0;
    const w2 = opts.w2 ?? 1;
    const b2 = opts.b2 ?? 0;
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    const mixed: number[][] = [];
    const activated: number[][] = [];
    const logits: number[][] = [];
    const predicted: number[][] = [];

    for (let r = 0; r < rows; r += 1) {
        const mixedRow: number[] = [];
        const actRow: number[] = [];
        const logRow: number[] = [];
        const predRow: number[] = [];
        for (let c = 0; c < cols; c += 1) {
            let sum = 0;
            for (let dr = -1; dr <= 1; dr += 1) {
                for (let dc = -1; dc <= 1; dc += 1) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                        continue;
                    }
                    sum += (grid[nr]?.[nc] ?? 0) * (kernel[dr + 1]?.[dc + 1] ?? 0);
                }
            }
            const hidden = Math.max(0, sum * w1 + b1);
            const logit = hidden * w2 + b2;
            mixedRow.push(sum);
            actRow.push(hidden);
            logRow.push(logit);
            predRow.push(logit >= 0 ? 1 : 0);
        }
        mixed.push(mixedRow);
        activated.push(actRow);
        logits.push(logRow);
        predicted.push(predRow);
    }
    return { mixed, activated, logits, predicted };
}

function cells(values: number[][], phase: string): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < values.length; r += 1) {
        for (let c = 0; c < (values[r]?.length ?? 0); c += 1) {
            const value = values[r]?.[c] ?? 0;
            const state: EntityState =
                phase === "input"
                    ? "idle"
                    : phase === "mixed"
                      ? "comparing"
                      : phase === "activated"
                        ? "active"
                        : "sorted";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: phase === "class" ? String(value) : value.toFixed(2),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, phase },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SegformerInput | null) ?? {};
    const grid: number[][] = (task.grid ?? [
        [1, 1, 0, 0],
        [1, 2, 1, 0],
        [0, 1, 2, 1],
        [0, 0, 1, 1],
    ]).map((row) => row.slice());
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    const result = segformer(grid, task);
    let step = 0;

    yield {
        stepNumber: step,
        entities: cells(grid, "input"),
        edges: [],
        description: `Read a ${rows} by ${cols} single-channel feature grid.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { phase: "input", rows, cols, grid },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(result.mixed, "mixed"),
        edges: [],
        description: "A depthwise kernel mixes each cell with its eight neighbors.",
        codeLineNumber: 1,
        layout: "grid",
        meta: { phase: "mixed", rows, cols, kernel: task.kernel ?? [[0, 1, 0], [1, -4, 1], [0, 1, 0]], mixed: result.mixed },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(result.activated, "activated"),
        edges: [],
        description: "The first pointwise MLP applies a linear map and a rectifier.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { phase: "activated", rows, cols, activated: result.activated },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(result.predicted, "class"),
        edges: [],
        description: "The decoder MLP emits a class logit and a class for each cell.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { phase: "class", rows, cols, logits: result.logits, predicted: result.predicted },
    };
    step += 1;

    const count = result.predicted.flat().filter((v) => v === 1).length;
    yield {
        stepNumber: step,
        entities: cells(result.predicted, "class"),
        edges: [],
        description: `Done: the decoder assigned class 1 to ${count} of ${rows * cols} cells.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { phase: "done", rows, cols, predicted: result.predicted, classOneCount: count },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SegFormer shows that attention is not always necessary for vision. It mixes spatial information with a small depthwise convolution, transforms each position with a tiny MLP, and lets a shallow decoder read out a class per cell. Stacking these blocks at several resolutions gives a strong segmentation encoder cheaply.",
        invariants: [
            "The spatial mixing kernel has a fixed nine-cell receptive field with zero padding.",
            "The pointwise MLP is applied independently at every cell.",
            "The output grid has exactly the same dimensions as the input grid.",
        ],
        correctness:
            "For each cell the mixing step sums the product of the kernel with the in-bounds neighbors, which is exactly a depthwise convolution with zero padding. The rectified linear map and the second linear map are applied per cell, so the logit depends only on that cell's mixed feature. Thresholding the logit at zero assigns one of two classes. Because every step keeps the grid shape, the predicted map aligns cell for cell with the input.",
        complexityRationale:
            "Each of the rows times cols cells examines at most nine neighbors, so mixing is O(9 * rows * cols), and the pointwise maps are linear in the cell count. Storing the feature and output grids uses O(rows * cols) space.",
        uses: [
            "Real-time semantic segmentation in autonomous driving",
            "Lightweight vision backbones without self-attention",
            "Teaching convolutional mixing and decoder design",
        ],
        references: [
            "Xie et al., SegFormer: Simple and Efficient Design for Semantic Segmentation, NeurIPS 2021",
            "Tolstikhin et al., MLP-Mixer: An all-MLP Architecture for Vision, NeurIPS 2021",
        ],
        workedExample:
            "On a two by two all-ones grid with the Laplacian kernel, the corner cell has two in-bounds neighbors contributing 1 each and an out-of-bounds neighbor skipped, giving a mixed value of 2. With w1 one half the hidden value is 1, the decoder logit is 1, and the cell is class 1; an isolated cell with mixed value zero gets logit zero and also class 1.",
    },
    id: "segformer",
    name: "SegFormer Mix-MLP Block",
    category: "ml-ai",
    complexity: { time: "O(9 * rows * cols)", space: "O(rows * cols)" },
    defaultInput: {
        grid: [
            [1, 1, 0, 0],
            [1, 2, 1, 0],
            [0, 1, 2, 1],
            [0, 0, 1, 1],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the feature grid and the fixed mixing kernel",
        "for each cell sum kernel times in-bounds neighbors",
        "apply the first pointwise MLP and a rectifier",
        "apply the decoder MLP to obtain a class logit",
        "assign class one when the logit is nonnegative",
        "done: report the per-cell class map",
    ],
};

export default module;
