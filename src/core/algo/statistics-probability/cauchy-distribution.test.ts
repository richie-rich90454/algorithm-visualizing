/**
 * cauchy-distribution.test.ts - Closed forms, quantile inversion, sampling, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cauchy-distribution";
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
        expect(frame.entities.length).toBeGreaterThan(0);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
            expect(Number.isFinite(entity.width)).toBe(true);
            expect(Number.isFinite(entity.height)).toBe(true);
            expect(typeof entity.state).toBe("string");
            expect(entity.metadata).toBeDefined();
        }
    });
}

const pdf = (x: number, x0: number, gamma: number): number =>
    1 / (Math.PI * gamma * (1 + ((x - x0) / gamma) ** 2));
const cdf = (x: number, x0: number, gamma: number): number =>
    0.5 + Math.atan((x - x0) / gamma) / Math.PI;

describe("CauchyDistribution", () => {
    it("matches the closed-form density and CDF at every grid point", () => {
        const x0 = 2;
        const gamma = 1.5;
        const frames = [...mod.run({ location: x0, scale: gamma, points: 21, samples: 100 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const xs = meta?.["xs"] as number[];
        const density = meta?.["pdf"] as number[];
        const cumulative = meta?.["cdf"] as number[];
        expect(xs.length).toBe(21);
        for (let i = 0; i < xs.length; i += 1) {
            expect(density[i]).toBeCloseTo(pdf(xs[i] as number, x0, gamma), 12);
            expect(cumulative[i]).toBeCloseTo(cdf(xs[i] as number, x0, gamma), 12);
        }
    });

    it("inverts the CDF through the tangent quantile", () => {
        const x0 = -1;
        const gamma = 2;
        for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) {
            const q = x0 + gamma * Math.tan(Math.PI * (p - 0.5));
            expect(cdf(q, x0, gamma)).toBeCloseTo(p, 12);
        }
    });

    it("has unit total probability under numerical integration", () => {
        const x0 = 0;
        const gamma = 1;
        const steps = 200000;
        const low = -200;
        const high = 200;
        const h = (high - low) / steps;
        let total = 0;
        for (let i = 0; i <= steps; i += 1) {
            const x = low + i * h;
            const weight = i === 0 || i === steps ? 0.5 : 1;
            total += weight * pdf(x, x0, gamma) * h;
        }
        // Heavy tails beyond the finite window account for the remaining mass.
        expect(total).toBeCloseTo(1, 2);
    });

    it("recovers the median and interquartile range by sampling", () => {
        const x0 = 3;
        const gamma = 0.75;
        const frames = [...mod.run({ location: x0, scale: gamma, points: 9, samples: 20000, seed: 4242 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(Math.abs(Number(meta?.["sampleMedian"]) - x0)).toBeLessThan(0.1);
        expect(Math.abs(Number(meta?.["sampleIqr"]) - 2 * gamma)).toBeLessThan(0.15);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(27);
        expect(generator.next().done).toBe(true);
    });
});
