/** incremental-convex-hull.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./incremental-convex-hull";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function cross(a: Point, b: Point, c: Point): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Independent monotone-chain hull, returned as an index set. */
function referenceHull(points: Point[]): Set<number> {
    const order = points
        .map((p, i) => ({ p, i }))
        .sort((x, y) => x.p[0] - y.p[0] || x.p[1] - y.p[1])
        .map((e) => e.i);
    const build = (seq: number[]): number[] => {
        const stack: number[] = [];
        for (const idx of seq) {
            while (stack.length >= 2) {
                if (cross(points[stack[stack.length - 2] as number] as Point, points[stack[stack.length - 1] as number] as Point, points[idx] as Point) <= 0) {
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
    return new Set([...lower, ...upper.slice(1, -1)]);
}

function checkFrames(frames: VisualFrame[], pointCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(pointCount);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Incremental Convex Hull", () => {
    it("matches an independent hull builder on several point sets", () => {
        const sets: Point[][] = [
            [[0, 3], [1, 1], [2, 2], [4, 4], [0, 0], [1, 2], [3, 1], [3, 3], [2, 4]],
            [[0, 0], [4, 0], [4, 4], [0, 4], [2, 2], [1, 3], [3, 1]],
            [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1]],
            [[2, 2], [0, 0], [5, 0], [5, 5], [0, 5]],
        ];
        for (const points of sets) {
            const frames = [...mod.run({ points })];
            checkFrames(frames, points.length);
            const final = frames[frames.length - 1]?.meta;
            const hull = final?.["hull"] as number[];
            expect(new Set(hull), `hull for ${JSON.stringify(points)}`).toEqual(referenceHull(points));
        }
    });

    it("keeps every intermediate hull convex", () => {
        const points: Point[] = [[0, 3], [1, 1], [2, 2], [4, 4], [0, 0], [1, 2], [3, 1], [3, 3], [2, 4]];
        const frames = [...mod.run({ points })];
        for (const frame of frames.slice(1)) {
            const hull = frame.meta["hull"] as number[];
            for (let i = 0; i < hull.length; i += 1) {
                if (hull.length < 3) {
                    break;
                }
                const a = points[hull[i] as number] as Point;
                const b = points[hull[(i + 1) % hull.length] as number] as Point;
                const c = points[hull[(i + 2) % hull.length] as number] as Point;
                expect(cross(a, b, c), `convex at step ${frame.stepNumber}`).toBeGreaterThanOrEqual(0);
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
