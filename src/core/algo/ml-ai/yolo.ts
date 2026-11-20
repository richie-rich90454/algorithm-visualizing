/**
 * yolo.ts - YOLO Anchor Matching and Non-Maximum Suppression
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * YOLO frames detection as a single regression problem: a grid predicts boxes
 * relative to anchor templates, each box receives an objectness score and a
 * class, and overlapping duplicate detections are removed by non-maximum
 * suppression. The computational core here is the anchor-to-target matching
 * by intersection over union and the class-wise greedy suppression step.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(A * G) for matching plus O(D^2) for pairwise NMS suppression
 *   Space: O(D) for the kept detection list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Each row of the grid is a candidate detection with its score.
 *   - Kept detections are green, suppressed ones red, undecided ones idle.
 *   - Frame meta exposes IoU values, suppression reasons, and final boxes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Box = [number, number, number, number];

interface Detection {
    box: Box;
    score: number;
    classId: number;
}

interface YoloInput {
    detections?: Detection[];
    anchors?: Box[];
    iouThreshold?: number;
    nmsThreshold?: number;
}

/** Intersection over union of two axis-aligned boxes. */
export function iou(a: Box, b: Box): number {
    const left = Math.max(a[0] ?? 0, b[0] ?? 0);
    const top = Math.max(a[1] ?? 0, b[1] ?? 0);
    const right = Math.min(a[2] ?? 0, b[2] ?? 0);
    const bottom = Math.min(a[3] ?? 0, b[3] ?? 0);
    const interW = Math.max(0, right - left);
    const interH = Math.max(0, bottom - top);
    const intersection = interW * interH;
    const areaA = Math.max(0, a[2]! - a[0]!) * Math.max(0, a[3]! - a[1]!);
    const areaB = Math.max(0, b[2]! - b[0]!) * Math.max(0, b[3]! - b[1]!);
    const union = areaA + areaB - intersection;
    return union === 0 ? 0 : intersection / union;
}

/** Assign each anchor to its highest-IoU target above the threshold. */
export function matchAnchors(anchors: Box[], targets: Box[], threshold: number): number[] {
    return anchors.map((anchor) => {
        let bestIndex = -1;
        let bestIoU = threshold;
        targets.forEach((target, index) => {
            const overlap = iou(anchor, target);
            if (overlap > bestIoU) {
                bestIoU = overlap;
                bestIndex = index;
            }
        });
        return bestIndex;
    });
}

/** Class-wise greedy non-maximum suppression, highest score first. */
export function nms(detections: Detection[], threshold: number): { kept: number[]; suppressed: number[] } {
    const order = detections
        .map((d, index) => ({ index, score: d.score, classId: d.classId }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
    const kept: number[] = [];
    const suppressed: number[] = [];
    for (const candidate of order) {
        let overlaps = false;
        for (const keptIndex of kept) {
            const other = detections[keptIndex];
            if (other?.classId === candidate.classId && iou(other.box, detections[candidate.index]?.box ?? [0, 0, 0, 0]) > threshold) {
                overlaps = true;
                break;
            }
        }
        if (overlaps) suppressed.push(candidate.index);
        else kept.push(candidate.index);
    }
    return { kept, suppressed };
}

/** Plain records for frame meta. */
function metaDetections(detections: Detection[]): Array<Record<string, number | number[]>> {
    return detections.map((detection) => ({
        box: [...detection.box],
        score: detection.score,
        classId: detection.classId,
    }));
}

function makeCells(detections: Detection[], kept: number[], suppressed: number[], active: number): VisualEntity[] {
    return detections.map((d, index) => {
        const state: EntityState = kept.includes(index)
            ? "sorted"
            : suppressed.includes(index)
                ? "error"
                : index === active
                    ? "comparing"
                    : "idle";
        return {
            id: `detection-${index}`,
            type: "cell" as const,
            label: d.score.toFixed(2),
            value: d.score,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: index, col: 0, classId: d.classId, ...d.box.reduce<Record<string, number>>((acc, v, i) => {
                acc[`box${i}`] = v;
                return acc;
            }, {}) },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as YoloInput | null) ?? {};
    const detections: Detection[] = (task.detections ?? [
        { box: [0, 0, 4, 4], score: 0.95, classId: 0 },
        { box: [0.2, 0.2, 4.1, 4.2], score: 0.88, classId: 0 },
        { box: [6, 6, 9, 9], score: 0.72, classId: 0 },
        { box: [6.1, 6.2, 9.2, 9.1], score: 0.61, classId: 0 },
        { box: [0, 0, 4, 4], score: 0.80, classId: 1 },
    ]).map((d) => ({ box: [...d.box], score: d.score, classId: d.classId }));
    const anchors: Box[] = (task.anchors ?? [
        [0, 0, 4, 4],
        [6, 6, 9, 9],
    ]).map((a) => [...a]);
    const iouThreshold = typeof task.iouThreshold === "number" ? task.iouThreshold : 0.5;
    const nmsThreshold = typeof task.nmsThreshold === "number" ? task.nmsThreshold : 0.4;
    const assignments = matchAnchors(anchors, anchors, iouThreshold);
    const result = nms(detections, nmsThreshold);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(detections, [], [], -1),
        edges: [],
        description: `${detections.length} detections over ${anchors.length} anchors; IoU threshold ${iouThreshold}, NMS threshold ${nmsThreshold}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: detections.length, cols: 1, detections: metaDetections(detections), anchors, assignments, kept: [], suppressed: [] },
    };
    step += 1;

    let kept: number[] = [];
    let suppressed: number[] = [];
    const ranked = detections
        .map((d, index) => ({ d, index }))
        .sort((a, b) => b.d.score - a.d.score || a.index - b.index);
    for (const { index, d } of ranked) {
        const overlaps = result.suppressed.includes(index);
        if (overlaps) suppressed = [...suppressed, index];
        else kept = [...kept, index];
        yield {
            stepNumber: step,
            entities: makeCells(detections, kept, suppressed, index),
            edges: [],
            description: `Detection ${index} score ${d.score.toFixed(2)} class ${d.classId}: ${overlaps ? "suppressed" : "kept"}.`,
            codeLineNumber: step === 1 ? 2 : 4,
            layout: "grid",
            meta: { rows: detections.length, cols: 1, detections: metaDetections(detections), anchors, assignments, kept, suppressed },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(detections, result.kept, result.suppressed, -1),
        edges: [],
        description: `Non-maximum suppression kept ${result.kept.length} box(es): ${result.kept.join(",")}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: detections.length, cols: 1, detections: metaDetections(detections), anchors, assignments, kept: result.kept, suppressed: result.suppressed },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "YOLO looks at an image once and has each grid cell propose a few boxes shaped like common object sizes. A box is trusted when it overlaps a target well, but neighboring cells often propose nearly the same box. Non-maximum suppression keeps the highest-scoring box in an overlap cluster and throws away the rest.",
        invariants: [
            "Intersection over union lies in the closed interval from zero to one.",
            "Non-maximum suppression visits detections in descending score order with index tie-breaking.",
            "Two kept boxes of the same class never have IoU above the suppression threshold.",
        ],
        correctness:
            "IoU is the exact ratio of intersection area to union area for axis-aligned boxes. Greedy suppression processes boxes from most to least confident and discards a box whenever it substantially overlaps an already kept box of the same class, which is the standard YOLO post-processing rule. Starting from the highest score guarantees the most confident box in a cluster survives.",
        complexityRationale:
            "Matching A anchors against G targets costs O(A G) IoU evaluations. Suppression compares each of D detections against every kept detection, costing O(D squared) in the worst case with O(D) space.",
        uses: [
            "Real-time object detection in images and video",
            "Autonomous driving perception pipelines",
            "Industrial visual inspection and counting",
        ],
        references: [
            "Redmon, Divvala, Girshick, Farhadi, You Only Look Once, CVPR 2016",
            "Redmon and Farhadi, YOLOv3: An Incremental Improvement, 2018",
        ],
        workedExample:
            "A box score 0.95 at [0,0,4,4] and a box score 0.88 at [0.2,0.2,4.1,4.2] overlap by about 0.75 IoU. With a suppression threshold of 0.4 the second box is dropped because it overlaps the first kept box of the same class.",
    },
    id: "yolo",
    name: "YOLO Detection Matching and NMS",
    category: "ml-ai",
    complexity: { time: "O(D^2)", space: "O(D)" },
    defaultInput: {
        detections: [
            { box: [0, 0, 4, 4], score: 0.95, classId: 0 },
            { box: [0.2, 0.2, 4.1, 4.2], score: 0.88, classId: 0 },
            { box: [6, 6, 9, 9], score: 0.72, classId: 0 },
            { box: [6.1, 6.2, 9.2, 9.1], score: 0.61, classId: 0 },
            { box: [0, 0, 4, 4], score: 0.80, classId: 1 },
        ],
        anchors: [[0, 0, 4, 4], [6, 6, 9, 9]],
        iouThreshold: 0.5,
        nmsThreshold: 0.4,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "assign anchors to targets by highest intersection over union",
        "collect all predicted boxes with scores and classes",
        "sort detections by descending score with index tie-break",
        "initialize kept and suppressed lists as empty",
        "for each detection in sorted order",
        "if it overlaps a kept box of the same class suppress it",
        "otherwise add it to the kept list",
        "done: return the surviving detections",
    ],
};

export default module;
