/** triangular-distribution.test.ts - closed-form pdf/cdf/moments, integration properties, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./triangular-distribution";
import type { VisualFrame } from "@/types";

function pdf(x: number, a: number, b: number, c: number): number {
    if (x < a || x > b) return 0;
    return x <= c ? (2 * (x - a)) / ((b - a) * (c - a)) : (2 * (b - x)) / ((b - a) * (b - c));
}
function cdf(x: number, a: number, b: number, c: number): number {
    if (x <= a) return 0;
    if (x >= b) return 1;
    return x <= c ? (x - a) ** 2 / ((b - a) * (c - a)) : 1 - (b - x) ** 2 / ((b - a) * (b - c));
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

describe("Triangular Distribution", () => {
    it("matches closed-form density, CDF, mean, variance, and median", () => {
        const params = [{ a: 0, b: 4, c: 1 }, { a: -2, b: 3, c: 0 }, { a: 1, b: 9, c: 7 }];
        for (const { a, b, c } of params) {
            const steps = 16;
            const frames = [...mod.run({ a, b, c, steps })];
            checkFrames(frames, steps);
            const final = frames.at(-1)?.meta;
            const xs = final?.["xs"] as number[];
            const emittedPdf = final?.["pdf"] as number[];
            const emittedCdf = final?.["cdf"] as number[];
            xs.forEach((x, i) => {
                expect(emittedPdf[i]).toBeCloseTo(pdf(x, a, b, c), 9);
                expect(emittedCdf[i]).toBeCloseTo(cdf(x, a, b, c), 9);
            });
            expect(Number(final?.["mean"])).toBeCloseTo((a + b + c) / 3, 9);
            expect(Number(final?.["variance"])).toBeCloseTo((a * a + b * b + c * c - a * b - a * c - b * c) / 18, 9);
            const expectedMedian = c <= (a + b) / 2
                ? a + Math.sqrt(((b - a) * (c - a)) / 2)
                : b - Math.sqrt(((b - a) * (b - c)) / 2);
            expect(Number(final?.["median"])).toBeCloseTo(expectedMedian, 9);
            expect(emittedCdf.at(-1)).toBeCloseTo(1, 9);
        }
    });

    it("density integrates to one on a fine grid and the CDF is monotone", () => {
        const final = [...mod.run({ a: 0, b: 4, c: 1, steps: 400 })].at(-1)?.meta;
        expect(Number(final?.["area"])).toBeCloseTo(1, 3);
        const cdf = final?.["cdf"] as number[];
        for (let i = 1; i < cdf.length; i += 1) expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] as number);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
