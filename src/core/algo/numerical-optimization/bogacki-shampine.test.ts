/**
 * bogacki-shampine.test.ts - Exact-solution cross-check, step-halving order
 * check, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bogacki-shampine";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Bogacki-Shampine 3(2)", () => {
    it("matches the closed-form exponential solution", () => {
        for (const lambda of [1, -1, 0.5]) {
            const T = 1;
            const steps = 200;
            const h = T / steps;
            const frames = [...mod.run({ lambda, y0: 1, h, steps })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!.meta;
            expect(Math.abs(Number(last["y"]) - Math.exp(lambda))).toBeLessThan(1e-6);
            expect(Number(last["globalError"])).toBeLessThan(1e-6);
        }
    });

    it("reduces error roughly cubically when the step is halved", () => {
        const runAt = (h: number): number => {
            const steps = Math.round(1 / h);
            const frames = [...mod.run({ lambda: 1, y0: 1, h, steps })];
            checkFrames(frames);
            return Number(frames[frames.length - 1]!.meta["globalError"]);
        };
        const coarse = runAt(0.1);
        const fine = runAt(0.05);
        expect(fine).toBeLessThan(coarse);
        expect(coarse / Math.max(fine, 1e-16)).toBeGreaterThan(4);
    });

    it("reports a nonnegative embedded error estimate on every step", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        for (const frame of frames) {
            expect(Number(frame.meta["localError"])).toBeGreaterThanOrEqual(0);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
