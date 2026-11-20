/** yolo.test.ts - IoU, anchor matching, NMS properties, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { iou, matchAnchors, nms } from "./yolo";
import type { VisualFrame } from "@/types";

type Detection = { box: [number, number, number, number]; score: number; classId: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("YOLO matching and NMS", () => {
    it("computes exact IoU including disjoint and identical boxes", () => {
        expect(iou([0, 0, 2, 2], [0, 0, 2, 2])).toBeCloseTo(1, 12);
        expect(iou([0, 0, 2, 2], [3, 3, 4, 4])).toBe(0);
        expect(iou([0, 0, 2, 2], [1, 0, 3, 2])).toBeCloseTo(1 / 3, 12);
    });

    it("matches anchors to the best target above threshold", () => {
        const anchors: Array<[number, number, number, number]> = [[0, 0, 2, 2], [10, 10, 11, 11]];
        expect(matchAnchors(anchors, [[0, 0, 2, 2]], 0.5)).toEqual([0, -1]);
    });

    it("keeps only non-overlapping same-class boxes", () => {
        const detections: Detection[] = [
            { box: [0, 0, 4, 4], score: 0.95, classId: 0 },
            { box: [0.2, 0.2, 4.1, 4.2], score: 0.88, classId: 0 },
            { box: [6, 6, 9, 9], score: 0.72, classId: 0 },
            { box: [0, 0, 4, 4], score: 0.80, classId: 1 },
        ];
        const result = nms(detections, 0.4);
        expect(result.kept).toEqual([0, 3, 2]);
        expect(result.suppressed).toEqual([1]);
        for (const a of result.kept) {
            for (const b of result.kept) {
                if (a === b || detections[a]!.classId !== detections[b]!.classId) continue;
                expect(iou(detections[a]!.box, detections[b]!.box)).toBeLessThanOrEqual(0.4);
            }
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
