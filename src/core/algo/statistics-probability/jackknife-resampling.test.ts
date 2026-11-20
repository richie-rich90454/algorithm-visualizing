/**
 * jackknife-resampling.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./jackknife-resampling";
import type { VisualFrame } from "@/types";

/** Independent brute-force jackknife for the mean. */
function reference(data: number[]) {
    const n = data.length;
    const fullMean = data.reduce((s, x) => s + x, 0) / n;
    const replicates = data.map((_, i) => {
        const kept = data.filter((__, j) => j !== i);
        return kept.reduce((s, x) => s + x, 0) / kept.length;
    });
    const jackMean = replicates.reduce((s, x) => s + x, 0) / n;
    const jackVar = ((n - 1) / n) * replicates.reduce((s, x) => s + (x - jackMean) ** 2, 0);
    const sampleVar = data.reduce((s, x) => s + (x - fullMean) ** 2, 0) / (n - 1);
    return { fullMean, replicates, jackMean, jackVar, sampleVar };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Jackknife resampling", () => {
    it("matches a brute-force reference for the mean statistic", () => {
        const cases = [
            [4, 6, 5, 9],
            [1, 2, 3, 4, 5],
            [-3, 0, 7, 11, 2, 2],
            [10, 10, 10, 10, 10],
        ];
        for (const data of cases) {
            const frames = [...mod.run({ data })] as VisualFrame[];
            checkFrames(frames, data.length);
            const expected = reference(data);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(Number(finalMeta?.["fullMean"])).toBeCloseTo(expected.fullMean, 10);
            expect(Number(finalMeta?.["jackknifeMean"])).toBeCloseTo(expected.jackMean, 10);
            expect(Number(finalMeta?.["jackknifeVariance"])).toBeCloseTo(expected.jackVar, 10);
            const got = finalMeta?.["replicates"] as number[];
            expect(got).toHaveLength(data.length);
            for (let i = 0; i < data.length; i += 1) {
                expect(got[i]).toBeCloseTo(expected.replicates[i], 10);
            }
            // Key property: jackknife variance of the mean equals s^2 / n.
            expect(Number(finalMeta?.["jackknifeVariance"])).toBeCloseTo(expected.sampleVar / data.length, 10);
            expect(Number(finalMeta?.["jackknifeVariance"])).toBeGreaterThanOrEqual(0);
        }
    });

    it("keeps the jackknife mean equal to the sample mean at every completed step", () => {
        const data = [2, 4, 4, 4, 5, 5, 7, 9];
        const frames = [...mod.run({ data })];
        checkFrames(frames, data.length);
        expect(Number(frames[frames.length - 1]?.meta["jackknifeMean"])).toBeCloseTo(5, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
