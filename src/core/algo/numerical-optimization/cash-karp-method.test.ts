/**
 * cash-karp-method.test.ts - Exact-solution cross-check, order check, frame
 * shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cash-karp-method";
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

function errorAt(h: number): number {
    const steps = Math.round(1 / h);
    const frames = [...mod.run({ lambda: 1, y0: 1, h, steps })];
    checkFrames(frames);
    return Number(frames[frames.length - 1]!.meta["globalError"]);
}

describe("Cash-Karp 5(4)", () => {
    it("matches the closed-form exponential solution", () => {
        for (const lambda of [1, -1, 0.5]) {
            const frames = [...mod.run({ lambda, y0: 1, h: 0.005, steps: 200 })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!.meta;
            expect(Math.abs(Number(last["y"]) - Math.exp(lambda))).toBeLessThan(1e-10);
            expect(Number(last["globalError"])).toBeLessThan(1e-10);
        }
    });

    it("reduces error at roughly fifth order when the step is halved", () => {
        const coarse = errorAt(0.1);
        const fine = errorAt(0.05);
        expect(fine).toBeLessThan(coarse);
        expect(coarse / Math.max(fine, 1e-16)).toBeGreaterThan(16);
    });

    it("reports nonnegative embedded error on every frame", () => {
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
