/** quantile-regression.test.ts - absolute-error objective, robustness to an outlier, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./quantile-regression";
import type { VisualFrame } from "@/types";

function absLoss(points: number[][], b0: number, b1: number): number {
    return points.reduce((s, p) => s + Math.abs(p[1]! - (b0 + b1 * p[0]!)), 0);
}
function olsFit(points: number[][]): { b0: number; b1: number } {
    const n = points.length;
    const xbar = points.reduce((s, p) => s + p[0]!, 0) / n;
    const ybar = points.reduce((s, p) => s + p[1]!, 0) / n;
    const sxx = points.reduce((s, p) => s + (p[0]! - xbar) ** 2, 0);
    const b1 = points.reduce((s, p) => s + (p[0]! - xbar) * (p[1]! - ybar), 0) / sxx;
    return { b0: ybar - b1 * xbar, b1 };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(2 * n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Quantile Regression", () => {
    it("reduces absolute error below the least-squares line and keeps it non-increasing", () => {
        const points = [[1, 2], [2, 4], [3, 3], [4, 6], [5, 5], [6, 9], [7, 8], [8, 12], [9, 30]];
        const frames = [...mod.run({ points, iterations: 40 })];
        checkFrames(frames, points.length);
        const meta = frames.at(-1)?.meta;
        const b0 = Number(meta?.["b0"]);
        const b1 = Number(meta?.["b1"]);
        const ols = olsFit(points);
        expect(absLoss(points, b0, b1)).toBeLessThanOrEqual(absLoss(points, ols.b0, ols.b1) + 1e-6);
        const losses = frames.map((f) => Number(f.meta["loss"]));
        for (let i = 1; i < losses.length; i += 1) expect(losses[i] as number).toBeLessThanOrEqual((losses[i - 1] as number) + 1e-6);
        const fitted = meta?.["fitted"] as number[];
        fitted.forEach((v, i) => expect(v).toBeCloseTo(b0 + b1 * points[i]![0], 8));
    });

    it("resists a single extreme outlier more than least squares", () => {
        const points = [[1, 2], [2, 4], [3, 3], [4, 6], [5, 5], [6, 9], [7, 8], [8, 12], [9, 60]];
        const meta = [...mod.run({ points, iterations: 60 })].at(-1)?.meta;
        const medianSlope = Number(meta?.["b1"]);
        expect(medianSlope).toBeLessThan(olsFit(points).b1);
        expect(medianSlope).toBeLessThan(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
