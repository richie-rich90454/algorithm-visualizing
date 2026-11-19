/** convex-hull-verification.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./convex-hull-verification";
import type { VisualFrame } from "@/types";

type Point = [number, number];

/** Independent monotone-chain hull over indexed points. */
function referenceHull(points: Point[]): number[] {
    const order = points
        .map((p, i) => ({ p, i }))
        .sort((x, y) => x.p[0] - y.p[0] || x.p[1] - y.p[1])
        .map((e) => e.i);
    const cross = (a: Point, b: Point, c: Point): number =>
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const build = (indices: number[]): number[] => {
        const stack: number[] = [];
        for (const idx of indices) {
            while (stack.length >= 2) {
                const a = points[stack[stack.length - 2] as number] as Point;
                const b = points[stack[stack.length - 1] as number] as Point;
                const c = points[idx] as Point;
                if (cross(a, b, c) <= 0) {
                    stack.pop();
                } else {
                    break;
                }
            }
            stack.push(idx);
        }
        return stack;
    };
    const lower = build(order);
    const upper = build([...order].reverse());
    return [...lower, ...upper.slice(1, -1)];
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

describe("Convex Hull Verification", () => {
    it("accepts the true hull from an independent monotone-chain builder", () => {
        const sets: Point[][] = [
            [[0, 0], [4, 0], [4, 3], [0, 3], [2, 1]],
            [[0, 0], [5, 0], [4, 2], [2, 4], [0, 2], [1, 1]],
            [[0, 0], [1, 3], [2, 1], [4, 4], [5, 0], [3, -1]],
        ];
        for (const points of sets) {
            const hull = referenceHull(points);
            const frames = [...mod.run({ points, hull })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["valid"], `true hull for ${JSON.stringify(points)}`).toBe(true);
        }
    });

    it("rejects incomplete, non-convex, and duplicated hulls", () => {
        const points: Point[] = [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
            [2, 1],
        ];
        const badHulls = [
            [0, 1, 2],
            [0, 1, 4, 2, 3],
            [0, 1, 2, 0],
        ];
        for (const hull of badHulls) {
            const frames = [...mod.run({ points, hull })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["valid"], `hull ${hull}`).toBe(false);
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
