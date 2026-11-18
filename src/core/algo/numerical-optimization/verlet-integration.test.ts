/**
 * verlet-integration.test.ts - Analytic solution, energy behavior, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { analyticOscillator, velocityVerlet } from "./verlet-integration";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], expectedFinalCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    expect(frames[frames.length - 1]!.entities.length).toBe(expectedFinalCount);
}

describe("Velocity Verlet Integration", () => {
    it("tracks the closed-form harmonic oscillator and second-order convergence", () => {
        const x0 = 1;
        const v0 = 0.3;
        const k = 2;
        const endTime = 3;
        let previousError = Number.POSITIVE_INFINITY;
        for (const dt of [0.1, 0.05, 0.025]) {
            const steps = Math.round(endTime / dt);
            const result = velocityVerlet(x0, v0, k, dt, steps);
            const last = result.steps[result.steps.length - 1]!;
            const expected = analyticOscillator(x0, v0, k, last.t);
            const error = Math.abs(last.x - expected);
            expect(error).toBeLessThan(0.01);
            // Halving dt should roughly quarter the error (second order).
            if (Number.isFinite(previousError)) {
                expect(error).toBeLessThan(previousError);
            }
            previousError = error;
        }
    });

    it("keeps energy bounded without secular drift", () => {
        const x0 = 1;
        const v0 = 0;
        const k = 1;
        const result = velocityVerlet(x0, v0, k, 0.05, 2000);
        const initialEnergy = 0.5 * v0 * v0 + 0.5 * k * x0 * x0;
        for (const step of result.steps) {
            expect(Math.abs(step.energy - initialEnergy)).toBeLessThan(0.01);
        }
        expect(result.energyDrift).toBeLessThan(0.01);
    });

    it("produces well-formed frames with a small final energy drift", () => {
        const input = mod.defaultInput as {
            x0: number;
            v0: number;
            k: number;
            dt: number;
            steps: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.steps);
        expect(Number(frames[frames.length - 1]?.meta["drift"])).toBeLessThan(0.01);
        expect(Number(frames[frames.length - 1]?.meta["steps"])).toBe(input.steps);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
