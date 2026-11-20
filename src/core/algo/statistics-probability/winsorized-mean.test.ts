/** winsorized-mean.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./winsorized-mean";
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

/** Independent reference: clamp both tails, then average all n values. */
function reference(values: number[], proportion: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const k = Math.floor(proportion * n);
    const low = sorted[k] ?? 0;
    const high = sorted[n - k - 1] ?? 0;
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
        sum += i < k ? low : i >= n - k ? high : (sorted[i] ?? 0);
    }
    return sum / n;
}

describe("Winsorized Mean", () => {
    it("matches the clamp-and-average reference on several inputs", () => {
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

    it("preserves the sample size in its metadata", () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
        const frames = [...mod.run({ values, proportion: 0.1 })];
        expect(frames[frames.length - 1]?.meta["n"]).toBe(values.length);
        expect(frames[frames.length - 1]?.meta["low"]).toBe(2);
        expect(frames[frames.length - 1]?.meta["high"]).toBe(9);
    });

    it("is no more extreme than the trimmed mean for the same k", () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
        const winsorized = [...mod.run({ values, proportion: 0.1 })];
        const winsorizedResult = Number(winsorized[winsorized.length - 1]?.meta["result"]);
        const kept = [...values].sort((a, b) => a - b).slice(1, 9);
        const trimmedResult = kept.reduce((a, b) => a + b, 0) / kept.length;
        expect(winsorizedResult).toBeLessThanOrEqual(trimmedResult);
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
