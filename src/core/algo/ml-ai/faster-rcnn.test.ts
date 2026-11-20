/** faster-rcnn.test.ts - Proposal ranking, brute-force RoI pooling, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { roiPool, topProposals } from "./faster-rcnn";
import type { VisualFrame } from "@/types";

type Box = [number, number, number, number];
type Proposal = { box: Box; score: number };

function bruteForcePool(featureMap: number[][], roi: Box, ph: number, pw: number): number[][] {
    const [x1, y1, x2, y2] = roi;
    const out: number[][] = [];
    for (let r = 0; r < ph; r += 1) {
        const row: number[] = [];
        for (let c = 0; c < pw; c += 1) {
            const left = Math.floor(x1 + ((x2 - x1) * c) / pw);
            const right = Math.ceil(x1 + ((x2 - x1) * (c + 1)) / pw);
            const top = Math.floor(y1 + ((y2 - y1) * r) / ph);
            const bottom = Math.ceil(y1 + ((y2 - y1) * (r + 1)) / ph);
            const values: number[] = [];
            for (let i = top; i < bottom; i += 1) {
                for (let j = left; j < right; j += 1) {
                    const v = featureMap[i]?.[j];
                    if (v !== undefined) values.push(v);
                }
            }
            row.push(values.length === 0 ? 0 : Math.max(...values));
        }
        out.push(row);
    }
    return out;
}

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

describe("Faster R-CNN", () => {
    it("ranks proposals by score with stable ties", () => {
        const proposals: Proposal[] = [
            { box: [0, 0, 1, 1], score: 0.5 },
            { box: [0, 0, 2, 2], score: 0.9 },
            { box: [0, 0, 3, 3], score: 0.9 },
        ];
        expect(topProposals(proposals, 2).map((p) => p.score)).toEqual([0.9, 0.9]);
        expect(topProposals(proposals, 10).length).toBe(3);
    });

    it("RoI pooling matches an independent brute-force implementation", () => {
        const featureMap = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]];
        const roi: Box = [0.5, 0.5, 3.5, 3.5];
        expect(roiPool(featureMap, roi, 2, 2)).toEqual(bruteForcePool(featureMap, roi, 2, 2));
        expect(roiPool(featureMap, [0, 0, 4, 4], 1, 1)).toEqual([[16]]);
        expect(roiPool(featureMap, [0, 0, 2, 2], 2, 2)).toEqual(bruteForcePool(featureMap, [0, 0, 2, 2], 2, 2));
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
