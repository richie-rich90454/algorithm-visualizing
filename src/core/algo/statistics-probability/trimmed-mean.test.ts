/** trimmed-mean.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./trimmed-mean";
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

/** Independent reference: sort, drop both tails, average the middle. */
function reference(values: number[], proportion: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const k = Math.floor(proportion * sorted.length);
    const kept = sorted.slice(k, sorted.length - k);
    return kept.reduce((a, b) => a + b, 0) / kept.length;
}

describe("Trimmed Mean", () => {
    it("matches the sort-and-slice reference on several inputs", () => {
        const cases: Array<{ values: number[]; proportion: number }> = [
            { values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 100], proportion: 0.1 },
            { values: [5, 1, 9, 3, 7], proportion: 0.2 },
            { values: [2, 4, 6, 8], proportion: 0.25 },
            { values: [1, 2, 3, 4, 5], proportion: 0 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["valid"]).toBe(true);
            expect(Number(finalMeta?.["result"])).toBeCloseTo(reference(testCase.values, testCase.proportion), 9);
        }
    });

    it("keeps k below half so at least one value survives", () => {
        const frames = [...mod.run({ values: [1, 2, 3, 4], proportion: 0.49 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["valid"]).toBe(true);
    });

    it("recovers the ordinary mean when nothing is trimmed", () => {
        const values = [1, 2, 3, 4, 5];
        const frames = [...mod.run({ values, proportion: 0 })];
        expect(Number(frames[frames.length - 1]?.meta["result"])).toBeCloseTo(3, 9);
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
