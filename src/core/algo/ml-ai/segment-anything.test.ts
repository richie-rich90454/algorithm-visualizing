/**
 * segment-anything.test.ts - Mask scoring correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./segment-anything";
import type { VisualFrame } from "@/types";

function referenceIoU(mask: number[], reference: number[]): number {
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

function checkFrames(frames: VisualFrame[], candidates: number, cells: number): void {
    expect(frames.length).toBe(candidates + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(candidates * cells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("SegmentAnything", () => {
    it("selects the same candidate as brute-force scoring", () => {
        const input = mod.defaultInput as {
            masks: number[][];
            predictedIoU: number[];
            reference: number[];
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.masks.length, 9);
        const ious = input.masks.map((mask) => referenceIoU(mask, input.reference));
        const scores = ious.map((value, i) => value * (input.predictedIoU[i] ?? 0));
        let winner = 0;
        for (let i = 1; i < scores.length; i += 1) {
            if ((scores[i] ?? 0) > (scores[winner] ?? 0)) {
                winner = i;
            }
        }
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["winner"]).toBe(winner);
        (meta?.["ious"] as string[]).map(Number).forEach((value, i) => {
            expect(value).toBeCloseTo(ious[i] ?? 0, 2);
        });
        (meta?.["scores"] as string[]).map(Number).forEach((value, i) => {
            expect(value).toBeCloseTo(scores[i] ?? 0, 2);
        });
        scores.forEach((score) => {
            expect(Number((meta?.["scores"] as string[])[winner])).toBeGreaterThanOrEqual(score - 1e-3);
        });
    });

    it("keeps overlap in the unit interval and handles an empty reference", () => {
        const input = {
            masks: [
                [0, 0, 0, 0],
                [1, 1, 0, 0],
            ],
            predictedIoU: [0.5, 0.9],
            reference: [0, 0, 0, 0],
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, 2, 4);
        const ious = (frames[frames.length - 1]?.meta["ious"] as string[]).map(Number);
        expect(ious).toEqual([0, 0]);
        expect(ious.every((value) => value >= 0 && value <= 1)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
