/**
 * gamma-distribution.test.ts - Moment/integral and analytic-CDF checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./gamma-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], samples: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(samples);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Trapezoid integral of a sampled density over [0, xMax]. */
function integrate(values: number[], xMax: number): number {
    const h = xMax / values.length;
    let sum = (values[0]! + values[values.length - 1]!) / 2;
    for (let i = 1; i < values.length - 1; i += 1) sum += values[i]!;
    return sum * h;
}

describe("Gamma Distribution", () => {
    it("density integrates to one and has the stated mean and variance", () => {
        const samples = 4000;
        const frames = [...mod.run({ shape: 3, scale: 1.5, samples, xMax: 40 })];
        checkFrames(frames, samples);
        const meta = frames[frames.length - 1]!.meta;
        const densities = meta["densities"] as number[];
        const h = 40 / samples;
        const total = integrate(densities, 40);
        expect(total).toBeCloseTo(1, 3);
        let mean = 0;
        let second = 0;
        for (let i = 0; i < samples; i += 1) {
            const x = i * h;
            mean += x * densities[i]! * h;
            second += x * x * densities[i]! * h;
        }
        expect(mean).toBeCloseTo(Number(meta["mean"]), 1);
        expect(second - mean * mean).toBeCloseTo(Number(meta["variance"]), 0);
    });

    it("matches analytic CDF values for integer shapes with unit scale", () => {
        const analytic = new Map<number, number>([
            [1, 1 - Math.exp(-1)],
            [2, 1 - Math.exp(-2) * (1 + 2)],
            [3, 1 - Math.exp(-3) * (1 + 3 + 4.5)],
        ]);
        for (const [shape, expected] of analytic) {
            const frames = [...mod.run({ shape, scale: 1, samples: 20 })];
            const cdfAtMean = Number(frames[frames.length - 1]!.meta["cdfAtMean"]);
            expect(cdfAtMean).toBeCloseTo(expected, 6);
        }
    });

    it("reproduces the exponential special case", () => {
        const frames = [...mod.run({ shape: 1, scale: 2, samples: 50, xMax: 20 })];
        const meta = frames[frames.length - 1]!.meta;
        expect(Number(meta["mean"])).toBeCloseTo(2, 10);
        expect(Number(meta["variance"])).toBeCloseTo(4, 10);
        // Density at zero for an exponential is 1/scale = 0.5.
        const firstDensity = (meta["densities"] as number[])[0]!;
        expect(firstDensity).toBeCloseTo(0.5, 10);
        const cdf = meta["cdfSamples"] as number[];
        expect(cdf[0]).toBeCloseTo(1 - Math.exp(-1), 6);
    });

    it("has monotone CDF samples between zero and one", () => {
        const frames = [...mod.run({ shape: 2.5, scale: 1.2, samples: 30 })];
        const cdf = frames[frames.length - 1]!.meta["cdfSamples"] as number[];
        expect(cdf.length).toBe(3);
        for (const value of cdf) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
        }
        expect(cdf[1]!).toBeLessThan(cdf[0]!);
        expect(cdf[2]!).toBeGreaterThan(cdf[0]!);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
