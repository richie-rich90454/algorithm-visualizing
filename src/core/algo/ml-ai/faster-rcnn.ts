/**
 * faster-rcnn.ts - Faster R-CNN Region Proposals and RoI Pooling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Faster R-CNN is a two-stage detector. A region proposal network proposes a
 * small set of candidate boxes, and a second stage classifies each one. RoI
 * pooling converts every proposed box into a fixed-size feature grid by
 * dividing the box into bins and max-pooling each bin, which makes boxes of
 * different sizes comparable to a shared classifier.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(P log P) to rank proposals plus O(P * ph * pw * binArea) pooling
 *   Space: O(ph * pw) for one pooled region
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Proposal rows show objectness and the selected boxes.
 *   - The pooled ph by pw feature grid appears in subsequent frames.
 *   - Frame meta records proposals, chosen boxes, and pooled values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Box = [number, number, number, number];

interface Proposal {
    box: Box;
    score: number;
}

interface FasterInput {
    proposals?: Proposal[];
    featureMap?: number[][];
    roi?: Box;
    pooledSize?: [number, number];
    topN?: number;
}

/** Rank proposals by objectness and keep the first n. */
export function topProposals(proposals: Proposal[], n: number): Proposal[] {
    return [...proposals]
        .map((p, index) => ({ p, index }))
        .sort((a, b) => b.p.score - a.p.score || a.index - b.index)
        .slice(0, n)
        .map((entry) => entry.p);
}

/** Region-of-interest max pooling with quantized bin boundaries. */
export function roiPool(featureMap: number[][], roi: Box, pooledH: number, pooledW: number): number[][] {
    const [x1, y1, x2, y2] = roi;
    const width = (x2 ?? 0) - (x1 ?? 0);
    const height = (y2 ?? 0) - (y1 ?? 0);
    const out: number[][] = [];
    for (let ph = 0; ph < pooledH; ph += 1) {
        const row: number[] = [];
        for (let pw = 0; pw < pooledW; pw += 1) {
            const left = Math.floor((x1 ?? 0) + (width * pw) / pooledW);
            const right = Math.ceil((x1 ?? 0) + (width * (pw + 1)) / pooledW);
            const top = Math.floor((y1 ?? 0) + (height * ph) / pooledH);
            const bottom = Math.ceil((y1 ?? 0) + (height * (ph + 1)) / pooledH);
            let max = -Infinity;
            for (let r = top; r < bottom; r += 1) {
                for (let c = left; c < right; c += 1) {
                    const value = featureMap[r]?.[c];
                    if (value !== undefined) max = Math.max(max, value);
                }
            }
            row.push(Number.isFinite(max) ? max : 0);
        }
        out.push(row);
    }
    return out;
}

/** Plain records for frame meta. */
function metaProposals(list: Proposal[]): Array<Record<string, number | number[]>> {
    return list.map((proposal) => ({ box: [...proposal.box], score: proposal.score }));
}

function makeCells(matrix: number[][], rows: number, cols: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const value = row < matrix.length ? matrix[row]?.[col] ?? 0 : 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: value.toFixed(1),
                value,
                state: row < matrix.length ? "active" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, pooled: row < matrix.length },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FasterInput | null) ?? {};
    const proposals: Proposal[] = (task.proposals ?? [
        { box: [0, 0, 8, 8], score: 0.91 },
        { box: [1, 1, 7, 7], score: 0.82 },
        { box: [4, 4, 12, 12], score: 0.67 },
        { box: [0, 0, 4, 4], score: 0.55 },
    ]).map((p) => ({ box: [...p.box], score: p.score }));
    const featureMap = (task.featureMap ?? [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 15, 16],
    ]).map((row) => [...row]);
    const roi: Box = [...(task.roi ?? [0.5, 0.5, 3.5, 3.5])] as Box;
    const pooledSize: [number, number] = task.pooledSize ?? [2, 2];
    const topN = Math.max(1, Math.floor(task.topN ?? 2));
    const ranked = topProposals(proposals, topN);
    const pooled = roiPool(featureMap, roi, pooledSize[0], pooledSize[1]);
    const rows = Math.max(ranked.length, pooled.length);
    const cols = Math.max(1, pooledSize[1]);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells([], rows, cols),
        edges: [],
        description: `Faster R-CNN: ${proposals.length} proposals ranked, top ${topN} sent to RoI pooling.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, proposals: metaProposals(proposals), ranked: metaProposals(ranked), roi, pooledSize, pooled: [] },
    };
    step += 1;

    for (let i = 0; i < ranked.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells([], rows, cols),
            edges: [],
            description: `Proposal ${i}: box ${(ranked[i]?.box ?? []).join(",")} with objectness ${(ranked[i]?.score ?? 0).toFixed(2)}.`,
            codeLineNumber: i === 0 ? 2 : 4,
            layout: "grid",
            meta: { rows, cols, proposals: metaProposals(proposals), ranked: metaProposals(ranked), roi, pooledSize, pooled: [], selected: i },
        };
        step += 1;
    }

    for (let r = 0; r < pooled.length; r += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(pooled.slice(0, r + 1), rows, cols),
            edges: [],
            description: `Pooling row ${r} of ${pooled.length}: ${(pooled[r] ?? []).join(",")}.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: { rows, cols, proposals: metaProposals(proposals), ranked: metaProposals(ranked), roi, pooledSize, pooled: pooled.slice(0, r + 1) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(pooled, rows, cols),
        edges: [],
        description: `RoI pooling produced a ${pooledSize[0]} by ${pooledSize[1]} feature grid: ${pooled.flat().join(",")}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows, cols, proposals: metaProposals(proposals), ranked: metaProposals(ranked), roi, pooledSize, pooled },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A two-stage detector first proposes where objects might be, then looks carefully at each proposal. Because proposals have different sizes, the region they cover must be converted to a fixed grid before a classifier can consume it. RoI pooling splits the region into equal bins and keeps the strongest feature in each bin.",
        invariants: [
            "Proposals are ranked by descending objectness with index tie-breaking.",
            "Every pooled bin is the maximum feature value over its quantized source cells.",
            "The pooled output has exactly the requested height and width regardless of box size.",
        ],
        correctness:
            "Bin boundaries are computed by linearly interpolating across the region and then rounding outward, so every source cell belongs to exactly one bin. Taking the maximum over each bin is the original RoI pooling operator, and applying it after selecting the top proposals reproduces the Faster R-CNN second-stage input. A fixed output shape is guaranteed because the number of bins is chosen independently of the box extent.",
        complexityRationale:
            "Ranking P proposals costs O(P log P). Pooling one box visits each source cell a constant number of times across bins, so the total work is proportional to the pooled grid size times the average bin area, with O(ph * pw) space.",
        uses: [
            "Accurate object detection with a dedicated proposal stage",
            "Instance-level recognition in autonomous systems",
            "Transfer learning from proposal-based detectors",
        ],
        references: [
            "Ren, He, Girshick, Sun, Faster R-CNN: Towards Real-Time Object Detection with Region Proposal Networks, NeurIPS 2015",
            "Girshick, Fast R-CNN, ICCV 2015",
        ],
        workedExample:
            "Pooling the 4 by 4 feature map over region [0.5,0.5,3.5,3.5] into 2 by 2 bins uses source rows and columns 0 through 3. The top-left bin covers rows 0 to 2 and columns 0 to 2, whose maximum is 6, and the other bins are pooled the same way.",
    },
    id: "faster-rcnn",
    name: "Faster R-CNN RoI Pooling",
    category: "ml-ai",
    complexity: { time: "O(P log P + ph * pw)", space: "O(ph * pw)" },
    defaultInput: {
        proposals: [
            { box: [0, 0, 8, 8], score: 0.91 },
            { box: [1, 1, 7, 7], score: 0.82 },
            { box: [4, 4, 12, 12], score: 0.67 },
            { box: [0, 0, 4, 4], score: 0.55 },
        ],
        featureMap: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]],
        roi: [0.5, 0.5, 3.5, 3.5],
        pooledSize: [2, 2],
        topN: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "rank region proposals by objectness score",
        "keep the highest scoring proposals",
        "for each pooled output bin compute quantized boundaries",
        "collect feature cells whose coordinates fall in that bin",
        "write the maximum feature value into the bin",
        "repeat until every bin is filled",
        "pass the fixed-size grid to the classifier",
        "done: return the pooled feature grid",
    ],
};

export default module;
