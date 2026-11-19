/**
 * newton-divided-differences.test.ts - Lagrange cross-check and interpolation
 * property at the sample points, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./newton-divided-differences";
import type { VisualFrame } from "@/types";

function lagrange(points: Array<[number, number]>, x: number): number {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
        let term = points[i]![1];
        for (let j = 0; j < points.length; j += 1) {
            if (i === j) continue;
            term *= (x - points[j]![0]) / (points[i]![0] - points[j]![0]);
        }
        sum += term;
    }
    return sum;
}

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
        expect(frame.meta).toBeDefined();
    });
}

describe("NewtonDividedDifferences", () => {
    it("matches Lagrange interpolation at arbitrary query points", () => {
        const cases: Array<{ points: Array<[number, number]>; query: number }> = [
            { points: [[0, 1], [1, 3], [2, 7]], query: 1.5 },
            { points: [[-2, 4], [0, 0], [1, 1], [3, 9]], query: 2.25 },
            { points: [[0, 0], [1, 1], [2, 8], [3, 27], [4, 64]], query: 2.5 },
        ];
        for (const { points, query } of cases) {
            const frames = [...mod.run({ points, query })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]!.meta;
            expect(meta["value"]).toBeCloseTo(lagrange(points, query), 9);
            expect((meta["coefficients"] as number[]).length).toBe(points.length);
        }
    });

    it("reproduces every sample value exactly", () => {
        const points: Array<[number, number]> = [[0, 1], [1, 3], [2, 7]];
        for (const [xi, yi] of points) {
            const frames = [...mod.run({ points, query: xi })];
            checkFrames(frames);
            expect(frames[frames.length - 1]!.meta["value"]).toBeCloseTo(yi, 9);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
