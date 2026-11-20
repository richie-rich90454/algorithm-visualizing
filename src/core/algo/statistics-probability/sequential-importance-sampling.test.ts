/** sequential-importance-sampling.test.ts - Weighted estimator checks. */

import { describe, expect, it } from "vitest";
import mod from "./sequential-importance-sampling";
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

describe("Sequential Importance Sampling", () => {
    it("normalizes weights to one", () => {
        const frames = [...mod.run({ seed: 11, particles: 500 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["weightSum"])).toBeCloseTo(1, 10);
    });

    it("estimates the target second moment accurately", () => {
        const frames = [...mod.run({ seed: 2024, particles: 8000, proposalSd: 1.5 })];
        const final = frames[frames.length - 1]!.meta;
        expect(Math.abs(Number(final["estimate"]) - 1)).toBeLessThan(0.1);
        expect(Number(final["ess"])).toBeGreaterThan(0);
        expect(Number(final["ess"])).toBeLessThanOrEqual(8000);
    });

    it("is deterministic for a fixed seed", () => {
        const a = [...mod.run({ seed: 7, particles: 300 })];
        const b = [...mod.run({ seed: 7, particles: 300 })];
        expect(a[a.length - 1]!.meta["estimate"]).toEqual(b[b.length - 1]!.meta["estimate"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
