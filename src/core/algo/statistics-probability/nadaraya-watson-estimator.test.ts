/**
 * nadaraya-watson-estimator.test.ts - Independent kernel cross-check, convexity, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./nadaraya-watson-estimator";
import type { VisualFrame } from "@/types";

function reference(xs: number[], ys: number[], bandwidth: number, grid: number[]): number[] {
    return grid.map((x) => {
        let weightSum = 0;
        let weightedValues = 0;
        for (let i = 0; i < xs.length; i += 1) {
            const u = (x - xs[i]) / bandwidth;
            const weight = Math.exp(-0.5 * u * u);
            weightSum += weight;
            weightedValues += weight * ys[i];
        }
        return weightedValues / weightSum;
    });
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(Number(frame.meta["queryPoints"]) + 1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Nadaraya-Watson Estimator", () => {
    it("matches an independent kernel-weighted computation", () => {
        const cases = [
            { xs: [0, 1, 2, 3, 4], ys: [0, 1, 4, 9, 16], bandwidth: 1, queryPoints: 20 },
            { xs: [-2, 0.5, 1, 3], ys: [4, -1, 2, 7], bandwidth: 0.8, queryPoints: 12 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            const grid = final?.meta["grid"] as number[];
            const predictions = final?.meta["predictions"] as number[];
            const expected = reference(testCase.xs, testCase.ys, testCase.bandwidth, grid);
            expect(predictions.length).toBe(expected.length);
            expected.forEach((value, index) => expect(predictions[index] as number).toBeCloseTo(value, 12));
        }
    });

    it("reproduces a constant response exactly and stays within the response range", () => {
        const constant = [...mod.run({ xs: [0, 1, 2], ys: [3, 3, 3], bandwidth: 2, queryPoints: 8 })];
        const constantPredictions = constant[constant.length - 1]?.meta["predictions"] as number[];
        expect(constantPredictions.every((value) => Math.abs(value - 3) < 1e-9)).toBe(true);

        const frames = [...mod.run(mod.defaultInput)];
        const predictions = frames[frames.length - 1]?.meta["predictions"] as number[];
        const min = Math.min(...frames[frames.length - 1]?.meta["ys"] as number[]);
        const max = Math.max(...frames[frames.length - 1]?.meta["ys"] as number[]);
        predictions.forEach((value) => {
            expect(value).toBeGreaterThanOrEqual(min - 1e-9);
            expect(value).toBeLessThanOrEqual(max + 1e-9);
        });
    });

    it("interpolates a training response as the bandwidth shrinks", () => {
        const frames = [...mod.run({ xs: [0, 1, 2], ys: [3, 1, 4], bandwidth: 0.001, queryPoints: 2 })];
        const predictions = frames[frames.length - 1]?.meta["predictions"] as number[];
        expect(predictions[0]).toBeCloseTo(3, 2);
        expect(predictions[1]).toBeCloseTo(1, 2);
        expect(predictions[2]).toBeCloseTo(4, 2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
