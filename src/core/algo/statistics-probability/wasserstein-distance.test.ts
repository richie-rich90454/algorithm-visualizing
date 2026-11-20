/**
 * wasserstein-distance.test.ts - Numerical integration and metric-property checks.
 */

import { describe, expect, it } from "vitest";
import mod, { wasserstein1 } from "./wasserstein-distance";
import type { VisualFrame } from "@/types";

/** Brute-force numeric integral of |CDF_x - CDF_y| on a fine grid. */
function numericIntegral(xs: number[], ys: number[]): number {
    const all = [...xs, ...ys];
    const low = Math.min(...all) - 1;
    const high = Math.max(...all) + 1;
    const steps = 40000;
    const h = (high - low) / steps;
    let sum = 0;
    for (let i = 0; i <= steps; i += 1) {
        const t = low + i * h;
        const cx = xs.filter((v) => v <= t).length / xs.length;
        const cy = ys.filter((v) => v <= t).length / ys.length;
        sum += Math.abs(cx - cy);
    }
    return sum * h;
}

function checkFrames(frames: VisualFrame[], cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2 * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(2);
    });
}

describe("Wasserstein Distance", () => {
    it("equals a brute-force numerical integral of the CDF gap", () => {
        const cases: Array<[number[], number[]]> = [
            [[0, 1, 2, 3, 4], [2, 3, 4, 5, 6]],
            [[1, 1, 1, 1], [0, 2]],
            [[-2, -1, 0, 1, 2], [0]],
            [[0, 5, 10], [2, 3, 4, 9]],
        ];
        for (const [xs, ys] of cases) {
            const result = wasserstein1(xs, ys);
            const numeric = numericIntegral(xs, ys);
            expect(Math.abs(result.distance - numeric)).toBeLessThan(0.02);
        }
    });

    it("matches the rank-paired closed form for equal sample sizes", () => {
        const cases: Array<[number[], number[]]> = [
            [[0, 1, 2, 3, 4], [2, 3, 4, 5, 6]],
            [[5, -1, 3, 0], [1, 2, 4, 8]],
            [[1, 1, 2, 2], [0, 0, 3, 3]],
        ];
        for (const [xs, ys] of cases) {
            const result = wasserstein1(xs, ys);
            expect(result.distance).toBeCloseTo(result.equalCountValue, 10);
        }
    });

    it("satisfies identity, symmetry, and the triangle inequality", () => {
        const a = [0, 1, 4];
        const b = [2, 3, 5];
        const c = [1, 1, 9];
        expect(wasserstein1(a, a).distance).toBe(0);
        expect(wasserstein1(a, b).distance).toBeCloseTo(wasserstein1(b, a).distance, 12);
        expect(wasserstein1(a, c).distance).toBeLessThanOrEqual(
            wasserstein1(a, b).distance + wasserstein1(b, c).distance + 1e-12,
        );
    });

    it("reports the distance in well-formed sweep frames", () => {
        const input = mod.defaultInput as { xs: number[]; ys: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, Math.max(input.xs.length, input.ys.length));
        const expected = wasserstein1(input.xs, input.ys);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["distance"])).toBeCloseTo(expected.distance, 12);
        expect(final?.["contributions"]).toEqual(expected.contributions);
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
