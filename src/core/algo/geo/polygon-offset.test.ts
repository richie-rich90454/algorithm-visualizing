/** polygon-offset.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./polygon-offset";
import type { VisualFrame } from "@/types";

type Point = [number, number];

/** Rebuild points from the flat coordinate array stored in frame meta. */
function toPoints(flat: number[]): Point[] {
    const result: Point[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
        result.push([flat[i] as number, flat[i + 1] as number]);
    }
    return result;
}

function cross(a: Point, b: Point, c: Point): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function pointLineDistance(p: Point, a: Point, b: Point): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    return Math.abs(cross(a, b, p)) / Math.hypot(dx, dy);
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

describe("Convex Polygon Offset", () => {
    it("places every offset vertex at the correct distance from its edges", () => {
        const polygon: Point[] = [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
        ];
        const distance = 1;
        const frames = [...mod.run({ polygon, distance })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const offset = toPoints(final?.["offset"] as number[]);
        expect(offset.length).toBe(polygon.length);
        for (let i = 0; i < offset.length; i += 1) {
            const vertex = offset[i] as Point;
            const edgeEnd = polygon[(i + 1) % polygon.length] as Point;
            expect(pointLineDistance(vertex, polygon[i] as Point, edgeEnd)).toBeCloseTo(distance, 6);
        }
        expect(final?.["area"] as number).toBeGreaterThan(final?.["originalArea"] as number);
        // The original polygon is contained in the expanded one.
        for (const point of polygon) {
            for (let i = 0; i < offset.length; i += 1) {
                expect(cross(offset[i] as Point, offset[(i + 1) % offset.length] as Point, point)).toBeGreaterThanOrEqual(-1e-6);
            }
        }
    });

    it("matches the analytic offset of a unit square", () => {
        const frames = [...mod.run({ polygon: [[0, 0], [1, 0], [1, 1], [0, 1]], distance: 0.5 })];
        const offset = toPoints(frames[frames.length - 1]?.meta["offset"] as number[]);
        expect(offset[0]?.[0]).toBeCloseTo(1.5, 6);
        expect(offset[0]?.[1]).toBeCloseTo(-0.5, 6);
        expect(offset[2]?.[0]).toBeCloseTo(-0.5, 6);
        expect(offset[2]?.[1]).toBeCloseTo(1.5, 6);
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
