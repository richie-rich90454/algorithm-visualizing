/**
 * bayesian-bootstrap.test.ts - Dirichlet moment cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bayesian-bootstrap";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        const weights = frame.meta["weights"] as number[];
        expect(weights.length).toBe(n);
        expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        expect(weights.every((w) => w >= 0)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Bayesian Bootstrap", () => {
    it("matches exact Dirichlet posterior moments on a two-point sample", () => {
        const frames = [...mod.run({ data: [0, 1], draws: 20000, seed: 7 })];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1];
        expect(final?.meta["analyticMean"]).toBeCloseTo(0.5, 12);
        expect(final?.meta["analyticVariance"] as number).toBeCloseTo(1 / 12, 12);
        expect(final?.meta["simulatedMean"] as number).toBeCloseTo(0.5, 2);
        expect((final?.meta["simulatedVariance"] as number)).toBeCloseTo(1 / 12, 1);
    });

    it("puts the posterior mean at the sample mean for a larger sample", () => {
        const data = [2, 4, 4, 4, 5, 5, 7, 9];
        const frames = [...mod.run({ data, draws: 8000, seed: 99 })];
        checkFrames(frames, data.length);
        const final = frames[frames.length - 1];
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        expect(final?.meta["analyticMean"]).toBeCloseTo(mean, 12);
        expect(final?.meta["simulatedMean"] as number).toBeCloseTo(mean, 1);
        const n = data.length;
        const second = data.reduce((a, x) => a + x * x, 0);
        const varianceN = second / n - mean * mean;
        expect(final?.meta["analyticVariance"] as number).toBeCloseTo(varianceN / (n + 1), 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
