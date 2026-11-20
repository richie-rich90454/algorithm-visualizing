/** tqc.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod, { tqcTruncate } from "./tqc";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Truncated Quantile Critics", () => {
    it("matches an independent sort, truncation, and mean", () => {
        const input = mod.defaultInput as { quantiles: number[][]; drop: number };
        const { quantiles, drop } = input;
        const result = tqcTruncate(quantiles, drop);
        const frames = [...mod.run(input)];
        const pooled = quantiles.flat();
        checkFrames(frames, pooled.length);

        const sorted = [...pooled].sort((a, b) => a - b);
        expect(result.sorted).toEqual(sorted);
        const expectedKept = sorted.slice(0, sorted.length - drop);
        expect(result.kept).toEqual(expectedKept);
        expect(result.dropped).toEqual(sorted.slice(sorted.length - drop));
        const expectedMean = expectedKept.reduce((a, b) => a + b, 0) / expectedKept.length;
        expect(result.target).toBeCloseTo(expectedMean, 10);
    });

    it("never increases the target as more quantiles are dropped", () => {
        const input = mod.defaultInput as { quantiles: number[][] };
        const targets = [0, 1, 2, 3, 4, 5].map((drop) => tqcTruncate(input.quantiles, drop).target);
        for (let i = 1; i < targets.length; i += 1) {
            expect(targets[i]).toBeLessThanOrEqual(targets[i - 1] + 1e-12);
        }
    });

    it("handles dropping everything without producing NaN", () => {
        const result = tqcTruncate([[1, 2, 3]], 10);
        expect(result.target).toBe(0);
        expect(result.kept.length).toBe(0);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
