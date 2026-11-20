/**
 * poisson-distribution-pmf.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./poisson-distribution-pmf";
import type { VisualFrame } from "@/types";

/** Independent reference using the direct factorial formula. */
function reference(lambda: number, maxK: number): number[] {
    const result: number[] = [];
    let factorial = 1;
    for (let k = 0; k <= maxK; k += 1) {
        if (k > 0) factorial *= k;
        result.push((Math.exp(-lambda) * lambda ** k) / factorial);
    }
    return result;
}

function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Poisson Distribution PMF", () => {
    it("matches the direct factorial formula on several inputs", () => {
        for (const { lambda, maxK } of [
            { lambda: 4, maxK: 12 },
            { lambda: 0.5, maxK: 8 },
            { lambda: 7.25, maxK: 20 },
        ]) {
            const frames = [...mod.run({ lambda, maxK })];
            checkFrames(frames, maxK + 1);
            const pmf = frames[frames.length - 1]?.meta["pmf"] as number[];
            const expected = reference(lambda, maxK);
            expect(pmf.length).toBe(expected.length);
            for (let k = 0; k < expected.length; k += 1) {
                expect(pmf[k]).toBeCloseTo(expected[k] as number, 10);
            }
            const sum = expected.reduce((a, b) => a + b, 0);
            // The truncated mass approaches one; the tail beyond maxK is the only gap.
            expect(sum).toBeGreaterThan(0.9);
            expect(sum).toBeLessThanOrEqual(1 + 1e-9);
        }
    });

    it("reports mean and variance equal to lambda", () => {
        const frames = [...mod.run({ lambda: 6, maxK: 30 })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["mean"]).toBe(6);
        expect(meta?.["variance"]).toBe(6);
        const sum = meta?.["sum"] as number;
        expect(sum).toBeCloseTo(1, 4);
    });

    it("handles lambda zero", () => {
        const frames = [...mod.run({ lambda: 0, maxK: 3 })];
        const pmf = frames[frames.length - 1]?.meta["pmf"] as number[];
        expect(pmf[0]).toBeCloseTo(1, 12);
        expect(pmf[1]).toBeCloseTo(0, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
