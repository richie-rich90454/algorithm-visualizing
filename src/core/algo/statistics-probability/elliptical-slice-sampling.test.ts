/** elliptical-slice-sampling.test.ts - Posterior mean and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./elliptical-slice-sampling";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
    });
}

describe("Elliptical Slice Sampling", () => {
    it("recovers the analytic Gaussian posterior mean", () => {
        const frames = [...mod.run({ seed: 77, samples: 8000, burnIn: 400 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const sampleMean = final["sampleMean"] as number[];
        const posteriorMean = final["posteriorMean"] as number[];
        expect(Math.abs(sampleMean[0]! - posteriorMean[0]!)).toBeLessThan(0.06);
        expect(Math.abs(sampleMean[1]! - posteriorMean[1]!)).toBeLessThan(0.06);
    });

    it("is deterministic for a fixed seed", () => {
        const a = [...mod.run({ seed: 3, samples: 500, burnIn: 50 })];
        const b = [...mod.run({ seed: 3, samples: 500, burnIn: 50 })];
        expect(a[a.length - 1]!.meta["sampleMean"]).toEqual(b[b.length - 1]!.meta["sampleMean"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
