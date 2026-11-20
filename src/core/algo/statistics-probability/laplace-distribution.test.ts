/**
 * laplace-distribution.test.ts - Closed forms, quantile inversion, integration, sampling, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./laplace-distribution";
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
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(entity.metadata).toBeDefined();
        }
    });
}

const pdf = (x: number, mu: number, b: number): number => Math.exp(-Math.abs(x - mu) / b) / (2 * b);
const cdf = (x: number, mu: number, b: number): number => x < mu
    ? 0.5 * Math.exp((x - mu) / b)
    : 1 - 0.5 * Math.exp(-(x - mu) / b);

describe("LaplaceDistribution", () => {
    it("matches the closed-form density and CDF", () => {
        const frames = [...mod.run({ location: 1, scale: 2, points: 25, samples: 100 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const xs = meta?.["xs"] as number[];
        const density = meta?.["pdf"] as number[];
        const cumulative = meta?.["cdf"] as number[];
        for (let i = 0; i < xs.length; i += 1) {
            expect(density[i]).toBeCloseTo(pdf(xs[i] as number, 1, 2), 12);
            expect(cumulative[i]).toBeCloseTo(cdf(xs[i] as number, 1, 2), 12);
        }
    });

    it("inverts the piecewise CDF", () => {
        const mu = -2;
        const b = 1.5;
        for (const p of [0.05, 0.2, 0.5, 0.8, 0.95]) {
            const offset = p - 0.5;
            const q = mu - b * Math.sign(offset) * Math.log(1 - 2 * Math.abs(offset));
            expect(cdf(q, mu, b)).toBeCloseTo(p, 12);
        }
    });

    it("integrates to one", () => {
        const low = -100;
        const high = 100;
        const steps = 100000;
        const h = (high - low) / steps;
        let total = 0;
        for (let i = 0; i <= steps; i += 1) {
            const x = low + i * h;
            const weight = i === 0 || i === steps ? 0.5 : 1;
            total += weight * pdf(x, 0, 1) * h;
        }
        expect(total).toBeCloseTo(1, 4);
    });

    it("recovers mean and variance from seeded samples", () => {
        const frames = [...mod.run({ location: 3, scale: 0.8, samples: 20000, seed: 555 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(Math.abs(Number(meta?.["sampleMean"]) - 3)).toBeLessThan(0.1);
        expect(Math.abs(Number(meta?.["sampleVariance"]) - 2 * 0.8 * 0.8)).toBeLessThan(0.15);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(27);
        expect(generator.next().done).toBe(true);
    });
});
