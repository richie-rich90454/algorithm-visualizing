/**
 * gumbel-distribution.test.ts - Closed forms, quantile inversion, integration, sampling, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./gumbel-distribution";
import type { VisualFrame } from "@/types";

const EULER_GAMMA = 0.5772156649015329;

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

const pdf = (x: number, mu: number, beta: number): number => {
    const z = (x - mu) / beta;
    return Math.exp(-(z + Math.exp(-z))) / beta;
};
const cdf = (x: number, mu: number, beta: number): number => Math.exp(-Math.exp(-(x - mu) / beta));

describe("GumbelDistribution", () => {
    it("matches the closed-form density and CDF", () => {
        const frames = [...mod.run({ location: 1, scale: 1.5, points: 25, samples: 100 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const xs = meta?.["xs"] as number[];
        const density = meta?.["pdf"] as number[];
        const cumulative = meta?.["cdf"] as number[];
        for (let i = 0; i < xs.length; i += 1) {
            expect(density[i]).toBeCloseTo(pdf(xs[i] as number, 1, 1.5), 12);
            expect(cumulative[i]).toBeCloseTo(cdf(xs[i] as number, 1, 1.5), 12);
        }
    });

    it("inverts the double-exponential CDF", () => {
        const mu = 2;
        const beta = 0.7;
        for (const p of [0.05, 0.2, 0.5, 0.8, 0.95]) {
            const q = mu - beta * Math.log(-Math.log(p));
            expect(cdf(q, mu, beta)).toBeCloseTo(p, 12);
        }
    });

    it("integrates to one", () => {
        const low = -20;
        const high = 40;
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

    it("recovers the mean and variance from seeded samples", () => {
        const mu = -1;
        const beta = 1.2;
        const frames = [...mod.run({ location: mu, scale: beta, samples: 20000, seed: 8080 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(Math.abs(Number(meta?.["sampleMean"]) - (mu + beta * EULER_GAMMA))).toBeLessThan(0.1);
        expect(Math.abs(Number(meta?.["sampleVariance"]) - (Math.PI ** 2 * beta * beta) / 6)).toBeLessThan(0.25);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(27);
        expect(generator.next().done).toBe(true);
    });
});
