/**
 * runge-kutta-4.test.ts - Analytic solution cross-check, convergence order, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./runge-kutta-4";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBe(steps + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    expect(frames[0]!.entities.length).toBe(1);
    expect(frames[frames.length - 1]!.entities.length).toBe(steps + 1);
    expect(frames[frames.length - 1]!.entities.every((e) => e.type === "bar")).toBe(true);
}

function finalValue(lambda: number, y0: number, tEnd: number, steps: number): number {
    const frames = [...mod.run({ lambda, y0, tEnd, steps })];
    return Number(frames[frames.length - 1]!.meta["y"]);
}

describe("Runge-Kutta 4", () => {
    it("matches the exact exponential solution on random parameters", () => {
        const cases: Array<[number, number, number]> = [
            [-1, 1, 2],
            [-2.5, 3, 1.5],
            [-0.5, 2, 4],
            [0.4, 1, 1],
        ];
        for (const [lambda, y0, tEnd] of cases) {
            const steps = 16;
            const frames = [...mod.run({ lambda, y0, tEnd, steps })];
            checkFrames(frames, steps);
            const finalMeta = frames[frames.length - 1]!.meta;
            const exact = y0 * Math.exp(lambda * tEnd);
            expect(Number(finalMeta["exact"])).toBeCloseTo(exact, 10);
            expect(Number(finalMeta["y"])).toBeCloseTo(exact, 4);
            expect(Number(finalMeta["t"])).toBeCloseTo(tEnd, 10);
            expect(Number(finalMeta["error"])).toBeLessThan(1e-4);
        }
    });

    it("shows fourth-order convergence when the step size halves", () => {
        const lambda = -1;
        const y0 = 1;
        const tEnd = 2;
        const exact = y0 * Math.exp(lambda * tEnd);
        const coarse = Math.abs(finalValue(lambda, y0, tEnd, 4) - exact);
        const fine = Math.abs(finalValue(lambda, y0, tEnd, 8) - exact);
        const finer = Math.abs(finalValue(lambda, y0, tEnd, 16) - exact);
        expect(coarse).toBeGreaterThan(fine);
        expect(fine).toBeGreaterThan(finer);
        expect(coarse / fine).toBeGreaterThan(8);
        expect(fine / finer).toBeGreaterThan(8);
        expect(coarse / fine).toBeLessThan(40);
        expect(fine / finer).toBeLessThan(40);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
