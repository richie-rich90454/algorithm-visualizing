/**
 * z-test.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./z-test";
import type { VisualFrame } from "@/types";

/** Independent Abramowitz-Stegun normal CDF used as a reference. */
function cdf(x: number): number {
    if (x < 0) return 1 - cdf(-x);
    const t = 1 / (1 + 0.2316419 * x);
    const phi = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    const poly = 0.319381530 * t - 0.356563782 * t ** 2 + 1.781477937 * t ** 3
        - 1.821255978 * t ** 4 + 1.330274429 * t ** 5;
    return 1 - phi * poly;
}

function reference(data: number[], mu0: number, sigma: number, alpha: number) {
    const n = data.length;
    const mean = data.reduce((s, x) => s + x, 0) / n;
    const z = (mean - mu0) / (sigma / Math.sqrt(n));
    const p = 2 * (1 - cdf(Math.abs(z)));
    return { n, mean, z, p, reject: p < alpha };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("One-sample z test", () => {
    it("matches an independent reference for mean, z, p, and decision", () => {
        const cases: Array<{ data: number[]; mu0: number; sigma: number; alpha: number }> = [
            { data: [105, 102, 108, 99, 111, 107, 104, 98, 112, 106], mu0: 100, sigma: 15, alpha: 0.05 },
            { data: [50, 52, 49, 51, 50, 48, 53, 50], mu0: 50, sigma: 4, alpha: 0.1 },
            { data: [10, 14, 16, 12, 15], mu0: 5, sigma: 3, alpha: 0.01 },
        ];
        for (const { data, mu0, sigma, alpha } of cases) {
            const frames = [...mod.run({ data, mu0, sigma, alpha })] as VisualFrame[];
            checkFrames(frames, data.length);
            const expected = reference(data, mu0, sigma, alpha);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(Number(finalMeta?.["n"])).toBe(expected.n);
            expect(Number(finalMeta?.["mean"])).toBeCloseTo(expected.mean, 10);
            expect(Number(finalMeta?.["z"])).toBeCloseTo(expected.z, 10);
            expect(Number(finalMeta?.["pValue"])).toBeCloseTo(expected.p, 9);
            expect(Boolean(finalMeta?.["reject"])).toBe(expected.reject);
        }
    });

    it("gives z zero and p one when the sample mean equals the null", () => {
        const frames = [...mod.run({ data: [10, 10, 10, 10], mu0: 10, sigma: 2, alpha: 0.05 })];
        checkFrames(frames, 4);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["z"])).toBeCloseTo(0, 10);
        expect(Number(finalMeta?.["pValue"])).toBeCloseTo(1, 9);
        expect(Boolean(finalMeta?.["reject"])).toBe(false);
    });

    it("has a p value near 0.05 for an absolute z near 1.96", () => {
        // n=1, mean 1.96 mu0 0, sigma 1 gives z = 1.96.
        const frames = [...mod.run({ data: [1.96], mu0: 0, sigma: 1, alpha: 0.05 })];
        checkFrames(frames, 1);
        expect(Number(frames[frames.length - 1]?.meta["pValue"])).toBeCloseTo(0.05, 3);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
