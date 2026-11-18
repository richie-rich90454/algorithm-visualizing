/**
 * explicit-euler-method.test.ts - Recurrence and convergence checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { explicitEuler } from "./explicit-euler-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], bars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(bars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Explicit Euler Method", () => {
    it("obeys the Euler recurrence and the closed-form comparison", () => {
        for (const [lambda, y0, h, steps] of [
            [-1, 1, 0.1, 10],
            [2, 0.5, 0.01, 20],
            [0, 3, 0.25, 8],
            [-3, 2, 0.05, 30],
        ]) {
            const data = explicitEuler(lambda, y0, h, steps);
            expect(data.trajectory.length).toBe(steps + 1);
            expect(data.trajectory[0]!.y).toBe(y0);
            for (let n = 0; n <= steps; n += 1) {
                const entry = data.trajectory[n]!;
                expect(entry.t).toBeCloseTo(n * h, 12);
                expect(entry.exact).toBeCloseTo(y0 * Math.exp(lambda * entry.t), 12);
                expect(entry.error).toBeCloseTo(Math.abs(entry.y - entry.exact), 12);
                if (n > 0) {
                    const previous = data.trajectory[n - 1]!.y;
                    expect(entry.y).toBeCloseTo(previous + h * lambda * previous, 12);
                }
            }
            if (lambda === 0) {
                expect(data.trajectory[steps]!.error).toBe(0);
            }
        }
    });

    it("converges at first order as the step size shrinks", () => {
        const errorAt = (h: number): number => {
            const steps = Math.round(1 / h);
            return explicitEuler(-1, 1, 1 / steps, steps).trajectory[steps]!.error;
        };
        const coarse = errorAt(0.1);
        const fine = errorAt(0.05);
        expect(fine).toBeLessThan(coarse);
        expect(coarse / fine).toBeGreaterThan(1.7);
        expect(coarse / fine).toBeLessThan(2.3);
    });

    it("emits well-formed frames and terminates cleanly", () => {
        const input = mod.defaultInput as { lambda: number; y0: number; h: number; steps: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.steps + 1);
        expect(Number(frames[frames.length - 1]?.meta["error"])).toBeGreaterThan(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
