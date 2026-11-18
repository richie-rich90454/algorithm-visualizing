/**
 * lora.ts - Low-Rank Adaptation Matrix Merge
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * LoRA freezes a pretrained weight matrix W and learns a low-rank update
 * B times A, where B has shape (rows by rank) and A has shape (rank by cols)
 * with rank much smaller than rows or cols. At merge time the adapted weight is
 * W plus B times A. This module visualizes that merge one output cell at a time:
 * each cell is a dot product of a row of B with a column of A. It is the exact
 * linear-algebra core of LoRA, shown on tiny integer matrices; it is not a
 * training loop or a production adapter runtime.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rows * cols * rank) for the dense merge
 *   Space: O(rows * cols) for the merged weight
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells form the merged weight matrix, positioned by row and column.
 *   - The cell being computed is ACTIVE; finished cells are SORTED.
 *   - Full parameter count versus LoRA parameter count is reported in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LoraInput {
    W?: number[][];
    B?: number[][];
    A?: number[][];
}

function matrix(value: number[][] | undefined, fallback: number[][]): number[][] {
    return Array.isArray(value) && value.length > 0 && value.every((row) => Array.isArray(row))
        ? value
        : fallback;
}

/** Build the matrix cells for a frame. */
function makeCells(
    merged: number[][],
    processed: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < merged.length; i += 1) {
        const row = merged[i] ?? [];
        for (let j = 0; j < row.length; j += 1) {
            const index = i * (merged[0]?.length ?? 0) + j;
            let state: EntityState = "idle";
            if (index < processed) {
                state = "sorted";
            } else if (index === processed) {
                state = "active";
            }
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: index <= processed ? String(row[j] ?? 0) : "?",
                value: index <= processed ? (row[j] ?? 0) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

/** Run the LoRA merge generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LoraInput | null) ?? {};
    const W = matrix(task.W, [[1, 2, 3], [4, 5, 6]]);
    const B = matrix(task.B, [[1, 0], [0, 1]]);
    const A = matrix(task.A, [[1, 2, 3], [0, 1, 1]]);
    const rows = W.length;
    const cols = W[0]?.length ?? 0;
    const rank = B[0]?.length ?? 0;

    const merged = W.map((row) => [...row]);
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            let delta = 0;
            for (let k = 0; k < rank; k += 1) {
                delta += (B[i]?.[k] ?? 0) * (A[k]?.[j] ?? 0);
            }
            merged[i]![j] = (W[i]?.[j] ?? 0) + delta;
        }
    }
    const flat = merged.flatMap((row) => row);
    const fullParams = rows * cols;
    const loraParams = rows * rank + rank * cols;
    let step = 0;
    let processed = 0;

    const frame = (description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(merged, processed),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: {
            rows,
            cols,
            rank,
            fullParams,
            loraParams,
            computed: processed,
            mergedFlat: flat,
        },
    });

    yield frame(`Merge a frozen ${rows} by ${cols} weight with a rank-${rank} LoRA update.`, 0);

    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            const delta = (merged[i]?.[j] ?? 0) - (W[i]?.[j] ?? 0);
            yield frame(
                `Cell (${i}, ${j}) = W ${W[i]?.[j] ?? 0} + delta ${delta} = ${merged[i]?.[j] ?? 0}.`,
                2,
            );
            processed += 1;
        }
    }

    yield frame(
        `Merged weight ready; ${loraParams} trainable parameters replace ${fullParams} full-rank parameters.`,
        5,
    );
}

/** The LoRA module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Fine-tuning every weight in a large model is expensive, and the update often has low intrinsic rank. LoRA freezes the original weight and learns a small B times A product instead. At deployment the two factors are multiplied and added back, so inference uses the original matrix with no extra layers.",
        invariants: [
            "The frozen weight W is never changed during the merge.",
            "Every merged cell equals W[i][j] plus the dot product of B row i with A column j.",
            "The rank limits the number of learned parameters to rows times rank plus rank times cols.",
        ],
        correctness:
            "Matrix multiplication defines each entry of B times A as the sum over k of B[i][k] times A[k][j]. Adding W entrywise produces exactly the adapted weight that a full fine-tune would store in W prime, so the forward pass of the merged model is identical to applying W plus B times A.",
        complexityRationale:
            "Computing all rows times cols cells, each with a rank-length dot product, costs O(rows * cols * rank) time and O(rows * cols) space for the merged result. Storage drops from rows times cols to rows times rank plus rank times cols parameters.",
        uses: [
            "Parameter-efficient fine-tuning of large language models",
            "Serving many customized models from one shared base checkpoint",
            "On-device adaptation where memory and storage are limited",
        ],
        references: [
            "Hu et al., LoRA: Low-Rank Adaptation of Large Language Models, 2021",
            "Dettmers et al., QLoRA: Efficient Finetuning of Quantized LLMs, 2023",
        ],
        workedExample:
            "With W = [[1, 2, 3], [4, 5, 6]], B = [[1, 0], [0, 1]], and A = [[1, 2, 3], [0, 1, 1]], the update B times A is [[1, 2, 3], [0, 1, 1]], so the merged weight is [[2, 4, 6], [4, 6, 7]]. Six LoRA parameters replace six full parameters here; the saving grows with matrix size.",
    },
    id: "lora",
    name: "LoRA (Low-Rank Adaptation Merge)",
    category: "ml-ai",
    complexity: { time: "O(rows * cols * rank)", space: "O(rows * cols)" },
    defaultInput: { W: [[1, 2, 3], [4, 5, 6]], B: [[1, 0], [0, 1]], A: [[1, 2, 3], [0, 1, 1]] },
    visualType: "grid",
    run,
    pseudocode: [
        "keep the pretrained weight W frozen",
        "for each output cell i, j of the weight matrix",
        "sum over k of B[i,k] times A[k,j] to get the low-rank delta",
        "set merged[i,j] to W[i,j] plus that delta",
        "continue until every cell has been merged",
        "compare full parameter count with LoRA parameter count",
        "done: return the merged weight for inference",
    ],
};

export default module;
