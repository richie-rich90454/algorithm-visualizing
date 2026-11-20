/**
 * regression-discontinuity.test.ts - Independent weighted-least-squares
 * reference, jump properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./regression-discontinuity";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Reference local intercept via brute-force normal equations. */
function referenceIntercept(points: Point[], cutoff: number, h: number, side: -1 | 1): number | null {
    const kept = points.filter((p) => {
        const u = p[0] - cutoff;
        return (side === 1 ? u >= 0 : u <= 0) && Math.abs(u) <= h;
    });
    let s0 = 0; let s1 = 0; let s2 = 0; let t0 = 0; let t1 = 0;
    for (const p of kept) {
        const u = p[0] - cutoff;
        const w = 1 - Math.abs(u) / h;
        s0 += w; s1 += w * u; s2 += w * u * u; t0 += w * p[1]; t1 += w * u * p[1];
    }
    const det = s0 * s2 - s1 * s1;
    return Math.abs(det) < 1e-12 ? null : (s2 * t0 - s1 * t1) / det;
}

describe("RegressionDiscontinuity", () => {
    it("matches an independent local-linear reference", () => {
        const input = mod.defaultInput as { points: Point[]; cutoff: number; bandwidth: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const meta = frames[frames.length - 1]!.meta;
        const left = referenceIntercept(input.points, input.cutoff, input.bandwidth, -1);
        const right = referenceIntercept(input.points, input.cutoff, input.bandwidth, 1);
        expect(meta["left"]).toBeCloseTo(left!, 10);
        expect(meta["right"]).toBeCloseTo(right!, 10);
        expect(meta["effect"]).toBeCloseTo(right! - left!, 10);
    });

    it("recovers a known constant jump at the cutoff", () => {
        const points: Point[] = [];
        for (let x = -2; x <= 2; x += 0.5) {
            if (x === 0) {
                continue;
            }
            const shift = x > 0 ? 5 : 0;
            points.push([x, 10 + 2 * x + shift]);
        }
        const meta = [...mod.run({ points, cutoff: 0, bandwidth: 2 })].pop()!.meta;
        expect(meta["effect"]).toBeCloseTo(5, 8);
    });

    it("returns zero effect when both sides follow the same line", () => {
        const points: Point[] = [[-2, 6], [-1, 8], [1, 12], [2, 14]];
        const meta = [...mod.run({ points, cutoff: 0, bandwidth: 2 })].pop()!.meta;
        expect(meta["effect"]).toBeCloseTo(0, 8);
    });

    it("handles empty input and terminates cleanly", () => {
        const empty = [...mod.run({ points: [] })];
        expect(empty).toHaveLength(1);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe((mod.defaultInput as { points: Point[] }).points.length + 2);
        expect(generator.next().done).toBe(true);
    });
});
