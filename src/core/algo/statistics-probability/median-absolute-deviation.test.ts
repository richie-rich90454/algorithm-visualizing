/** median-absolute-deviation.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./median-absolute-deviation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
        ? (sorted[mid] ?? 0)
        : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Independent reference: median of distances from the median. */
function reference(values: number[]): number {
    const m = median(values);
    return median(values.map((v) => Math.abs(v - m)));
}

describe("Median Absolute Deviation", () => {
    it("matches the brute-force reference on several inputs", () => {
        const cases = [
            [1, 2, 2, 3, 4, 7, 9, 100],
            [1, 2, 3, 4, 5],
            [10, 10, 10, 10],
            [4, 1, 9, 2, 7, 3],
        ];
        for (const values of cases) {
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["valid"]).toBe(true);
            expect(Number(finalMeta?.["result"])).toBeCloseTo(reference(values), 9);
            expect(Number(finalMeta?.["median"])).toBeCloseTo(median(values), 9);
            expect(Number(finalMeta?.["scaledMad"])).toBeCloseTo(1.4826 * reference(values), 9);
        }
    });

    it("gives zero spread for a constant data set", () => {
        const frames = [...mod.run({ values: [5, 5, 5, 5] })];
        expect(Number(frames[frames.length - 1]?.meta["result"])).toBe(0);
    });

    it("guards the empty input", () => {
        const frames = [...mod.run({ values: [] })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["valid"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
