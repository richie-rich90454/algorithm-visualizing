/**
 * exponential-distribution.test.ts - Independent series reference, normalization, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./exponential-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBe(steps + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(steps + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent exp(-t) via its alternating power series, valid for t in [0, 12]. */
function expNeg(t: number): number {
    let term = 1;
    let sum = 1;
    for (let k = 1; k < 60; k += 1) {
        term *= -t / k;
        sum += term;
    }
    return sum;
}

describe("Exponential distribution", () => {
    it("matches an independent series evaluation of the density and CDF", () => {
        for (const lambda of [0.5, 1, 2]) {
            const frames = [...mod.run({ lambda, maxX: 5, steps: 10 })];
            checkFrames(frames, 10);
            const meta = frames[frames.length - 1]?.meta;
            const xs = meta?.["xs"] as number[];
            const pdf = meta?.["pdf"] as number[];
            const cdf = meta?.["cdf"] as number[];
            for (let i = 0; i < xs.length; i += 1) {
                expect(pdf[i]).toBeCloseTo(lambda * expNeg(lambda * (xs[i] ?? 0)), 9);
                expect(cdf[i]).toBeCloseTo(1 - expNeg(lambda * (xs[i] ?? 0)), 9);
            }
        }
    });

    it("normalizes, stays monotone, and reports the correct moments", () => {
        const frames = [...mod.run({ lambda: 1.5, maxX: 20, steps: 200 })];
        checkFrames(frames, 200);
        const meta = frames[frames.length - 1]?.meta;
        const pdf = meta?.["pdf"] as number[];
        const cdf = meta?.["cdf"] as number[];
        const trapezoid = pdf.reduce((s, v, k) => s + (k === 0 || k === pdf.length - 1 ? v / 2 : v), 0) * (20 / 200);
        expect(trapezoid).toBeCloseTo(1, 2);
        expect(Number(meta?.["area"])).toBeCloseTo(trapezoid, 10);
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i]!).toBeGreaterThanOrEqual(cdf[i - 1]!);
        }
        expect(Number(meta?.["mean"])).toBeCloseTo(1 / 1.5, 12);
        expect(Number(meta?.["variance"])).toBeCloseTo(1 / (1.5 * 1.5), 12);
        const meanFromCurve = pdf.reduce((s, v, k) => s + k * (20 / 200) * v, 0) * (20 / 200);
        expect(meanFromCurve).toBeCloseTo(1 / 1.5, 2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(15);
        expect(generator.next().done).toBe(true);
    });
});
