/**
 * expectation-and-variance.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./expectation-and-variance";
import type { VisualFrame } from "@/types";

function reference(values: number[], probabilities: number[]) {
    const total = probabilities.reduce((a, b) => a + b, 0);
    const p = probabilities.map((x) => x / total);
    const mean = values.reduce((acc, x, i) => acc + x * (p[i] as number), 0);
    const variance = values.reduce((acc, x, i) => acc + (x - mean) ** 2 * (p[i] as number), 0);
    return { mean, variance };
}

function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Expectation and Variance", () => {
    it("matches direct definitions of mean and variance", () => {
        const cases = [
            { values: [1, 2, 3, 4, 5, 6], probabilities: [1, 1, 1, 1, 1, 1] },
            { values: [0, 1, 2], probabilities: [0.25, 0.5, 0.25] },
            { values: [-3, 0, 5, 11], probabilities: [0.1, 0.2, 0.3, 0.4] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.values.length);
            const meta = frames[frames.length - 1]?.meta;
            const expected = reference(testCase.values, testCase.probabilities);
            expect(meta?.["mean"] as number).toBeCloseTo(expected.mean, 9);
            expect(meta?.["variance"] as number).toBeCloseTo(expected.variance, 9);
        }
    });

    it("gives the known fair-die moments", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["mean"] as number).toBeCloseTo(3.5, 9);
        expect(meta?.["variance"] as number).toBeCloseTo(35 / 12, 9);
    });

    it("keeps variance nonnegative for a constant variable", () => {
        const frames = [...mod.run({ values: [7, 7, 7], probabilities: [1, 1, 1] })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["mean"] as number).toBeCloseTo(7, 9);
        expect(meta?.["variance"] as number).toBeGreaterThanOrEqual(0);
        expect(meta?.["variance"] as number).toBeCloseTo(0, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
