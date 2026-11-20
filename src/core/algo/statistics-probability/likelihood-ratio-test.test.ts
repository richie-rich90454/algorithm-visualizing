/**
 * likelihood-ratio-test.test.ts - Independent statistic computation,
 * nonnegative property, null-at-maximum case, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./likelihood-ratio-test";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], k: number): void {
    expect(frames.length).toBe(k + 3);
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

function reference(values: number[], nullIndex: number): number {
    if (values.length === 0) {
        return 0;
    }
    const best = Math.max(...values);
    return Math.max(0, 2 * (best - (values[nullIndex] ?? 0)));
}

describe("LikelihoodRatioTest", () => {
    it("matches an independent statistic computation", () => {
        const logLikelihoods = [-12.4, -9.1, -14.0, -7.3, -8.8, -11.5];
        const frames = [...mod.run({ logLikelihoods, nullIndex: 1, df: 2 })];
        checkFrames(frames, logLikelihoods.length);
        const final = frames[frames.length - 1];
        expect(Number(final.meta["statistic"])).toBeCloseTo(reference(logLikelihoods, 1), 12);
        expect(Number(final.meta["df"])).toBe(2);
    });

    it("reproduces the worked example", () => {
        const final = [...mod.run({ logLikelihoods: [-10.2, -8.4, -5.1, -6.7, -9.3], nullIndex: 0 })].at(-1);
        expect(Number(final?.meta["statistic"])).toBeCloseTo(10.2, 10);
    });

    it("is nonnegative and zero when the null is the best fit", () => {
        const values = [-8, -5, -9, -6];
        const s1 = Number([...mod.run({ logLikelihoods: values, nullIndex: 0 })].at(-1)?.meta["statistic"]);
        expect(s1).toBeGreaterThanOrEqual(0);
        const s2 = Number([...mod.run({ logLikelihoods: values, nullIndex: 1 })].at(-1)?.meta["statistic"]);
        expect(s2).toBeCloseTo(0, 12);
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
