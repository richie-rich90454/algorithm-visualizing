/** coxian-distribution.test.ts - Phase-type cumulative checks and frames. */

import { describe, expect, it } from "vitest";
import mod from "./coxian-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    });
}

describe("Coxian Phase-Type Distribution", () => {
    it("matches the exponential cumulative for a single phase", () => {
        const frames = [...mod.run({ rates: [0.8], probs: [], points: 60 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const xs = final["xs"] as number[];
        const cdf = final["cdf"] as number[];
        for (let i = 0; i < xs.length; i += 1) {
            expect(Math.abs(cdf[i]! - (1 - Math.exp(-0.8 * xs[i]!)))).toBeLessThan(1e-6);
        }
    });

    it("is monotone, bounded, and approaches one for multiple phases", () => {
        const frames = [...mod.run({ rates: [0.8, 1.5, 2.2, 3.0], probs: [0.7, 0.5, 0.35], points: 80 })];
        const final = frames[frames.length - 1]!.meta;
        const cdf = final["cdf"] as number[];
        expect(cdf[0]).toBeCloseTo(0, 6);
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i]!).toBeGreaterThanOrEqual(cdf[i - 1]! - 1e-12);
            expect(cdf[i]!).toBeGreaterThanOrEqual(0);
            expect(cdf[i]!).toBeLessThanOrEqual(1);
        }
        expect(cdf[cdf.length - 1]!).toBeGreaterThan(0.99);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
