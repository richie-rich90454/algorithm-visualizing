/** ransac-consensus.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./ransac-consensus";
import type { VisualFrame } from "@/types";

type Pt = [number, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function lineThrough(p: Pt, q: Pt): { a: number; b: number; c: number } {
    const a = -(q[1] - p[1]);
    const b = q[0] - p[0];
    const norm = Math.hypot(a, b);
    const na = a / norm;
    const nb = b / norm;
    return { a: na, b: nb, c: -(na * p[0] + nb * p[1]) };
}

/** Independent exhaustive pair search for the largest consensus set. */
function exhaustive(points: Pt[], threshold: number): number {
    let best = 0;
    for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
            const line = lineThrough(points[i]!, points[j]!);
            let count = 0;
            for (const p of points) {
                if (Math.abs(line.a * p[0] + line.b * p[1] + line.c) <= threshold) count += 1;
            }
            best = Math.max(best, count);
        }
    }
    return best;
}

describe("RANSAC Consensus", () => {
    it("finds the exhaustive maximum consensus with enough iterations", () => {
        const points: Pt[] = [
            [0, 1], [1, 1.5], [2, 2], [3, 2.5], [4, 3], [5, 3.5],
            [6, 4], [7, 4.5], [1, 8], [4, -2], [6, 9],
        ];
        const threshold = 0.4;
        const frames = [...mod.run({ points, threshold, iterations: 2000, seed: 11 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["bestCount"]).toBe(exhaustive(points, threshold));
        expect(Number(meta?.["finalCount"])).toBeGreaterThanOrEqual(8);
    });

    it("recovers a slope near the planted line", () => {
        const points = mod.defaultInput as { points: Pt[] };
        const frames = [...mod.run({ points: points.points, iterations: 500, seed: 3 })];
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["slope"])).toBeCloseTo(0.5, 1);
        expect(Number(meta?.["intercept"])).toBeCloseTo(1, 0);
    });

    it("is deterministic for a fixed seed", () => {
        const input = mod.defaultInput;
        const a = [...mod.run(input)];
        const b = [...mod.run(input)];
        expect(a.length).toBe(b.length);
        expect(a[a.length - 1]?.meta).toEqual(b[b.length - 1]?.meta);
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
