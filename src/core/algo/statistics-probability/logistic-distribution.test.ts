/** logistic-distribution.test.ts - closed-form pdf/cdf/quantile, integration and inverse properties, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./logistic-distribution";
import type { VisualFrame } from "@/types";

function pdf(x: number, mu: number, s: number): number {
    const e = Math.exp(-(x - mu) / s);
    return e / (s * (1 + e) ** 2);
}
function cdf(x: number, mu: number, s: number): number {
    return 1 / (1 + Math.exp(-(x - mu) / s));
}

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(steps + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Logistic Distribution", () => {
    it("matches closed-form density, CDF, mean, and variance", () => {
        for (const { mu, s } of [{ mu: 0, s: 1 }, { mu: 2, s: 3 }, { mu: -1, s: 0.5 }]) {
            const steps = 16;
            const frames = [...mod.run({ mu, s, steps })];
            checkFrames(frames, steps);
            const final = frames.at(-1)?.meta;
            const xs = final?.["xs"] as number[];
            const emittedPdf = final?.["pdf"] as number[];
            const emittedCdf = final?.["cdf"] as number[];
            xs.forEach((x, i) => {
                expect(emittedPdf[i]).toBeCloseTo(pdf(x, mu, s), 9);
                expect(emittedCdf[i]).toBeCloseTo(cdf(x, mu, s), 9);
            });
            expect(Number(final?.["mean"])).toBeCloseTo(mu, 9);
            expect(Number(final?.["variance"])).toBeCloseTo((Math.PI ** 2 * s * s) / 3, 9);
            expect(Number(final?.["median"])).toBeCloseTo(mu, 9);
        }
    });

    it("quantile inverts the CDF and the density integrates to one on a wide grid", () => {
        const s = 1;
        const mu = 0;
        const final = [...mod.run({ mu, s, steps: 500, halfWidth: 40 })].at(-1)?.meta;
        expect(Number(final?.["area"])).toBeCloseTo(1, 3);
        const q90 = Number(final?.["q90"]);
        expect(q90).toBeCloseTo(Math.log(9), 9);
        expect(cdf(q90, mu, s)).toBeCloseTo(0.9, 9);
        const cdfValues = final?.["cdf"] as number[];
        for (let i = 1; i < cdfValues.length; i += 1) expect(cdfValues[i] as number).toBeGreaterThanOrEqual(cdfValues[i - 1] as number);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
