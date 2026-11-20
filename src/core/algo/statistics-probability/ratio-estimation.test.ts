/**
 * ratio-estimation.test.ts - Independent ratio/variance reference, exact-fit
 * property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./ratio-estimation";
import type { VisualFrame } from "@/types";

type Pair = [number, number];

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function reference(pairs: Pair[], populationX: number, f: number) {
    const sx = pairs.reduce((a, p) => a + p[0], 0);
    const sy = pairs.reduce((a, p) => a + p[1], 0);
    const r = sy / sx;
    const res = pairs.map((p) => p[1] - r * p[0]);
    const m = res.reduce((a, b) => a + b, 0) / res.length;
    const ss = res.reduce((acc, v) => acc + (v - m) ** 2, 0) / (res.length - 1);
    return { ratio: r, total: r * populationX, variance: ((1 - f) / res.length) * ss, residuals: res };
}

describe("RatioEstimation", () => {
    it("matches an independent ratio-estimator computation", () => {
        const input = mod.defaultInput as { pairs: Pair[]; populationX: number; finiteCorrection: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.pairs.length);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input.pairs, input.populationX, input.finiteCorrection);
        expect(meta["ratio"]).toBeCloseTo(expected.ratio, 10);
        expect(meta["total"]).toBeCloseTo(expected.total, 10);
        expect(meta["variance"]).toBeCloseTo(expected.variance, 10);
        expect(meta["residuals"]).toEqual(expected.residuals);
    });

    it("is exact when y is proportional to x", () => {
        const pairs: Pair[] = [[1, 3], [2, 6], [4, 12], [5, 15]];
        const meta = [...mod.run({ pairs, populationX: 100, finiteCorrection: 0 })].pop()!.meta;
        expect(meta["ratio"]).toBeCloseTo(3, 10);
        expect(meta["total"]).toBeCloseTo(300, 10);
        expect(meta["variance"]).toBeCloseTo(0, 10);
    });

    it("has residuals summing to zero and shrinks variance with finite correction", () => {
        const pairs: Pair[] = [[2, 5], [3, 7], [4, 11]];
        const meta = [...mod.run({ pairs, populationX: 50, finiteCorrection: 0 })].pop()!.meta;
        const residuals = meta["residuals"] as number[];
        expect(residuals.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 10);
        const uncorrected = meta["variance"] as number;
        const corrected = [...mod.run({ pairs, populationX: 50, finiteCorrection: 0.5 })].pop()!.meta["variance"] as number;
        expect(corrected).toBeCloseTo(uncorrected / 2, 10);
    });

    it("handles empty input and terminates cleanly", () => {
        const empty = [...mod.run({ pairs: [] })];
        expect(empty).toHaveLength(1);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe((mod.defaultInput as { pairs: Pair[] }).pairs.length + 2);
        expect(generator.next().done).toBe(true);
    });
});
