/**
 * generalized-extreme-value.test.ts - Independent ECDF formula, Gumbel limit,
 * monotone CDF, quantile inversion, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./generalized-extreme-value";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBe(steps + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(steps + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function referenceCdf(z: number, xi: number): number {
    if (Math.abs(xi) < 1e-9) return Math.exp(-Math.exp(-z));
    const t = 1 + xi * z;
    if (t <= 0) return xi > 0 ? 0 : 1;
    return Math.exp(-Math.pow(t, -1 / xi));
}

describe("GeneralizedExtremeValue", () => {
    it("matches an independent evaluation of the cumulative function", () => {
        for (const xi of [0, 0.1, 0.3, -0.2]) {
            const frames = [...mod.run({ xi, mu: 0, sigma: 1, maxZ: 6, steps: 24 })];
            checkFrames(frames, 24);
            const meta = frames[frames.length - 1]!.meta;
            const xs = meta["xs"] as number[];
            const cdf = meta["cdf"] as number[];
            for (let i = 0; i < xs.length; i += 1) {
                expect(cdf[i]).toBeCloseTo(referenceCdf(xs[i] ?? 0, xi), 10);
            }
        }
    });

    it("reduces to the Gumbel law at shape zero", () => {
        const meta = [...mod.run({ xi: 0, mu: 0, sigma: 1, steps: 12 })].at(-1)!.meta;
        expect(meta["family"]).toBe("Gumbel");
        const cdf = meta["cdf"] as number[];
        const xs = meta["xs"] as number[];
        const atZero = xs.findIndex((x) => Math.abs(x) < 1e-9);
        expect(atZero).toBeGreaterThanOrEqual(0);
        expect(cdf[atZero]).toBeCloseTo(Math.exp(-1), 10);
    });

    it("has a monotone CDF and quantiles that invert it", () => {
        const xi = 0.1;
        const mu = 2;
        const sigma = 1.5;
        const meta = [...mod.run({ xi, mu, sigma, steps: 40 })].at(-1)!.meta;
        const cdf = meta["cdf"] as number[];
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i]!).toBeGreaterThanOrEqual(cdf[i - 1]!);
        }
        const quantiles = meta["quantiles"] as number[];
        for (let i = 0; i < quantiles.length; i += 1) {
            const probability = [0.1, 0.5, 0.9][i]!;
            const z = ((quantiles[i] ?? 0) - mu) / sigma;
            expect(referenceCdf(z, xi)).toBeCloseTo(probability, 8);
        }
        const pdf = meta["pdf"] as number[];
        for (const density of pdf) expect(density).toBeGreaterThanOrEqual(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(15);
        expect(generator.next().done).toBe(true);
    });
});
