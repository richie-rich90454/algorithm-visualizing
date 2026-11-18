/**
 * cubic-spline-interpolation.test.ts - Dense-solve reference, interpolation and continuity checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./cubic-spline-interpolation";
import type { VisualFrame } from "@/types";

interface Point {
    x: number;
    y: number;
}

function checkFrames(frames: VisualFrame[], samples: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(samples);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent dense Gaussian elimination for the interior second derivatives. */
function referenceM(points: Point[]): number[] {
    const n = points.length;
    const m = Array.from({ length: n }, () => 0);
    if (n < 3) {
        return m;
    }
    const size = n - 2;
    const h: number[] = [];
    for (let i = 0; i < n - 1; i += 1) {
        h.push(points[i + 1]!.x - points[i]!.x);
    }
    const rows: number[][] = Array.from({ length: size }, () => Array.from({ length: size + 1 }, () => 0));
    for (let i = 0; i < size; i += 1) {
        rows[i]![i] = 2 * (h[i]! + h[i + 1]!);
        if (i > 0) {
            rows[i]![i - 1] = h[i]!;
        }
        if (i < size - 1) {
            rows[i]![i + 1] = h[i + 1]!;
        }
        const left = (points[i + 1]!.y - points[i]!.y) / h[i]!;
        const right = (points[i + 2]!.y - points[i + 1]!.y) / h[i + 1]!;
        rows[i]![size] = 6 * (right - left);
    }
    for (let col = 0; col < size; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < size; row += 1) {
            if (Math.abs(rows[row]![col]!) > Math.abs(rows[pivot]![col]!)) {
                pivot = row;
            }
        }
        const tmp = rows[col]!;
        rows[col] = rows[pivot]!;
        rows[pivot] = tmp;
        const div = rows[col]![col]!;
        for (let j = col; j <= size; j += 1) {
            rows[col]![j]! /= div;
        }
        for (let row = 0; row < size; row += 1) {
            if (row === col) {
                continue;
            }
            const factor = rows[row]![col]!;
            for (let j = col; j <= size; j += 1) {
                rows[row]![j]! -= factor * rows[col]![j]!;
            }
        }
    }
    for (let i = 0; i < size; i += 1) {
        m[i + 1] = rows[i]![size]!;
    }
    return m;
}

function evaluate(points: Point[], m: number[], t: number): number {
    let i = 0;
    while (i < points.length - 2 && points[i + 1]!.x < t) {
        i += 1;
    }
    const xi = points[i]!.x;
    const xi1 = points[i + 1]!.x;
    const h = xi1 - xi;
    const a = (xi1 - t) / h;
    const b = (t - xi) / h;
    return (
        (m[i]! * a * a * a + m[i + 1]! * b * b * b) * h * h / 6 +
        (points[i]!.y - m[i]! * h * h / 6) * a +
        (points[i + 1]!.y - m[i + 1]! * h * h / 6) * b
    );
}

function slopeLeft(points: Point[], m: number[], i: number): number {
    const h = points[i]!.x - points[i - 1]!.x;
    return (
        m[i]! * h / 2 +
        (points[i]!.y - points[i - 1]!.y) / h -
        (m[i]! - m[i - 1]!) * h / 6
    );
}

function slopeRight(points: Point[], m: number[], i: number): number {
    const h = points[i + 1]!.x - points[i]!.x;
    return (
        -m[i]! * h / 2 +
        (points[i + 1]!.y - points[i]!.y) / h -
        (m[i + 1]! - m[i]!) * h / 6
    );
}

describe("Cubic spline interpolation", () => {
    it("matches an independent dense solve on the sample grid", () => {
        const cases: Point[][] = [
            [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
                { x: 2, y: 0 },
                { x: 3, y: 2 },
            ],
            [
                { x: -1, y: 2 },
                { x: 0, y: 0 },
                { x: 1, y: 3 },
                { x: 2, y: 1 },
                { x: 4, y: 5 },
            ],
            [
                { x: 0, y: 5 },
                { x: 2, y: 1 },
                { x: 5, y: 4 },
            ],
        ];
        for (const points of cases) {
            const samples = 11;
            const input = { points: points.map((p) => [p.x, p.y] as [number, number]), samples };
            const frames = [...mod.run(input)];
            checkFrames(frames, samples);
            const last = frames[frames.length - 1]?.meta ?? {};
            const m = referenceM(points);
            const expectedM = last["secondDerivatives"] as number[];
            expect(expectedM[0]).toBeCloseTo(0, 12);
            expect(expectedM[expectedM.length - 1]!).toBeCloseTo(0, 12);
            for (let i = 0; i < m.length; i += 1) {
                expect(expectedM[i]).toBeCloseTo(m[i]!, 9);
            }
            const values = last["sampleValues"] as number[];
            const grid = last["sampleXs"] as number[];
            for (let k = 0; k < grid.length; k += 1) {
                expect(values[k]).toBeCloseTo(evaluate(points, m, grid[k]!), 8);
            }
        }
    });

    it("interpolates every knot and has continuous first derivatives", () => {
        const points: Point[] = [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
            { x: 2, y: 0 },
            { x: 3, y: 2 },
        ];
        const frames = [...mod.run({ points: points.map((p) => [p.x, p.y] as [number, number]), samples: 9 })];
        checkFrames(frames, 9);
        const m = frames[frames.length - 1]?.meta["secondDerivatives"] as number[];
        for (const point of points) {
            expect(evaluate(points, m, point.x)).toBeCloseTo(point.y, 9);
        }
        for (let i = 1; i < points.length - 1; i += 1) {
            expect(slopeLeft(points, m, i)).toBeCloseTo(slopeRight(points, m, i), 9);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
