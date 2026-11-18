/**
 * segment-anything.ts - Segment Anything (Prompt-Guided Mask Selection Core)
 *
 * TEACHING MODEL, NOT THE FULL SAM DECODER. Given a sparse point prompt, the
 * mask decoder of Segment Anything proposes several candidate masks and an
 * estimated intersection-over-union for each. This module implements the final
 * teachable step: score each candidate by its agreement with a reference mask
 * and its predicted quality, then select the highest-scoring candidate.
 *
 * Complexity:
 *   Time:  O(c * p) for c candidate masks over p mask cells
 *   Space: O(c * p) for the displayed candidate masks
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Cell = number | null;

function fmt(value: number): string {
    return String(Math.round(value * 1000) / 1000);
}

/** Intersection-over-union of two binary masks. */
function iou(mask: number[], reference: number[]): number {
    let intersection = 0;
    let union = 0;
    for (let i = 0; i < Math.min(mask.length, reference.length); i += 1) {
        const a = (mask[i] ?? 0) > 0 ? 1 : 0;
        const b = (reference[i] ?? 0) > 0 ? 1 : 0;
        intersection += a & b;
        union += a | b;
    }
    return union === 0 ? 0 : intersection / union;
}

function makeCells(
    matrix: Cell[][],
    revealedRows: number,
    current: number,
    winner: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const cells = matrix[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
            const value = cells[col] ?? null;
            const hidden = row >= revealedRows || value === null;
            let state: EntityState = "unvisited";
            if (!hidden) {
                if (row === winner && current === -1) {
                    state = "path";
                } else if (row === current) {
                    state = "active";
                } else {
                    state = "sorted";
                }
            }
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: hidden ? "?" : String(value),
                value: value ?? -1,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { masks?: number[][]; predictedIoU?: number[]; reference?: number[] } | null
    ) ?? {};
    const masks = task.masks?.length
        ? task.masks
        : [
              [0, 0, 0, 0, 0, 0, 0, 0, 0],
              [0, 1, 1, 0, 1, 1, 0, 0, 0],
              [0, 1, 1, 1, 1, 1, 0, 0, 0],
              [1, 1, 1, 1, 1, 1, 0, 0, 0],
          ];
    const predicted = task.predictedIoU?.length
        ? task.predictedIoU
        : [0.2, 0.85, 0.7, 0.55];
    const reference = task.reference?.length
        ? task.reference
        : [0, 1, 1, 0, 1, 1, 0, 0, 0];
    const width = Math.max(1, ...masks.map((mask) => mask.length));
    const grid = masks.map((mask) => Array.from({ length: width }, (_, i) => mask[i] ?? 0));
    const ref = Array.from({ length: width }, (_, i) => reference[i] ?? 0);
    const ious = grid.map((mask) => iou(mask, ref));
    const scores = grid.map((mask, i) => ious[i]! * (predicted[i] ?? 0));
    let winner = 0;
    for (let i = 1; i < scores.length; i += 1) {
        if ((scores[i] ?? 0) > (scores[winner] ?? 0)) {
            winner = i;
        }
    }
    const base = {
        rows: grid.length,
        cols: width,
        candidates: grid.length,
        maskCells: width,
    };

    yield {
        stepNumber: 0,
        entities: makeCells(grid, 0, -1, -1),
        edges: [],
        description: `A point prompt asks the decoder for a mask; ${grid.length} candidates are proposed.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "prompt", winner: -1 },
    };
    for (let i = 0; i < grid.length; i += 1) {
        yield {
            stepNumber: i + 1,
            entities: makeCells(grid, i + 1, i, -1),
            edges: [],
            description: `Candidate ${i}: predicted quality ${fmt(predicted[i] ?? 0)}, measured overlap ${fmt(ious[i] ?? 0)}, score ${fmt(scores[i] ?? 0)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                ...base,
                phase: "score",
                candidate: i,
                ious: ious.map(fmt),
                scores: scores.map(fmt),
                winner: -1,
            },
        };
    }
    yield {
        stepNumber: grid.length + 1,
        entities: makeCells(grid, grid.length, -1, winner),
        edges: [],
        description: `Selected candidate ${winner} with score ${fmt(scores[winner] ?? 0)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            ...base,
            phase: "selected",
            winner,
            ious: ious.map(fmt),
            scores: scores.map(fmt),
            reference: ref,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A sparse click is ambiguous, so the mask decoder returns several plausible masks together with a predicted quality score. The final choice balances how well each candidate matches the prompted object with the decoder's own confidence, and the highest-scoring mask is shown to the user.",
        invariants: [
            "Every candidate mask has the same number of cells as the reference region.",
            "Intersection over union is zero when the union of the two masks is empty.",
            "The selected candidate has the maximum product of predicted quality and measured overlap.",
        ],
        correctness:
            "Intersection over union counts shared foreground cells divided by the cells covered by either mask, so it always lies between zero and one. Multiplying by the predicted quality, which is also in that range, gives a comparable score for every candidate. A single scan that replaces the leader only on a strictly larger score returns a candidate with maximal score and breaks ties toward the earliest candidate.",
        complexityRationale:
            "Each candidate is compared cell by cell with the reference, which costs O(p) per mask for c masks, so the time is O(c times p). The displayed candidate grid uses O(c times p) space.",
        uses: [
            "Interactive click-guided image segmentation",
            "Dataset labeling with a human in the loop",
            "A teaching model of mask ranking after a sparse prompt",
        ],
        references: [
            "Kirillov et al., Segment Anything, 2023",
            "Ravi et al., Segment Anything Model 2, 2024",
        ],
        workedExample:
            "With a reference region of nine cells and four candidates, a candidate that matches the region on five of six foreground cells has overlap 0.83. Multiplied by a predicted quality of 0.85 it scores about 0.71, which can beat a larger mask with lower predicted quality.",
    },
    id: "segment-anything",
    name: "Segment Anything (Prompt-Guided Mask Selection Core)",
    category: "ml-ai",
    complexity: { time: "O(c * p)", space: "O(c * p)" },
    defaultInput: {
        masks: [
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 1, 1, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 0, 0, 0],
            [1, 1, 1, 1, 1, 1, 0, 0, 0],
        ],
        predictedIoU: [0.2, 0.85, 0.7, 0.55],
        reference: [0, 1, 1, 0, 1, 1, 0, 0, 0],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "receive a point prompt and propose candidate masks",
        "for each candidate compute overlap with the prompted region",
        "multiply the overlap by the predicted quality to get a score",
        "track the highest score seen so far",
        "return the candidate with the maximum score",
        "done: display the selected mask",
    ],
};

export default module;
