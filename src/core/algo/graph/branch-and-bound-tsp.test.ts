/**
 * branch-and-bound-tsp.test.ts - Brute-force optimality check, frame shape, and
 * termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./branch-and-bound-tsp";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((entity) => entity.id));
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

function tourLength(points: Point[], order: number[]): number {
    let total = 0;
    for (let i = 0; i < order.length; i += 1) {
        const a = points[order[i] ?? 0];
        const b = points[order[(i + 1) % order.length] ?? 0];
        if (a && b) {
            total += Math.hypot(a[0] - b[0], a[1] - b[1]);
        }
    }
    return total;
}

/** Independent reference: enumerate every permutation that starts at city zero. */
function bruteForce(points: Point[]): number {
    let best = Infinity;
    const rest = points.map((_p, i) => i).slice(1);
    const permute = (prefix: number[], remaining: number[]): void => {
        if (remaining.length === 0) {
            best = Math.min(best, tourLength(points, prefix));
            return;
        }
        for (let i = 0; i < remaining.length; i += 1) {
            const next = remaining[i];
            if (next === undefined) {
                continue;
            }
            permute([...prefix, next], remaining.filter((_v, j) => j !== i));
        }
    };
    permute([0], rest);
    return best;
}

describe("Branch and Bound TSP", () => {
    it("finds the brute-force optimal tour", () => {
        const points = (mod.defaultInput as { points: Point[] }).points;
        const frames = [...mod.run({ points })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const bestTour = meta?.["bestTour"] as number[];
        expect(bestTour).toHaveLength(points.length);
        expect([...bestTour].sort((a, b) => a - b)).toEqual(points.map((_p, i) => i));
        expect(tourLength(points, bestTour)).toBeCloseTo(bruteForce(points), 9);
        expect(Number(meta?.["bestLength"])).toBeCloseTo(bruteForce(points), 9);
    });

    it("matches brute force on other small city sets", () => {
        const cases: Point[][] = [
            [[0, 0], [2, 0], [2, 2], [0, 2]],
            [[0, 0], [1, 0], [1, 1], [0, 1], [2, 3]],
            [[-2, -1], [3, 0], [0, 4], [5, 5]],
        ];
        for (const points of cases) {
            const frames = [...mod.run({ points })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(Number(meta?.["bestLength"])).toBeCloseTo(bruteForce(points), 9);
        }
    });

    it("handles tiny inputs", () => {
        const two = [...mod.run({ points: [[0, 0], [3, 4]] })];
        checkFrames(two);
        expect(Number(two[two.length - 1]?.meta["bestLength"])).toBeCloseTo(10, 9);
        const one = [...mod.run({ points: [[0, 0]] })];
        checkFrames(one);
        expect(Number(one[one.length - 1]?.meta["bestLength"])).toBe(0);
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
