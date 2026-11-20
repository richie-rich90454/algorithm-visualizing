/**
 * monotone-polygon-triangulation.test.ts - Area-coverage property check,
 * frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./monotone-polygon-triangulation";
import type { VisualFrame } from "@/types";

type Point = [number, number];

/** Twice the signed area of a polygon given in boundary order. */
function twiceArea(poly: Point[]): number {
    let sum = 0;
    for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i] as Point;
        const b = poly[(i + 1) % poly.length] as Point;
        sum += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(sum);
}

/** Reconstruct the boundary order (upper left-to-right, lower right-to-left). */
function boundary(upper: Point[], lower: Point[]): Point[] {
    const result = upper.slice();
    for (let i = lower.length - 2; i >= 1; i -= 1) {
        result.push(lower[i] as Point);
    }
    return result;
}

/** Extract the triangle of each per-triangle frame. */
function triangleAreas(frames: VisualFrame[], points: Point[]): number[] {
    const areas: number[] = [];
    for (const frame of frames) {
        if (frame.edges.length === 3 && frame.edges[0]?.id.startsWith("tri-")) {
            const pts: Point[] = [];
            for (const edge of frame.edges) {
                const index = Number(edge.sourceId.replace("point-", ""));
                pts.push(points[index] as Point);
            }
            if (pts.every(Boolean)) {
                areas.push(twiceArea(pts));
            }
        }
    }
    return areas;
}

/** Check frame contract and termination. */
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

describe("Monotone Polygon Triangulation", () => {
    it("produces n-2 triangles whose areas cover the polygon", () => {
        const cases: Array<{ upper: Point[]; lower: Point[] }> = [
            {
                upper: [[0, 0], [2, 3], [5, 2], [8, 0]],
                lower: [[0, 0], [1, -2], [4, -1], [8, 0]],
            },
            {
                upper: [[0, 0], [3, 4], [7, 3], [10, 0]],
                lower: [[0, 0], [2, -3], [6, -2], [10, 0]],
            },
        ];
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames);
            const points = c.upper.concat(c.lower.slice(1, -1));
            const areas = triangleAreas(frames, points);
            expect(areas.length).toBe(points.length - 2);
            for (const area of areas) {
                expect(area).toBeGreaterThan(0);
            }
            const total = areas.reduce((a, b) => a + b, 0);
            expect(total).toBeCloseTo(twiceArea(boundary(c.upper, c.lower)), 6);
        }
    });

    it("handles a minimal monotone polygon", () => {
        const c = { upper: [[0, 0], [2, 2], [4, 0]] as Point[], lower: [[0, 0], [4, 0]] as Point[] };
        const frames = [...mod.run(c)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["triangles"]).toBe(1);
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
