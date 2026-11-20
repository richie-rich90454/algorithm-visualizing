/**
 * quantum-monte-carlo.test.ts - Amplitude-estimation accuracy, edge values, probability/estimate consistency, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-monte-carlo";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], outcomes: number): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(outcomes);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["outcomes"]).toBe(outcomes);
        expect(frame.meta["sumProbability"] as number).toBeCloseTo(1, 10);
    });
}

describe("QuantumMonteCarlo", () => {
    it("estimates several encoded values within the grid resolution", () => {
        for (const a of [0.125, 0.25, 0.5, 0.75, 0.9]) {
            const frames = [...mod.run({ a, precision: 8 })];
            checkFrames(frames, 256);
            const final = frames[frames.length - 1]!.meta;
            expect(final["a"]).toBeCloseTo(a, 12);
            expect(Math.abs((final["estimate"] as number) - a)).toBeLessThan(0.03);
        }
    });

    it("returns 0 and 1 at the extremes", () => {
        expect([...mod.run({ a: 0, precision: 6 })].pop()?.meta["estimate"]).toBeCloseTo(0, 10);
        expect([...mod.run({ a: 1, precision: 6 })].pop()?.meta["estimate"]).toBeCloseTo(1, 10);
    });

    it("derives the estimate from the most likely outcome and concentrates probability", () => {
        const frames = [...mod.run({ a: 0.3, precision: 6 })];
        const final = frames[frames.length - 1]!.meta;
        const y = final["mostLikely"] as number;
        const expected = Math.sin((Math.PI * y) / 64) ** 2;
        expect(final["estimate"] as number).toBeCloseTo(expected, 12);
        const probs = final["probabilities"] as number[];
        expect(Math.max(...probs)).toBeGreaterThan(0.3);
        const before = frames[1]!.meta["probabilities"] as number[];
        expect(Math.max(...before) - Math.min(...before)).toBeLessThan(1e-12);
    });

    it("tightens the estimate as precision grows", () => {
        const coarse = [...mod.run({ a: 0.37, precision: 4 })].pop()?.meta["estimate"] as number;
        const fine = [...mod.run({ a: 0.37, precision: 8 })].pop()?.meta["estimate"] as number;
        expect(Math.abs(fine - 0.37)).toBeLessThanOrEqual(Math.abs(coarse - 0.37) + 1e-12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
