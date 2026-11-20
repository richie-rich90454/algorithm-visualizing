/** interquartile-range.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./interquartile-range";
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

/** Independent reference using the median-of-halves convention. */
function reference(values: number[]): { q1: number; q3: number; iqr: number } {
    const sorted = [...values].sort((a, b) => a - b);
    const half = Math.floor(sorted.length / 2);
    const q1 = median(sorted.slice(0, half));
    const q3 = median(sorted.slice(sorted.length - half));
    return { q1, q3, iqr: q3 - q1 };
}

describe("Interquartile Range", () => {
    it("matches the brute-force quartile reference on several inputs", () => {
        const cases = [
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            [5, 1, 9, 3, 7],
            [10, 20, 30, 40, 50, 60, 70],
            [2, 2, 2, 2],
        ];
        for (const values of cases) {
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const finalMeta = frames[frames.length - 1]?.meta;
            const expected = reference(values);
            expect(finalMeta?.["valid"]).toBe(true);
            expect(Number(finalMeta?.["q1"])).toBeCloseTo(expected.q1, 9);
            expect(Number(finalMeta?.["q3"])).toBeCloseTo(expected.q3, 9);
            expect(Number(finalMeta?.["result"])).toBeCloseTo(expected.iqr, 9);
        }
    });

    it("flags an outlier beyond the 1.5 IQR fence", () => {
        const values = [10, 11, 12, 12, 13, 14, 15, 100];
        const frames = [...mod.run({ values })];
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["upperFence"])).toBeLessThan(100);
        const outlier = frames[frames.length - 1]?.entities.find((entity) => entity.label === "100");
        expect(outlier?.state).toBe("error");
    });

    it("guards inputs with fewer than two values", () => {
        const frames = [...mod.run({ values: [7] })];
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
