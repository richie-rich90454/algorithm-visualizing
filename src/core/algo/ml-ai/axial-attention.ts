/**
 * axial-attention.ts - Axial Attention over a 2D Feature Map
 *
 * Full attention over an image is quadratic in the number of pixels. Axial
 * attention instead attends along one axis at a time: first across each row,
 * then down each column. Two passes of linear-cost attention let every cell
 * communicate with the whole map while keeping the computation tractable.
 *
 * Time O(R * C * (R + C)), space O(R * C) for each intermediate map.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Grid = number[][];

/** Scale-free softmax attention of scalar values along a single axis. */
function attendAlong(values: number[], targetIndex: number): number {
    const target = values[targetIndex] ?? 0;
    const scores = values.map((v) => v * target);
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return values.reduce((acc, v, j) => acc + ((exps[j] ?? 0) / sum) * v, 0);
}

export interface AxialResult {
    input: Grid;
    rowAttention: Grid;
    columnAttention: Grid;
}

/** Apply row attention followed by column attention. */
export function axialAttention(inputGrid: Grid): AxialResult {
    const R = inputGrid.length;
    const C = inputGrid[0]?.length ?? 0;
    const rowAttention: Grid = Array.from({ length: R }, (_, r) =>
        Array.from({ length: C }, (_, c) => attendAlong(inputGrid[r] ?? [], c)),
    );
    const columnAttention: Grid = Array.from({ length: R }, () => new Array(C).fill(0));
    for (let c = 0; c < C; c += 1) {
        const column = rowAttention.map((row) => row[c] ?? 0);
        for (let r = 0; r < R; r += 1) {
            columnAttention[r]![c] = attendAlong(column, r);
        }
    }
    return { input: inputGrid, rowAttention, columnAttention };
}

function makeCells(gridToShow: Grid): VisualEntity[] {
    const entities: VisualEntity[] = [];
    gridToShow.forEach((row, r) => {
        row.forEach((v, c) => {
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: `${v.toFixed(3)}`,
                value: v,
                state: "sorted",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { grid?: Grid } | null) ?? {};
    const grid = task.grid ?? [[1, 2, -1], [0.5, -2, 3], [2, 1, 0]];
    const result = axialAttention(grid);
    const R = grid.length;
    const C = grid[0]?.length ?? 0;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(result.input),
        edges: [],
        description: `Axial attention on a ${R} by ${C} map: the input feature values.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: R, cols: C, output: result.columnAttention.flat(), outCols: C },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeCells(result.rowAttention),
        edges: [],
        description: "Row pass: each cell attends to every other cell in its row.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: R, cols: C, output: result.columnAttention.flat(), outCols: C },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeCells(result.columnAttention),
        edges: [],
        description: "Column pass: each cell attends down its column using the row-attended values.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: R, cols: C, output: result.columnAttention.flat(), outCols: C },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeCells(result.columnAttention),
        edges: [],
        description: "Done: two axial passes let every cell gather information from the whole map.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: R, cols: C, output: result.columnAttention.flat(), outCols: C, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Attention over a whole image grows quadratically with the number of pixels. Axial attention breaks the problem into a horizontal pass and a vertical pass: each cell first attends across its row and then down its column. After the two passes, information has traveled across the entire feature map at a fraction of the cost of full attention.",
        invariants: [
            "The row pass never mixes cells from different rows.",
            "The column pass consumes the row-attended values, not the original input.",
            "Each weighted average uses softmax weights that sum to one.",
        ],
        correctness:
            "For each target cell the code forms scores as the product of the target value with each candidate value, applies a numerically stable softmax, and returns the weighted sum of candidate values. It performs this operation independently along every row and then along every column of the row-attended map. An independent brute-force recomputation of the two stacked passes reproduces every output cell, which the test verifies.",
        complexityRationale:
            "A row of length C costs O(C) per cell and there are R rows, so the row pass is O(R * C^2); the column pass is O(C * R^2). Total time is O(R * C * (R + C)) and each intermediate map stores O(R * C) values.",
        uses: [
            "Vision transformers with large feature maps",
            "Image generation and segmentation models",
            "Efficient attention over grids and feature maps",
        ],
        references: [
            "Ho et al., Axial Attention in Multidimensional Transformers, arXiv 2019",
            "Vaswani et al., Attention Is All You Need, NeurIPS 2017",
        ],
        workedExample:
            "On a two by two grid with values [[1, 2], [3, 4]], the row pass lets each cell mix with its row partner. The column pass then mixes the two rows, so the lower-right cell ends up influenced by all four original values through the chain of two attentions.",
    },
    id: "axial-attention",
    name: "Axial Attention",
    category: "ml-ai",
    complexity: { time: "O(R * C * (R + C))", space: "O(R * C)" },
    defaultInput: { grid: [[1, 2, -1], [0.5, -2, 3], [2, 1, 0]] },
    visualType: "grid",
    run,
    pseudocode: [
        "let A be the input feature map",
        "for each row attend every cell to all cells in that row",
        "store the row-attended values as B",
        "for each column attend every cell to all cells in that column of B",
        "store the column-attended values as C",
        "done: report the fully attended map C",
    ],
};

export default module;
