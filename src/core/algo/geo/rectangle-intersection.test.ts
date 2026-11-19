/** rectangle-intersection.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./rectangle-intersection";
import type { VisualFrame } from "@/types";

type Rect = [number, number, number, number];

/** Independent grid-sampling overlap check for integer rectangles. */
function sampledOverlap(a: Rect, b: Rect): boolean {
    for (let x = Math.max(a[0], b[0]) + 0.5; x < Math.min(a[2], b[2]); x += 1) {
        for (let y = Math.max(a[1], b[1]) + 0.5; y < Math.min(a[3], b[3]); y += 1) {
            return true;
        }
    }
    return false;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Rectangle Intersection", () => {
    it("agrees with grid sampling on overlap and computes the right area", () => {
        const a: Rect = [0, 0, 4, 3];
        const cases: Rect[] = [
            [3, 1, 6, 5],
            [5, 1, 7, 2],
            [1, 1, 2, 2],
            [-2, -2, 1, 1],
            [0, 3, 4, 6],
            [2, 0, 3, 3],
        ];
        for (const b of cases) {
            const frames = [...mod.run({ rectA: a, rectB: b })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = sampledOverlap(a, b);
            expect(final?.["intersect"], `overlap for ${b}`).toBe(expected);
            if (expected) {
                const ix1 = Math.max(a[0], b[0]);
                const iy1 = Math.max(a[1], b[1]);
                const ix2 = Math.min(a[2], b[2]);
                const iy2 = Math.min(a[3], b[3]);
                expect(final?.["area"]).toBe((ix2 - ix1) * (iy2 - iy1));
            } else {
                expect(final?.["area"]).toBe(0);
            }
        }
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
