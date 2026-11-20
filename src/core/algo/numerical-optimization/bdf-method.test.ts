/**
 * bdf-method.test.ts - BDF2 correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./bdf-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("BDF2 Method", () => {
    it("approximates the exact exponential solution", () => {
        const lambda = -1;
        const h = 0.1;
        const steps = 20;
        const frames = [...mod.run({ lambda, h, steps, y0: 1 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const exact = Math.exp(lambda * steps * h);
        expect(Number(final?.["y"])).toBeCloseTo(exact, 3);
        expect(Number(final?.["error"])).toBeLessThan(1e-2);
    });

    it("second-order error shrinks about fourfold when the step halves", () => {
        const lambda = -1;
        const t = 2;
        const coarse = [...mod.run({ lambda, h: 0.2, steps: 10, y0: 1 })];
        const fine = [...mod.run({ lambda, h: 0.1, steps: 20, y0: 1 })];
        const eCoarse = Number(coarse[coarse.length - 1]?.meta["error"]);
        const eFine = Number(fine[fine.length - 1]?.meta["error"]);
        expect(eFine).toBeLessThan(eCoarse);
        expect(eCoarse / eFine).toBeGreaterThan(2.5);
        expect(Math.exp(lambda * t)).toBeCloseTo(Number(fine[fine.length - 1]?.meta["exact"]), 12);
    });

    it("handles a positive growth rate without overflow", () => {
        const frames = [...mod.run({ lambda: 0.5, h: 0.025, steps: 20, y0: 2 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(Number.isFinite(Number(final?.["y"]))).toBe(true);
        expect(Number(final?.["y"])).toBeCloseTo(2 * Math.exp(0.5 * 20 * 0.025), 3);
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
