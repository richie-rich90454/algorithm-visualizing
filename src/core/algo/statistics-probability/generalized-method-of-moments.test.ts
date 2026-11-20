/**
 * generalized-method-of-moments.test.ts - Closed-form and brute-force optimum checks, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./generalized-method-of-moments";
import type { VisualFrame } from "@/types";

/** Independent weighted moment objective. */
function objective(rate: number, mean: number, second: number, w1: number, w2: number): number {
    if (rate <= 0) return Infinity;
    const g1 = mean - 1 / rate;
    const g2 = second - 2 / (rate * rate);
    return w1 * g1 * g1 + w2 * g2 * g2;
}

function checkFrames(frames: VisualFrame[], gridSize: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(gridSize + 1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Generalized Method of Moments", () => {
    it("reduces to the closed-form rate when only the mean is weighted", () => {
        const data = [0.5, 1, 1.5, 2, 3];
        const frames = [...mod.run({ data, w1: 1, w2: 0, gridSize: 120 })];
        checkFrames(frames, 120);
        const final = frames[frames.length - 1];
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        expect(final?.meta["estimate"] as number).toBeCloseTo(1 / mean, 6);
    });

    it("finds an optimum at least as good as a fine brute-force grid", () => {
        const data = [0.4, 0.9, 0.2, 1.4, 0.6, 1.1, 0.3, 0.8];
        const w1 = 2;
        const w2 = 0.5;
        const frames = [...mod.run({ data, w1, w2, gridSize: 100 })];
        const final = frames[frames.length - 1];
        const mean = final?.meta["mean"] as number;
        const second = final?.meta["second"] as number;
        const estimate = final?.meta["estimate"] as number;
        let bruteBest = Infinity;
        for (let i = 0; i <= 20000; i += 1) {
            const rate = 0.05 + (19.95 * i) / 20000;
            bruteBest = Math.min(bruteBest, objective(rate, mean, second, w1, w2));
        }
        expect(objective(estimate, mean, second, w1, w2)).toBeLessThanOrEqual(bruteBest + 1e-10);
        const curve = final?.meta["objective"] as number[];
        expect(curve.every((value) => value >= 0)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
