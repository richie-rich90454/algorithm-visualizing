/**
 * circular-variance.test.ts - Independent resultant reference, extreme spread
 * cases, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./circular-variance";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n + 1);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.entities.some((e) => e.id === "resultant")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("CircularVariance", () => {
    it("matches an independent unit-vector average", () => {
        const input = mod.defaultInput as { angles: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.angles.length);
        const sumCos = input.angles.reduce((total, a) => total + Math.cos(a), 0);
        const sumSin = input.angles.reduce((total, a) => total + Math.sin(a), 0);
        const meanCos = sumCos / input.angles.length;
        const meanSin = sumSin / input.angles.length;
        const R = Math.sqrt(meanCos * meanCos + meanSin * meanSin);
        const meta = frames[frames.length - 1]!.meta;
        expect(Number(meta["meanCos"])).toBeCloseTo(meanCos, 12);
        expect(Number(meta["meanSin"])).toBeCloseTo(meanSin, 12);
        expect(Number(meta["resultantLength"])).toBeCloseTo(R, 12);
        expect(Number(meta["variance"])).toBeCloseTo(1 - R, 12);
        expect(Number(meta["meanAngle"])).toBeCloseTo(Math.atan2(meanSin, meanCos), 12);
        const resultant = frames[frames.length - 1]!.entities.find((e) => e.id === "resultant");
        expect(resultant?.x).toBeCloseTo(meanCos, 12);
        expect(resultant?.y).toBeCloseTo(meanSin, 12);
    });

    it("reports zero variance for identical angles and one for symmetric angles", () => {
        const identical = [...mod.run({ angles: [0.4, 0.4, 0.4, 0.4] })].at(-1)!.meta;
        expect(Number(identical["resultantLength"])).toBeCloseTo(1, 12);
        expect(Number(identical["variance"])).toBeCloseTo(0, 12);
        const symmetric = [...mod.run({ angles: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] })].at(-1)!.meta;
        expect(Number(symmetric["resultantLength"])).toBeCloseTo(0, 10);
        expect(Number(symmetric["variance"])).toBeCloseTo(1, 10);
    });

    it("keeps variance in the unit interval for random angles", () => {
        let state = 424242;
        for (let trial = 0; trial < 25; trial += 1) {
            const angles = Array.from({ length: 6 }, () => {
                state = (Math.imul(1664525, state) + 1013904223) >>> 0;
                return (state / 4294967296) * 2 * Math.PI;
            });
            const frames = [...mod.run({ angles })];
            checkFrames(frames, angles.length);
            const meta = frames[frames.length - 1]!.meta;
            const variance = Number(meta["variance"]);
            expect(variance).toBeGreaterThanOrEqual(-1e-12);
            expect(variance).toBeLessThanOrEqual(1 + 1e-12);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
