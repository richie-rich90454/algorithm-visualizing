/**
 * welford-algorithm.test.ts - Correctness, frame contract, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./welford-algorithm";
import type { VisualFrame } from "@/types";

function reference(values: number[]): { mean: number; variance: number; m2: number } {
    if (values.length === 0) {
        return { mean: 0, variance: 0, m2: 0 };
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const m2 = values.reduce((acc, x) => acc + (x - mean) * (x - mean), 0);
    return { mean, variance: values.length > 1 ? m2 / (values.length - 1) : 0, m2 };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
    });
}

describe("Welford Online Variance", () => {
    it("matches two-pass mean, M2, and unbiased variance", () => {
        for (const values of [
            [1, 2, 3, 4, 5],
            [10, 10, 10, 10],
            [-3, 0, 7, 2, -1, 9],
            [1000000.1, 1000000.2, 1000000.3],
            [42],
        ]) {
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const ref = reference(values);
            expect(Number(final?.["mean"])).toBeCloseTo(ref.mean, 8);
            expect(Number(final?.["m2"])).toBeCloseTo(ref.m2, 6);
            expect(Number(final?.["variance"])).toBeCloseTo(ref.variance, 6);
        }
    });

    it("reports a correct running mean at every prefix", () => {
        const values = [2, 4, 4, 4, 5, 5, 7, 9];
        const frames = [...mod.run({ values })];
        for (let i = 1; i < frames.length - 1; i += 1) {
            const meta = frames[i]?.meta;
            const prefix = values.slice(0, Number(meta?.["count"]));
            const expected = prefix.reduce((a, b) => a + b, 0) / prefix.length;
            expect(Number(meta?.["mean"])).toBeCloseTo(expected, 8);
        }
    });

    it("uses the default input and terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["count"]).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
