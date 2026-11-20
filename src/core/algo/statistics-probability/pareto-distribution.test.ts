/**
 * pareto-distribution.test.ts - Independent power-law reference, monotone CDF,
 * quantile inversion, truncated area, moments, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./pareto-distribution";
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

describe("ParetoDistribution", () => {
    it("matches an independent power-law evaluation of density and CDF", () => {
        for (const [xm, alpha] of [[1, 2], [2, 1.5], [0.5, 3]]) {
            const frames = [...mod.run({ xm, alpha, maxX: xm * 8, steps: 10 })];
            checkFrames(frames, 10);
            const meta = frames[frames.length - 1]!.meta;
            const xs = meta["xs"] as number[];
            const pdf = meta["pdf"] as number[];
            const cdf = meta["cdf"] as number[];
            for (let i = 0; i < xs.length; i += 1) {
                const x = xs[i] ?? xm;
                const survival = Math.pow(xm / x, alpha);
                expect(pdf[i]).toBeCloseTo((alpha * Math.pow(xm, alpha)) / Math.pow(x, alpha + 1), 9);
                expect(cdf[i]).toBeCloseTo(1 - survival, 9);
            }
        }
    });

    it("is monotone, inverts its CDF, and integrates to the truncated mass", () => {
        const xm = 1;
        const alpha = 2;
        const maxX = 10;
        const steps = 400;
        const meta = [...mod.run({ xm, alpha, maxX, steps })].at(-1)!.meta;
        const cdf = meta["cdf"] as number[];
        const quantiles = meta["quantiles"] as number[];
        const xs = meta["xs"] as number[];
        const pdf = meta["pdf"] as number[];
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i]!).toBeGreaterThanOrEqual(cdf[i - 1]!);
        }
        expect(cdf[0]).toBeCloseTo(0, 10);
        expect(cdf.at(-1)).toBeCloseTo(1 - Math.pow(xm / maxX, alpha), 10);
        for (let i = 0; i < quantiles.length; i += 1) {
            expect(quantiles[i]).toBeCloseTo(xs[i]!, 4);
        }
        const h = (maxX - xm) / steps;
        const area = pdf.reduce((s, v, k) => s + (k === 0 || k === pdf.length - 1 ? v / 2 : v), 0) * h;
        expect(Number(meta["area"])).toBeCloseTo(area, 10);
        expect(area).toBeCloseTo(1 - Math.pow(xm / maxX, alpha), 2);
        expect(Number(meta["mean"])).toBeCloseTo(2, 12);
        expect(meta["varianceDefined"]).toBe(false);
    });

    it("flags undefined moments for small shapes", () => {
        const meta = [...mod.run({ xm: 1, alpha: 1, maxX: 8, steps: 10 })].at(-1)!.meta;
        expect(meta["meanDefined"]).toBe(false);
        expect(meta["varianceDefined"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(15);
        expect(generator.next().done).toBe(true);
    });
});
