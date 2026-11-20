/**
 * nested-unet.ts - Nested Dense Skip U-Net (U-Net++ Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A nested U-Net replaces the single long skip connection with a ladder of
 * dense skips: every decoder node receives the upsampled feature from the level
 * below and a direct feature from the encoder at its own level. This shortens
 * the gradient path and lets the decoder fuse features at several scales. This
 * module implements the exact single-channel core: two pooling levels, nearest
 * upsampling, and the nested skip fusion.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rows * cols) for the pooling and fusion passes
 *   Space: O(rows * cols) for the stored feature maps
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the input, encoder maps, bottleneck, and nested output.
 *   - The final frame marks the fused segmentation map.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface NestedInput {
    grid?: number[][];
}

/** Average-pool a grid by non-overlapping two-by-two blocks. */
export function pool2(grid: number[][]): number[][] {
    const rows = Math.floor(grid.length / 2);
    const cols = Math.floor((grid[0]?.length ?? 0) / 2);
    const out: number[][] = [];
    for (let r = 0; r < rows; r += 1) {
        const row: number[] = [];
        for (let c = 0; c < cols; c += 1) {
            let sum = 0;
            let count = 0;
            for (let dr = 0; dr < 2; dr += 1) {
                for (let dc = 0; dc < 2; dc += 1) {
                    const value = grid[2 * r + dr]?.[2 * c + dc];
                    if (value !== undefined) {
                        sum += value;
                        count += 1;
                    }
                }
            }
            row.push(count === 0 ? 0 : sum / count);
        }
        out.push(row);
    }
    return out;
}

/** Nearest-neighbor upsample a grid to a target shape. */
export function upsample(grid: number[][], rows: number, cols: number): number[][] {
    const srcRows = grid.length;
    const srcCols = grid[0]?.length ?? 0;
    const out: number[][] = [];
    for (let r = 0; r < rows; r += 1) {
        const row: number[] = [];
        const sr = Math.min(srcRows - 1, Math.floor(((r + 0.5) * srcRows) / rows));
        for (let c = 0; c < cols; c += 1) {
            const sc = Math.min(srcCols - 1, Math.floor(((c + 0.5) * srcCols) / cols));
            row.push(grid[sr]?.[sc] ?? 0);
        }
        out.push(row);
    }
    return out;
}

/** Run the nested encoder-decoder fusion and return each intermediate map. */
export function nestedUnet(grid: number[][]) {
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    const e1 = pool2(grid);
    const e2 = pool2(e1);
    const up1 = upsample(e2, e1.length, e1[0]?.length ?? 0);
    const nest1 = e1.map((row, r) => row.map((value, c) => 0.5 * value + 0.5 * (up1[r]?.[c] ?? 0)));
    const up0 = upsample(nest1, rows, cols);
    const nest0 = grid.map((row, r) => row.map((value, c) => 0.5 * value + 0.5 * (up0[r]?.[c] ?? 0)));
    const direct = upsample(e1, rows, cols);
    const output = nest0.map((row, r) => row.map((value, c) => value + 0.25 * (direct[r]?.[c] ?? 0)));
    return { e1, e2, nest1, nest0, output };
}

function cells(values: number[][], phase: string): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < values.length; r += 1) {
        for (let c = 0; c < (values[r]?.length ?? 0); c += 1) {
            const value = values[r]?.[c] ?? 0;
            const state: EntityState = phase === "input" ? "idle" : phase === "done" ? "sorted" : "comparing";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: value.toFixed(2),
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
    const task = (input as NestedInput | null) ?? {};
    const grid: number[][] = (task.grid ?? [
        [1, 2, 3, 4],
        [2, 3, 4, 5],
        [3, 4, 5, 6],
        [4, 5, 6, 7],
    ]).map((row) => row.slice());
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    const { e1, e2, nest1, output } = nestedUnet(grid);
    let step = 0;

    yield {
        stepNumber: step,
        entities: cells(grid, "input"),
        edges: [],
        description: `Read a ${rows} by ${cols} input feature map.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { phase: "input", rows, cols, grid },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(e1, "encode"),
        edges: [],
        description: `First encoder level averages two-by-two blocks into ${e1.length} by ${e1[0]?.length ?? 0}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { phase: "encode1", rows: e1.length, cols: e1[0]?.length ?? 0, map: e1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(e2, "bottleneck"),
        edges: [],
        description: `The bottleneck pools again to ${e2.length} by ${e2[0]?.length ?? 0} before decoding.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { phase: "bottleneck", rows: e2.length, cols: e2[0]?.length ?? 0, map: e2 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(nest1, "nest"),
        edges: [],
        description: "A nested skip fuses the upsampled bottleneck with the encoder map.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { phase: "nest", rows: nest1.length, cols: nest1[0]?.length ?? 0, map: nest1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(output, "done"),
        edges: [],
        description: `Done: dense skips produced a ${rows} by ${cols} fused output map.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { phase: "done", rows, cols, map: output },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain U-Net sends one skip from each encoder level straight across to the decoder. U-Net++ makes those skips dense, so a decoder node also sees features from the level below and from its own encoder level. The extra paths shorten the route for gradients and let the network combine fine and coarse detail at every scale.",
        invariants: [
            "Pooling halves each spatial dimension by averaging non-overlapping two-by-two blocks.",
            "Upsampling uses nearest neighbors and restores the target shape exactly.",
            "The final output has the same dimensions as the input map.",
        ],
        correctness:
            "Each pooling step averages exactly the available cells in its two-by-two window, so a constant input yields a constant map of the same value. Nearest-neighbor upsampling maps every target cell to a valid source cell and reproduces the target shape. The nested skip is a convex combination of the encoder map and the upsampled deeper map, and adding the direct encoder skip gives the defined output. Because all upsampling targets are the original shapes, the output aligns cell for cell with the input.",
        complexityRationale:
            "Pooling visits each cell once, upsampling writes each target cell once, and the fusion scans the maps a constant number of times, so time is O(rows * cols). The stored feature maps use O(rows * cols) space.",
        uses: [
            "Biomedical image segmentation with multi-scale context",
            "Dense skip Connections in encoder-decoder networks",
            "Teaching pooling, upsampling, and skip fusion",
        ],
        references: [
            "Zhou et al., UNet++: A Nested U-Net Architecture, arXiv 2018",
            "Ronneberger et al., U-Net: Convolutional Networks for Biomedical Segmentation, MICCAI 2015",
        ],
        workedExample:
            "For a two-by-two block of values 1, 2, 3, 4 the pooled value is 2.5. If the bottleneck upsamples back to 2.5 everywhere, the nested skip is 0.5 times 2.5 plus 0.5 times 2.5, which is 2.5, and adding the direct encoder skip at quarter weight keeps a constant map at 1.25 times the constant value.",
    },
    id: "nested-unet",
    name: "Nested U-Net (U-Net++) Core",
    category: "ml-ai",
    complexity: { time: "O(rows * cols)", space: "O(rows * cols)" },
    defaultInput: {
        grid: [
            [1, 2, 3, 4],
            [2, 3, 4, 5],
            [3, 4, 5, 6],
            [4, 5, 6, 7],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the input feature map",
        "average-pool twice to build encoder levels and a bottleneck",
        "upsample the bottleneck to the first encoder shape",
        "fuse the upsampled map with its encoder map",
        "upsample that nested map to the input shape and fuse again",
        "add the direct encoder skip at quarter weight",
        "done: report the fused output map",
    ],
};

export default module;
