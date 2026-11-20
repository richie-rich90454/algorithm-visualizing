/**
 * f-distribution.test.ts - Known values, normalization, and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./f-distribution";
import type { VisualFrame } from "@/types";

/** Check that a frame sequence is well formed and terminates. */
function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Read the density at a chosen x from a two-sample grid. */
function densityAt(d1: number, d2: number, x: number): number {
    const frames = [...mod.run({ d1, d2, minX: x, maxX: x + 1, samples: 2 })];
    const curve = frames[0]?.meta["curve"] as number[][] | undefined;
    expect(curve).toBeDefined();
    return curve?.[0]?.[1] ?? Number.NaN;
}

describe("F Distribution Density", () => {
    it("matches closed-form densities for known degree pairs", () => {
        expect(densityAt(1, 1, 1)).toBeCloseTo(1 / (2 * Math.PI), 6);
        expect(densityAt(2, 2, 1)).toBeCloseTo(0.25, 6);
        expect(densityAt(2, 4, 2)).toBeCloseTo(0.125, 6);
    });

    it("integrates to approximately one over a wide grid (property check)", () => {
        const frames = [...mod.run({ d1: 2, d2: 4, minX: 0.001, maxX: 80, samples: 400 })];
        checkFrames(frames, 400);
        const curve = frames[frames.length - 1]?.meta["curve"] as number[][] | undefined;
        expect(curve).toBeDefined();
        let integral = 0;
        const arr = curve ?? [];
        for (let i = 1; i < arr.length; i += 1) {
            const prev = arr[i - 1] ?? [0, 0];
            const cur = arr[i] ?? [0, 0];
            const dx = (cur[0] ?? 0) - (prev[0] ?? 0);
            integral += ((prev[1] ?? 0) + (cur[1] ?? 0)) * 0.5 * dx;
        }
        expect(integral).toBeGreaterThan(0.9);
        expect(integral).toBeLessThan(1.02);
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
