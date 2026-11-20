/**
 * implicit-q-learning.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./implicit-q-learning";
import type { VisualFrame } from "@/types";

type Input = { targets: number[]; tau: number; maxIterations: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function referenceExpectile(targets: number[], tau: number): number {
    let m = targets.reduce((a, v) => a + v, 0) / targets.length;
    for (let i = 0; i < 500; i += 1) {
        let numerator = 0;
        let denominator = 0;
        for (const value of targets) {
            const weight = value > m ? tau : 1 - tau;
            numerator += weight * value;
            denominator += weight;
        }
        m = numerator / denominator;
    }
    return m;
}

describe("Implicit Q-Learning", () => {
    it("converges to the expectile from an independent fixed-point reference", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = referenceExpectile(input.targets, input.tau);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["expectile"])).toBeCloseTo(expected, 5);
        expect(final?.["converged"]).toBe(true);
    });

    it("reduces to the mean at tau one half and rises with tau", () => {
        const targets = [1, 3, 2, 5, 4];
        const mean = targets.reduce((a, v) => a + v, 0) / targets.length;
        const half = [...mod.run({ targets, tau: 0.5, maxIterations: 30 })];
        expect(Number(half[half.length - 1]?.meta["expectile"])).toBeCloseTo(mean, 5);
        const low = Number([...mod.run({ targets, tau: 0.6, maxIterations: 30 })].slice(-1)[0]?.meta["expectile"]);
        const high = Number([...mod.run({ targets, tau: 0.9, maxIterations: 30 })].slice(-1)[0]?.meta["expectile"]);
        expect(high).toBeGreaterThan(low);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
