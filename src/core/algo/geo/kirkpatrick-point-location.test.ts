/**
 * kirkpatrick-point-location.test.ts - Independent point-in-triangle property
 * check, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./kirkpatrick-point-location";
import type { VisualFrame } from "@/types";

type Point = [number, number];

/** Independent point-in-triangle test using cross-product signs. */
function contains(p: Point, a: Point, b: Point, c: Point): boolean {
    const cross = (u: Point, v: Point, w: Point): number =>
        (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
    const d1 = cross(a, b, p);
    const d2 = cross(b, c, p);
    const d3 = cross(c, a, p);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

const points: Point[] = [[0, 0], [12, 0], [6, 10], [6, 5], [4, 2], [8, 2], [6, 2], [5, 4], [7, 4]];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Kirkpatrick Point Location", () => {
    it("locates several query points in a triangle that contains them", () => {
        const queries: Point[] = [[6, 3], [5.5, 3.5], [7, 2.5], [6, 6], [4.5, 2.5]];
        for (const query of queries) {
            const frames = [...mod.run({ points, query })];
            checkFrames(frames);
            const final = frames[frames.length - 1] as VisualFrame;
            const leaf = final.meta["leaf"] as number[];
            expect(leaf.length).toBe(3);
            const a = points[leaf[0] as number] as Point;
            const b = points[leaf[1] as number] as Point;
            const c = points[leaf[2] as number] as Point;
            expect(contains(query, a, b, c)).toBe(true);

            for (const frame of frames) {
                const tri = frame.meta["triangle"] as number[] | undefined;
                if (tri && tri.length === 3) {
                    const ta = points[tri[0] as number] as Point;
                    const tb = points[tri[1] as number] as Point;
                    const tc = points[tri[2] as number] as Point;
                    expect(contains(query, ta, tb, tc)).toBe(true);
                }
            }
        }
    });

    it("reports an outside point as outside", () => {
        const frames = [...mod.run({ points, query: [0, 20] })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["leaf"]).toEqual([]);
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
