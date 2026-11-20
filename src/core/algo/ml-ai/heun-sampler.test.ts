/** heun-sampler.test.ts - Drift, second-order accuracy, trajectory, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { drift, heunSample, heunStep } from "./heun-sampler";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Heun sampler", () => {
    it("drift is the linear contraction toward zero", () => {
        expect(drift([1, -2], 0.5)).toEqual([-0.5, 1]);
    });

    it("one step matches the averaged-slope formula", () => {
        const { next, predictor, slopeStart, slopeEnd } = heunStep([1, -2], 0.4, 0.3);
        expect(predictor).toEqual([0.6, -1.2]);
        expect(slopeStart).toEqual([-0.4, 0.8]);
        expect(slopeEnd).toEqual([-0.18, 0.36]);
        next.forEach((v, i) => {
            const expected = [1, -2][i]! + 0.5 * (slopeStart[i]! + slopeEnd[i]!);
            expect(v).toBeCloseTo(expected, 12);
        });
    });

    it("is second-order accurate against the exact exponential", () => {
        const x = 1;
        const sigma = 0.5;
        const { next } = heunStep([x], sigma, sigma);
        const heunFactor = 1 - sigma + 0.5 * sigma * sigma;
        expect(next[0]).toBeCloseTo(x * heunFactor, 12);
        expect(Math.abs(next[0]! - x * Math.exp(-sigma))).toBeLessThan(sigma ** 3 / 6);
    });

    it("trajectory shrinks the sample under a decreasing schedule", () => {
        const input = mod.defaultInput as { initial: number[]; sigmas: number[] };
        const { trajectory, predictors } = heunSample(input.initial, input.sigmas);
        expect(trajectory.length).toBe(input.sigmas.length);
        expect(predictors.length).toBe(input.sigmas.length - 1);
        trajectory.forEach((row) => row.forEach((v) => expect(Number.isFinite(v)).toBe(true)));
        expect(Math.abs(trajectory[trajectory.length - 1]![0]!)).toBeLessThan(Math.abs(input.initial[0]!));
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
