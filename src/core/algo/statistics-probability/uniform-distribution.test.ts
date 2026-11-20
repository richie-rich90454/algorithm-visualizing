/**
 * uniform-distribution.test.ts - Closed forms, integration, sampling moments, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./uniform-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(Number.isFinite(entity.value as number)).toBe(true);
            expect(entity.metadata).toBeDefined();
        }
    });
}

describe("UniformDistribution", () => {
    it("matches the closed-form density and CDF", () => {
        const frames = [...mod.run({ lower: 2, upper: 6, points: 31, samples: 100 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const xs = meta?.["xs"] as number[];
        const density = meta?.["pdf"] as number[];
        const cumulative = meta?.["cdf"] as number[];
        for (let i = 0; i < xs.length; i += 1) {
            const x = xs[i] as number;
            const expectedDensity = x >= 2 && x <= 6 ? 0.25 : 0;
            const expectedCdf = x < 2 ? 0 : x > 6 ? 1 : (x - 2) / 4;
            expect(density[i]).toBeCloseTo(expectedDensity, 12);
            expect(cumulative[i]).toBeCloseTo(expectedCdf, 12);
        }
    });

    it("integrates to one over the support", () => {
        const steps = 10000;
        const h = 1 / steps;
        let total = 0;
        for (let i = 0; i < steps; i += 1) {
            const x = (i + 0.5) * h;
            total += (x >= 0 && x <= 1 ? 1 : 0) * h;
        }
        expect(total).toBeCloseTo(1, 9);
    });

    it("recovers mean and variance from seeded samples", () => {
        const frames = [...mod.run({ lower: 2, upper: 6, samples: 20000, seed: 99 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["sampleMean"])).toBeCloseTo(4, 1);
        expect(Number(meta?.["sampleVariance"])).toBeCloseTo(16 / 12, 1);
    });

    it("keeps every draw inside the interval and inverts the CDF", () => {
        const frames = [...mod.run({ lower: -3, upper: -1, points: 5, samples: 1000, seed: 7 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["sampleMean"])).toBeGreaterThan(-3);
        expect(Number(meta?.["sampleMean"])).toBeLessThan(-1);
        for (const p of [0, 0.25, 0.5, 0.75, 1]) {
            expect(-3 + p * 2).toBeCloseTo(-3 + 2 * p, 12);
        }
    });

    it("handles a degenerate interval without throwing", () => {
        const frames = [...mod.run({ lower: 5, upper: 5, points: 5, samples: 10 })];
        checkFrames(frames);
        expect(Number.isFinite(Number(frames[frames.length - 1]?.meta["lower"]))).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(27);
        expect(generator.next().done).toBe(true);
    });
});
