/** mask-rcnn.test.ts - Bilinear interpolation, RoIAlign, mask argmax, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { bilinearSample, maskArgmax, roiAlign } from "./mask-rcnn";
import type { VisualFrame } from "@/types";

type Box = [number, number, number, number];

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

describe("Mask R-CNN", () => {
    it("bilinear sampling is exact at integer coordinates and linear between them", () => {
        const map = [[1, 2], [3, 4]];
        expect(bilinearSample(map, 0, 0)).toBeCloseTo(1, 12);
        expect(bilinearSample(map, 1, 1)).toBeCloseTo(4, 12);
        expect(bilinearSample(map, 0, 0.5)).toBeCloseTo(1.5, 12);
        expect(bilinearSample(map, 0.5, 0.5)).toBeCloseTo(2.5, 12);
    });

    it("RoIAlign matches a brute-force sample average", () => {
        const map = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]];
        const roi: Box = [0, 0, 4, 4];
        const { aligned, samples } = roiAlign(map, roi, 2, 2, 2);
        aligned.forEach((row, r) => row.forEach((v, c) => {
            const brute = samples[r]![c]!.reduce((a, b) => a + b, 0) / samples[r]![c]!.length;
            expect(v).toBeCloseTo(brute, 12);
        }));
        const single = roiAlign(map, [0, 0, 4, 4], 1, 1, 1);
        expect(single.aligned[0]![0]).toBeCloseTo(bilinearSample(map, 2, 2), 12);
    });

    it("mask argmax picks the highest logit per cell", () => {
        const logits = [
            [[0.1, 2.0], [1.0, 0.2]],
            [[0.9, 0.5], [0.3, 3.0]],
        ];
        expect(maskArgmax(logits).mask).toEqual([[1, 0], [0, 1]]);
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
