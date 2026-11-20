/**
 * minimum-covariance-determinant.test.ts - Independent brute-force subset search, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./minimum-covariance-determinant";
import type { VisualFrame } from "@/types";

/** Independent bitmask enumeration of h-subsets. */
function subsets(n: number, h: number): number[][] {
    const result: number[][] = [];
    for (let mask = 0; mask < 1 << n; mask += 1) {
        let bits = 0;
        for (let i = 0; i < n; i += 1) bits += (mask >> i) & 1;
        if (bits === h) {
            const subset: number[] = [];
            for (let i = 0; i < n; i += 1) if ((mask >> i) & 1) subset.push(i);
            result.push(subset);
        }
    }
    return result;
}

/** Independent two-dimensional determinant of a subset's covariance. */
function det2(points: number[][], subset: number[]): number {
    const h = subset.length;
    let sx = 0;
    let sy = 0;
    for (const i of subset) {
        sx += points[i]?.[0] as number;
        sy += points[i]?.[1] as number;
    }
    const mx = sx / h;
    const my = sy / h;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (const i of subset) {
        const dx = (points[i]?.[0] as number) - mx;
        const dy = (points[i]?.[1] as number) - my;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
    }
    return (sxx * syy - sxy * sxy) / (h * h);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        const determinants = frame.meta["determinants"] as number[];
        expect(frame.entities.length).toBe(determinants.length);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Minimum Covariance Determinant", () => {
    it("finds the same winning subset as an independent brute-force search", () => {
        const points = [
            [0, 0], [0.3, 0.1], [0.1, 0.4], [0.2, 0.2], [0.4, 0.3], [8, 9], [9, 8],
        ];
        const h = 5;
        const frames = [...mod.run({ points, h })];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        const determinants = final?.meta["determinants"] as number[];
        const all = subsets(points.length, h);
        expect(determinants.length).toBe(all.length);
        const sortedModule = [...determinants].sort((a, b) => a - b);
        const sortedReference = all.map((subset) => det2(points, subset)).sort((a, b) => a - b);
        sortedModule.forEach((value, i) => expect(value).toBeCloseTo(sortedReference[i] as number, 12));
        const expectedBest = all.reduce((best, subset) => (det2(points, subset) < det2(points, best) ? subset : best), all[0] as number[]);
        expect(final?.meta["bestSubset"]).toEqual(expectedBest);
        expect(final?.meta["bestDet"] as number).toBeCloseTo(det2(points, expectedBest), 12);
        expect((final?.meta["bestDet"] as number)).toBeLessThanOrEqual(Math.min(...determinants) + 1e-15);
    });

    it("excludes the outlier in the default example", () => {
        const input = mod.defaultInput as { points: number[][]; h: number };
        const final = [...mod.run(input)].at(-1);
        const best = final?.meta["bestSubset"] as number[];
        expect(best).not.toContain(input.points.length - 1);
        expect(best.length).toBe(input.h);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
