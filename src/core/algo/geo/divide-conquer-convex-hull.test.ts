/**
 * divide-conquer-convex-hull.test.ts - Brute-force (gift-wrapping) cross-check,
 * frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./divide-conquer-convex-hull";
import type { VisualFrame } from "@/types";

type Point = [number, number];

/** Independent O(nh) Jarvis-march reference hull. */
function giftWrap(points: Point[]): Point[] {
    if (points.length < 3) {
        return points.slice();
    }
    const key = (p: Point): string => `${p[0]},${p[1]}`;
    let start = 0;
    for (let i = 1; i < points.length; i += 1) {
        const p = points[i] as Point;
        const s = points[start] as Point;
        if (p[0] < s[0] || (p[0] === s[0] && p[1] < s[1])) {
            start = i;
        }
    }
    const hull: Point[] = [];
    let current = start;
    for (let guard = 0; guard <= points.length; guard += 1) {
        hull.push(points[current] as Point);
        let next = (current + 1) % points.length;
        for (let i = 0; i < points.length; i += 1) {
            if (i === current) {
                continue;
            }
            const a = points[current] as Point;
            const b = points[next] as Point;
            const c = points[i] as Point;
            const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
            if (cross < 0 || (cross === 0 && (c[0] - a[0]) ** 2 + (c[1] - a[1]) ** 2 > (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)) {
                next = i;
            }
        }
        if (next === start) {
            break;
        }
        current = next;
    }
    const unique = new Map<string, Point>();
    for (const p of hull) {
        unique.set(key(p), p);
    }
    return [...unique.values()];
}

/** Check that a frame sequence is well formed and terminates. */
function checkFrames(frames: VisualFrame[], expectedPoints: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(expectedPoints);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Extract the hull vertex coordinates from the final frame's edges. */
function hullVertices(frames: VisualFrame[], points: Point[]): Set<string> {
    const final = frames[frames.length - 1] as VisualFrame;
    const result = new Set<string>();
    for (const edge of final.edges) {
        const index = Number(edge.sourceId.replace("point-", ""));
        const p = points[index] as Point;
        result.add(`${p[0]},${p[1]}`);
    }
    return result;
}

describe("Divide-and-Conquer Convex Hull", () => {
    it("matches an independent gift-wrapping hull", () => {
        const datasets: Point[][] = [
            [[0, 0], [4, 0], [5, 3], [2, 5], [-1, 3], [1, 2], [3, 1], [2, 2]],
            [[0, 0], [1, 0], [2, 0], [2, 2], [0, 2]],
            [[-3, -3], [3, -3], [3, 3], [-3, 3], [0, 0], [1, 1], [-1, 2]],
        ];
        for (const points of datasets) {
            const frames = [...mod.run({ points })];
            checkFrames(frames, points.length);
            const expected = new Set(giftWrap(points).map((p) => `${p[0]},${p[1]}`));
            const actual = hullVertices(frames, points);
            expect(actual.size).toBe(expected.size);
            for (const v of expected) {
                expect(actual.has(v)).toBe(true);
            }
        }
    });

    it("handles a small point set", () => {
        const points: Point[] = [[0, 0], [1, 0], [0, 1]];
        const frames = [...mod.run({ points })];
        checkFrames(frames, points.length);
        expect(hullVertices(frames, points).size).toBe(3);
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
