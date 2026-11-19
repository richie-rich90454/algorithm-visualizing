/** adams-moulton.test.ts - Exact linear solution, exponential reference, third-order check, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { adamsMoulton2 } from "./adams-moulton";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Two-step Adams-Moulton", () => {
    it("reproduces the exact linear solution for y' = 1", () => {
        for (const h of [0.1, 0.05, 0.2]) {
            for (const steps of [1, 2, 10, 30]) {
                const result = adamsMoulton2(() => 1, 0, h, steps);
                expect(result.t.length).toBe(steps + 1);
                for (let i = 0; i < result.t.length; i += 1) {
                    expect(result.t[i]).toBeCloseTo(i * h, 12);
                    expect(result.y[i] ?? 0).toBeCloseTo(i * h, 10);
                }
            }
        }
    });

    it("tracks the exponential solution and converges at third order", () => {
        const coarse = adamsMoulton2((_t, y) => y, 1, 0.1, 40);
        const fine = adamsMoulton2((_t, y) => y, 1, 0.05, 80);
        const coarseError = Math.abs((coarse.y[coarse.y.length - 1] ?? 0) - Math.exp(4));
        const fineError = Math.abs((fine.y[fine.y.length - 1] ?? 0) - Math.exp(4));
        expect(coarseError).toBeLessThan(0.2);
        expect(fineError).toBeLessThan(coarseError / 4);
    });

    it("handles zero steps", () => {
        const result = adamsMoulton2((_t, y) => y, 3, 0.1, 0);
        expect(result.t).toEqual([0]);
        expect(result.y).toEqual([3]);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        expect(frames.length).toBeGreaterThan(20);
        expect(generator.next().done).toBe(true);
    });
});
