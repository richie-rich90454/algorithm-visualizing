/**
 * kd-tree-range-search.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./kd-tree-range-search";
import type { VisualFrame } from "@/types";

type Point = [number, number];
type Rect = { x1: number; y1: number; x2: number; y2: number };

function brute(points: Point[], r: Rect): number[] {
    const x1 = Math.min(r.x1, r.x2);
    const x2 = Math.max(r.x1, r.x2);
    const y1 = Math.min(r.y1, r.y2);
    const y2 = Math.max(r.y1, r.y2);
    return points
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p[0] >= x1 && p[0] <= x2 && p[1] >= y1 && p[1] <= y2)
        .map(({ i }) => i)
        .sort((a, b) => a - b);
}

function checkFrames(frames: VisualFrame[], pointCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(pointCount + 4);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function foundOf(frames: VisualFrame[]): number[] {
    const raw = (frames[frames.length - 1]?.meta["found"] as number[]) ?? [];
    return [...raw].sort((a, b) => a - b);
}

describe("KD-Tree Range Search", () => {
    it("matches brute force on the default query", () => {
        const input = mod.defaultInput as { points: Point[]; query: Rect };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        expect(foundOf(frames)).toEqual(brute(input.points, input.query));
    });

    it("matches brute force across many rectangles", () => {
        const points: Point[] = [
            [0, 0],
            [3, 5],
            [7, 2],
            [9, 9],
            [1, 8],
            [4, 4],
            [6, 1],
            [2, 2],
        ];
        const rects: Rect[] = [
            { x1: 0, y1: 0, x2: 10, y2: 10 },
            { x1: 2, y1: 2, x2: 6, y2: 6 },
            { x1: 100, y1: 100, x2: 200, y2: 200 },
            { x1: 3, y1: 5, x2: 3, y2: 5 },
            { x1: -5, y1: -5, x2: 4, y2: 4 },
            { x1: 7, y1: 1, x2: 2, y2: 8 },
        ];
        for (const rect of rects) {
            const frames = [...mod.run({ points, query: rect })];
            checkFrames(frames, points.length);
            expect(foundOf(frames)).toEqual(brute(points, rect));
        }
    });

    it("handles an empty point set", () => {
        const frames = [...mod.run({ points: [], query: { x1: 0, y1: 0, x2: 1, y2: 1 } })];
        expect(frames.length).toBeGreaterThan(0);
        expect(frames[frames.length - 1]?.meta["inside"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
