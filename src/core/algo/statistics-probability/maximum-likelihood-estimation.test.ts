/**
 * maximum-likelihood-estimation.test.ts - Closed-form estimate, grid search,
 * concavity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./maximum-likelihood-estimation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBe(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(steps);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("maximum likelihood estimation", () => {
    it("finds the closed-form exponential rate and zeroes the score", () => {
        const data = [0.5, 1.2, 0.3, 2, 0.8, 1.5];
        const frames = [...mod.run({ data, min: 0.2, max: 3, steps: 25 })];
        checkFrames(frames, 25);
        const meta = frames[frames.length - 1]?.meta;
        const sum = data.reduce((a, b) => a + b, 0);
        const want = data.length / sum;
        expect(Number(meta?.["lambdaHat"])).toBeCloseTo(want, 12);
        expect(Number(meta?.["score"])).toBeCloseTo(0, 9);
        const logLikelihood = (lambda: number): number => data.length * Math.log(lambda) - lambda * sum;
        expect(Number(meta?.["logLikelihoodAtHat"])).toBeCloseTo(logLikelihood(want), 12);
    });

    it("agrees with a brute-force grid maximum and stays concave", () => {
        const data = [0.2, 0.4, 0.9, 1.1, 1.8, 2.2, 3.0];
        const min = 0.1;
        const max = 5;
        const steps = 40;
        const frames = [...mod.run({ data, min, max, steps })];
        checkFrames(frames, steps);
        const meta = frames[frames.length - 1]?.meta;
        const grid = meta?.["grid"] as number[];
        const curve = meta?.["curve"] as number[];
        let argmax = 0;
        for (let i = 1; i < curve.length; i += 1) {
            if (curve[i]! > curve[argmax]!) {
                argmax = i;
            }
        }
        const stepSize = (max - min) / (steps - 1);
        expect(Math.abs(grid[argmax]! - Number(meta?.["lambdaHat"]))).toBeLessThanOrEqual(stepSize);
        for (let i = 1; i < curve.length - 1; i += 1) {
            expect(curve[i]! - 0.5 * (curve[i - 1]! + curve[i + 1]!)).toBeGreaterThan(0);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
