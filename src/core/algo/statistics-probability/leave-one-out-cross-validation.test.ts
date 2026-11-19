/**
 * leave-one-out-cross-validation.test.ts - Brute-force and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import mod, { fitLine, predict } from "./leave-one-out-cross-validation";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const meta = frame.meta as { rows: number; cols: number };
        expect(meta.rows).toBe(4);
        expect(meta.cols).toBe(n);
    });
}

/** Independently verify a fitted line by solving the 2x2 normal equations. */
function referenceFit(points: Point[]): { slope: number; intercept: number } {
    const n = points.length;
    let sx = 0;
    let sy = 0;
    let sx2 = 0;
    let sxy = 0;
    for (const [x, y] of points) {
        sx += x;
        sy += y;
        sx2 += x * x;
        sxy += x * y;
    }
    const det = n * sx2 - sx * sx;
    if (Math.abs(det) < 1e-12) {
        return { slope: 0, intercept: sy / n };
    }
    const slope = (n * sxy - sx * sy) / det;
    return { slope, intercept: (sy - slope * sx) / n };
}

describe("Leave-one-out cross-validation", () => {
    it("fits lines correctly against normal equations", () => {
        const sets: Point[][] = [
            [
                [0, 1],
                [1, 3],
                [2, 5],
                [3, 7],
            ],
            [
                [-2, 4],
                [0, 0],
                [2, -4],
                [4, -8],
            ],
        ];
        for (const points of sets) {
            const got = fitLine(points);
            const want = referenceFit(points);
            expect(got.slope).toBeCloseTo(want.slope, 9);
            expect(got.intercept).toBeCloseTo(want.intercept, 9);
            for (const [x, y] of points) {
                expect(predict(got, x)).toBeCloseTo(y, 6);
            }
        }
    });

    it("matches a completely independent brute-force LOOCV computation", () => {
        const cases: Point[][] = [
            [
                [1, 2.1],
                [2, 3.9],
                [3, 6.2],
                [4, 7.8],
                [5, 10.1],
            ],
            [
                [1, 1],
                [2, 4],
                [3, 9],
                [4, 16],
                [5, 25],
                [6, 36],
            ],
        ];
        for (const points of cases) {
            const frames = [...mod.run({ points })];
            checkFrames(frames, points.length);
            const final = frames[frames.length - 1]?.meta as {
                loocvMse: number;
                shortcutMse: number;
            };
            let expectedMse = 0;
            for (let i = 0; i < points.length; i += 1) {
                const reduced = points.filter((_, j) => j !== i);
                const fit = referenceFit(reduced);
                const held = points[i] as Point;
                const residual = held[1] - predict(fit, held[0]);
                expectedMse += residual * residual;
            }
            expectedMse /= points.length;
            expect(final.loocvMse).toBeCloseTo(expectedMse, 8);
            expect(final.shortcutMse).toBeCloseTo(expectedMse, 8);
        }
    });

    it("terminates and tolerates degenerate input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
        expect([...mod.run({ points: [] })].length).toBe(7);
    });
});
