/**
 * bootstrap-resampling.test.ts - Resample-mean property, interval and bound
 * checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bootstrap-resampling";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], b: number): void {
    expect(frames.length).toBe(b + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
    expect(frames[0]?.entities.length).toBe(0);
    for (let i = 1; i <= b; i += 1) {
        expect(frames[i]?.entities.length).toBe(i);
    }
}

describe("bootstrap resampling", () => {
    it("recomputes every resample mean from the recorded indices", () => {
        const frames = [...mod.run({ data: [2, 4, 4, 4, 5, 5, 7, 9], resamples: 50, seed: 3, alpha: 0.05 })];
        checkFrames(frames, 50);
        const meta = frames[frames.length - 1]?.meta;
        const data = meta?.["data"] as number[];
        const means = meta?.["means"] as number[];
        const indices = meta?.["resampleIndicesFlat"] as number[];
        const sampleSize = Number(meta?.["sampleSize"]);
        expect(indices.length).toBe(50 * sampleSize);
        for (let r = 0; r < 50; r += 1) {
            let total = 0;
            for (let j = 0; j < sampleSize; j += 1) {
                const index = indices[r * sampleSize + j]!;
                expect(index).toBeGreaterThanOrEqual(0);
                expect(index).toBeLessThan(data.length);
                total += data[index]!;
            }
            expect(means[r]).toBeCloseTo(total / sampleSize, 12);
        }
    });

    it("keeps means inside the data range and reports sorted quantiles", () => {
        const data = [2, 4, 4, 4, 5, 5, 7, 9];
        const frames = [...mod.run({ data, resamples: 200, seed: 42, alpha: 0.05 })];
        checkFrames(frames, 200);
        const meta = frames[frames.length - 1]?.meta;
        const means = meta?.["means"] as number[];
        for (const mean of means) {
            expect(mean).toBeGreaterThanOrEqual(Math.min(...data));
            expect(mean).toBeLessThanOrEqual(Math.max(...data));
        }
        const sorted = [...means].sort((a, b) => a - b);
        const lower = Math.floor((0.05 / 2) * sorted.length);
        const upper = Math.ceil((1 - 0.05 / 2) * sorted.length) - 1;
        expect(Number(meta?.["ciLower"])).toBeCloseTo(sorted[lower]!, 12);
        expect(Number(meta?.["ciUpper"])).toBeCloseTo(sorted[upper]!, 12);
        expect(Number(meta?.["ciLower"])).toBeLessThanOrEqual(Number(meta?.["ciUpper"]));
    });

    it("is reproducible for a fixed seed", () => {
        const a = [...mod.run({ resamples: 20, seed: 8 })];
        const b = [...mod.run({ resamples: 20, seed: 8 })];
        expect(a[a.length - 1]?.meta["resampleIndicesFlat"]).toEqual(b[b.length - 1]?.meta["resampleIndicesFlat"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(202);
        expect(generator.next().done).toBe(true);
    });
});
