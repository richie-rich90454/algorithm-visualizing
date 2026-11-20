/**
 * fisher-method.test.ts - Independent statistic computation, monotonicity,
 * p equals one contribution, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./fisher-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], k: number): void {
    expect(frames.length).toBe(k + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(k);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeTypeOf("object");
    });
}

function reference(pValues: number[]): number {
    return pValues.reduce((sum, p) => sum + -2 * Math.log(p), 0);
}

describe("FisherMethod", () => {
    it("matches an independent log-sum computation", () => {
        const pValues = [0.02, 0.15, 0.004, 0.5, 0.87];
        const frames = [...mod.run({ pValues })];
        checkFrames(frames, pValues.length);
        const final = frames[frames.length - 1];
        expect(Number(final.meta["statistic"])).toBeCloseTo(reference(pValues), 12);
        expect(Number(final.meta["df"])).toBe(10);
    });

    it("a p value of one adds nothing and smaller p adds more", () => {
        const base = [0.3, 0.2];
        const s1 = Number([...mod.run({ pValues: base })].at(-1)?.meta["statistic"]);
        const s2 = Number([...mod.run({ pValues: [...base, 1] })].at(-1)?.meta["statistic"]);
        expect(s2).toBeCloseTo(s1, 12);
        const s3 = Number([...mod.run({ pValues: [...base, 0.01] })].at(-1)?.meta["statistic"]);
        expect(s3).toBeGreaterThan(s1);
    });

    it("handles an empty list", () => {
        const frames = [...mod.run({ pValues: [] })];
        checkFrames(frames, 0);
        expect(Number(frames[frames.length - 1].meta["statistic"])).toBe(0);
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
