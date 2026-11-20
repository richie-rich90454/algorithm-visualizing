/**
 * linear-regression-normal-equation.test.ts - Closed-form cross-check,
 * residual orthogonality, singular case, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./linear-regression-normal-equation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBe(6);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(3);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Closed-form least-squares fit derived from the two derivative conditions. */
function closedForm(xs: number[], ys: number[]): { w0: number; w1: number } {
    const n = xs.length;
    const sx = xs.reduce((a, b) => a + b, 0);
    const sy = ys.reduce((a, b) => a + b, 0);
    const sxx = xs.reduce((a, x) => a + x * x, 0);
    const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
    const det = n * sxx - sx * sx;
    const w1 = (n * sxy - sx * sy) / det;
    const w0 = (sy - w1 * sx) / n;
    return { w0, w1 };
}

describe("LinearRegressionNormalEquation", () => {
    it("matches the closed-form solution on the default input", () => {
        const input = mod.defaultInput as { xs: number[]; ys: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = closedForm(input.xs, input.ys);
        expect(Number(final?.["w0"])).toBeCloseTo(expected.w0, 8);
        expect(Number(final?.["w1"])).toBeCloseTo(expected.w1, 8);
    });

    it("matches closed form and has orthogonal residuals across many data sets", () => {
        const datasets: Array<{ xs: number[]; ys: number[] }> = [
            { xs: [0, 1, 2], ys: [1, 3, 5] },
            { xs: [-3, -1, 0, 2, 4], ys: [-6, -1, 1, 5, 9] },
            { xs: [10, 11, 12, 13], ys: [2, 4, 3, 7] },
            { xs: [1, 2, 4, 8, 16], ys: [3, 5, 9, 17, 33] },
        ];
        for (const data of datasets) {
            const frames = [...mod.run(data)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = closedForm(data.xs, data.ys);
            expect(Number(final?.["w0"])).toBeCloseTo(expected.w0, 8);
            expect(Number(final?.["w1"])).toBeCloseTo(expected.w1, 8);
            const residuals = final?.["residuals"] as number[];
            const sumResidual = residuals.reduce((a, b) => a + b, 0);
            const sumWeighted = residuals.reduce((a, r, i) => a + r * data.xs[i], 0);
            expect(sumResidual).toBeCloseTo(0, 8);
            expect(sumWeighted).toBeCloseTo(0, 8);
        }
    });

    it("reports a singular system when all x values are equal", () => {
        const frames = [...mod.run({ xs: [2, 2, 2], ys: [1, 2, 3] })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["singular"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
