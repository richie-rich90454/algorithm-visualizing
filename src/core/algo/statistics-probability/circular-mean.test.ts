/**
 * circular-mean.test.ts - Independent vector-average computation, wrap-around
 * handling, rotation equivariance, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./circular-mean";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeTypeOf("object");
    });
}

function reference(angles: number[]): { meanAngle: number; resultantLength: number } {
    const c = angles.reduce((s, a) => s + Math.cos(a), 0) / angles.length;
    const s = angles.reduce((acc, a) => acc + Math.sin(a), 0) / angles.length;
    let mean = Math.atan2(s, c);
    while (mean < 0) {
        mean += 2 * Math.PI;
    }
    return { meanAngle: mean, resultantLength: Math.sqrt(c * c + s * s) };
}

describe("CircularMean", () => {
    it("matches an independent vector-average computation", () => {
        const angles = [0.2, 0.9, 1.4, 0.6, 1.1];
        const frames = [...mod.run({ angles })];
        checkFrames(frames, angles.length);
        const expected = reference(angles);
        const final = frames[frames.length - 1];
        expect(Number(final.meta["meanAngle"])).toBeCloseTo(expected.meanAngle, 12);
        expect(Number(final.meta["resultantLength"])).toBeCloseTo(expected.resultantLength, 12);
    });

    it("handles the wrap around between zero and two pi", () => {
        const final = [...mod.run({ angles: [0.1, 6.2, 6.0] })].at(-1);
        const expected = reference([0.1, 6.2, 6.0]);
        expect(Number(final?.meta["meanAngle"])).toBeCloseTo(expected.meanAngle, 10);
        expect(Number(final?.meta["resultantLength"])).toBeGreaterThan(0.9);
    });

    it("cancels antipodal angles and rotates equivariantly", () => {
        const opposite = [...mod.run({ angles: [0, Math.PI] })].at(-1);
        expect(Number(opposite?.meta["resultantLength"])).toBeCloseTo(0, 10);
        const base = [0.1, 0.3, 0.5];
        const shift = 0.8;
        const m1 = Number([...mod.run({ angles: base })].at(-1)?.meta["meanAngle"]);
        const m2 = Number([...mod.run({ angles: base.map((a) => a + shift) })].at(-1)?.meta["meanAngle"]);
        expect(m2).toBeCloseTo(m1 + shift, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
