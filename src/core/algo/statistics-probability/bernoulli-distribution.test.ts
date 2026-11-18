/**
 * bernoulli-distribution.test.ts - Closed-form identities, edge cases, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bernoulli-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent binomial-with-n-equals-one computation of the PMF. */
function referencePmf(p: number): number[] {
    const choose = [1, 1];
    return [0, 1].map((k) => choose[k]! * p ** k * (1 - p) ** (1 - k));
}

describe("BernoulliDistribution", () => {
    it("matches an independent binomial computation and the closed forms", () => {
        for (const p of [0.5, 0.3, 0.75, 0.1, 0.9]) {
            const t = 0.7;
            const frames = [...mod.run({ p, t })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const pmf = meta?.["pmf"] as number[];
            const expected = referencePmf(p);
            expect(pmf[0]).toBeCloseTo(expected[0]!, 12);
            expect(pmf[1]).toBeCloseTo(expected[1]!, 12);
            expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
            expect(Number(meta?.["mean"])).toBeCloseTo(p, 12);
            expect(Number(meta?.["variance"])).toBeCloseTo(p * (1 - p), 12);
            expect(Number(meta?.["mgf"])).toBeCloseTo((1 - p) + p * Math.exp(t), 12);
            const expectedEntropy =
                -(p === 0 ? 0 : p * Math.log(p)) - ((1 - p) === 0 ? 0 : (1 - p) * Math.log(1 - p));
            expect(Number(meta?.["entropy"])).toBeCloseTo(expectedEntropy / Math.LN2, 12);
        }
    });

    it("handles the certain and impossible boundaries", () => {
        const certain = [...mod.run({ p: 1, t: 2 })];
        checkFrames(certain);
        const cm = certain[certain.length - 1]?.meta;
        expect(cm?.["pmf"]).toEqual([0, 1]);
        expect(Number(cm?.["variance"])).toBeCloseTo(0, 12);
        expect(Number(cm?.["entropy"])).toBeCloseTo(0, 12);
        expect(Number(cm?.["mgf"])).toBeCloseTo(Math.exp(2), 12);

        const impossible = [...mod.run({ p: 0, t: 2 })];
        checkFrames(impossible);
        const im = impossible[impossible.length - 1]?.meta;
        expect(im?.["pmf"]).toEqual([1, 0]);
        expect(Number(im?.["mean"])).toBeCloseTo(0, 12);

        const fair = [...mod.run({ p: 0.5 })];
        checkFrames(fair);
        expect(Number(fair[fair.length - 1]?.meta["entropy"])).toBeCloseTo(1, 12);
    });

    it("clamps out-of-range probabilities", () => {
        const high = [...mod.run({ p: 5 })];
        expect(high[high.length - 1]?.meta["pmf"]).toEqual([0, 1]);
        const low = [...mod.run({ p: -2 })];
        expect(low[low.length - 1]?.meta["pmf"]).toEqual([1, 0]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
