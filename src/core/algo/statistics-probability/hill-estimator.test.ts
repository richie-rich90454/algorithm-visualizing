/** hill-estimator.test.ts - Exact Pareto recovery and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./hill-estimator";
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

describe("Hill Estimator", () => {
    it("recovers the exponent exactly on a geometric tail sample", () => {
        const alpha = 2.5;
        const k = 12;
        const ratio = Math.exp(-2 / (alpha * (k + 1)));
        const sample = Array.from({ length: 60 }, (_, i) => ratio ** i);
        const frames = [...mod.run({ sample, k })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["chosen"])).toBeCloseTo(alpha, 9);
        expect(Number(final["threshold"])).toBeCloseTo(sample[k]!, 12);
    });

    it("approaches the true index on Pareto quantiles", () => {
        const alpha = 2;
        const n = 2000;
        const sample = Array.from({ length: n }, (_, i) => (1 - (i + 1) / (n + 1)) ** (-1 / alpha));
        const frames = [...mod.run({ sample, k: 500 })];
        const final = frames[frames.length - 1]!.meta;
        expect(Math.abs(Number(final["chosen"]) - alpha)).toBeLessThan(0.15);
    });

    it("produces a full Hill plot of finite estimates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const estimates = frames[frames.length - 1]!.meta["estimates"] as number[];
        expect(estimates.length).toBeGreaterThan(20);
        expect(estimates.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
