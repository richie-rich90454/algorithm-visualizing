/** slab-method-point-location.test.ts - Brute-force ray-casting cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./slab-method-point-location";
import type { VisualFrame } from "@/types";

type Point = [number, number];

/** Independent even-odd ray casting reference. */
function bruteInside(q: Point, polygon: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
        const [xi, yi] = polygon[i] as Point;
        const [xj, yj] = polygon[j] as Point;
        const crosses = yi > q[1] !== yj > q[1];
        if (crosses && q[0] < ((xj - xi) * (q[1] - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Slab Method Point Location", () => {
    it("agrees with brute-force ray casting for every query", () => {
        const input = mod.defaultInput as { polygon: Point[]; queries: Point[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const inside = (frames[frames.length - 1]?.meta["inside"] as number[]).map((v) => v === 1);
        expect(inside).toEqual(input.queries.map((q) => bruteInside(q, input.polygon)));
    });

    it("handles several polygons correctly", () => {
        const cases: Array<{ polygon: Point[]; queries: Point[] }> = [
            {
                polygon: [[0, 0], [4, 0], [4, 4], [0, 4]],
                queries: [[2, 2], [5, 2], [0.5, 3.5]],
            },
            {
                polygon: [[0, 0], [5, 0], [5, 5], [2, 2], [0, 5]],
                queries: [[1, 4], [3, 1], [4, 4]],
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const inside = (frames[frames.length - 1]?.meta["inside"] as number[]).map((v) => v === 1);
            expect(inside).toEqual(testCase.queries.map((q) => bruteInside(q, testCase.polygon)));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
