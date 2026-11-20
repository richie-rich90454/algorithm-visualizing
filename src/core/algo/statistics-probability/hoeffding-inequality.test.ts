/**
 * hoeffding-inequality.test.ts - Formula check, monotonicity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hoeffding-inequality";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], grid: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(grid);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("HoeffdingInequality", () => {
    it("matches the closed-form bound at several deviations", () => {
        const input = mod.defaultInput as { n: number; lower: number; upper: number; grid: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.grid.length);
        for (let i = 0; i < input.grid.length; i += 1) {
            const t = input.grid[i] ?? 0;
            const expected = Math.min(1, 2 * Math.exp((-2 * input.n * t * t) / 1));
            expect(Number(frames[i + 1]?.meta["bound"])).toBeCloseTo(expected, 12);
        }
        const final = frames[frames.length - 1]?.meta;
        const deviation = 0.1;
        const exponent = (-2 * input.n * deviation * deviation) / 1;
        expect(Number(final?.["oneSidedBound"])).toBeCloseTo(Math.exp(exponent), 12);
        expect(Number(final?.["observedBound"])).toBeCloseTo(2 * Math.exp(exponent), 12);
    });

    it("is monotone decreasing in deviation and in sample size", () => {
        const grid = [0, 0.1, 0.2, 0.4];
        const small = [...mod.run({ n: 10, lower: 0, upper: 1, grid })].slice(1, grid.length + 1);
        const boundsSmall = small.map((f) => Number(f.meta["bound"]));
        for (let i = 1; i < boundsSmall.length; i += 1) {
            expect(boundsSmall[i]).toBeLessThanOrEqual(boundsSmall[i - 1]);
        }
        const large = [...mod.run({ n: 1000, lower: 0, upper: 1, grid })].slice(1, grid.length + 1);
        const boundsLarge = large.map((f) => Number(f.meta["bound"]));
        for (let i = 0; i < grid.length; i += 1) {
            expect(boundsLarge[i]).toBeLessThanOrEqual(boundsSmall[i]);
        }
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
