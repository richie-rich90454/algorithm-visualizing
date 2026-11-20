/**
 * ordinary-least-squares.test.ts - Grid-search optimum, normal equations, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./ordinary-least-squares";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(2 * n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
    expect(frames[0]?.edges).toEqual([]);
    expect(frames[5]?.edges?.length).toBe(n - 1);
    for (const edge of frames[5]?.edges ?? []) {
        expect(frameHasNode(frames[5]!, edge.sourceId)).toBe(true);
        expect(frameHasNode(frames[5]!, edge.targetId)).toBe(true);
    }
}

function frameHasNode(frame: VisualFrame, id: string): boolean {
    return frame.entities.some((e) => e.id === id);
}

/** Minimize squared error over a fine slope grid, optimizing the intercept exactly. */
function gridSearchSlope(points: number[][]): number {
    const xs = points.map((p) => p[0]!);
    const ys = points.map((p) => p[1]!);
    const xbar = xs.reduce((a, b) => a + b, 0) / xs.length;
    const ybar = ys.reduce((a, b) => a + b, 0) / ys.length;
    let bestSlope = 0;
    let bestSse = Number.POSITIVE_INFINITY;
    for (let b = -5; b <= 5; b += 0.0005) {
        let sse = 0;
        for (let i = 0; i < xs.length; i += 1) {
            const residual = ys[i]! - (ybar + b * (xs[i]! - xbar));
            sse += residual * residual;
        }
        if (sse < bestSse) {
            bestSse = sse;
            bestSlope = b;
        }
    }
    return bestSlope;
}

describe("Ordinary least squares", () => {
    it("matches a brute-force slope search and satisfies the normal equations", () => {
        const datasets = [
            [[1, 2], [2, 4], [3, 5], [4, 4], [5, 7], [6, 8]],
            [[0, 1], [1, 0], [2, 4], [3, 6], [4, 8]],
            [[-2, -4], [-1, -1], [0, 1], [1, 3], [2, 5]],
        ];
        for (const points of datasets) {
            const frames = [...mod.run({ points })];
            checkFrames(frames, points.length);
            const meta = frames[frames.length - 1]?.meta;
            const slope = Number(meta?.["slope"]);
            expect(slope).toBeCloseTo(gridSearchSlope(points), 3);

            const xs = points.map((p) => p[0]!);
            const residuals = meta?.["residuals"] as number[];
            const residualSum = residuals.reduce((s, r) => s + r, 0);
            const xResidualSum = residuals.reduce((s, r, i) => s + xs[i]! * r, 0);
            expect(residualSum).toBeCloseTo(0, 9);
            expect(xResidualSum).toBeCloseTo(0, 9);

            const r2 = Number(meta?.["r2"]);
            expect(r2).toBeGreaterThanOrEqual(0);
            expect(r2).toBeLessThanOrEqual(1);
        }
    });

    it("reports fitted values that reproduce the line and a nonnegative error", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 6);
        const meta = frames[frames.length - 1]?.meta;
        const xs = meta?.["xs"] as number[];
        const ys = meta?.["ys"] as number[];
        const fitted = meta?.["fitted"] as number[];
        const slope = Number(meta?.["slope"]);
        const intercept = Number(meta?.["intercept"]);
        for (let i = 0; i < xs.length; i += 1) {
            expect(fitted[i]).toBeCloseTo(intercept + slope * xs[i]!, 9);
            expect((ys[i] ?? 0) - (fitted[i] ?? 0)).toBeCloseTo((meta?.["residuals"] as number[])[i]!, 9);
        }
        expect(Number(meta?.["sse"])).toBeGreaterThanOrEqual(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
