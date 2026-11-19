/** euclidean-shortest-path.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./euclidean-shortest-path";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function dist(a: Point, b: Point): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Independent visibility test by dense sampling along the segment. */
function clearBySampling(a: Point, b: Point, points: Point[], i: number, j: number): boolean {
    for (let step = 1; step < 400; step += 1) {
        const t = step / 400;
        const x = a[0] + t * (b[0] - a[0]);
        const y = a[1] + t * (b[1] - a[1]);
        for (let m = 0; m < points.length; m += 1) {
            if (m === i || m === j) {
                continue;
            }
            if (dist([x, y], points[m] as Point) < 0.02) {
                return false;
            }
        }
    }
    return true;
}

/** Floyd-Warshall reference shortest path on an independently built graph. */
function referenceDistance(points: Point[]): number {
    const k = points.length;
    const d: number[][] = Array.from({ length: k }, (_, i) =>
        Array.from({ length: k }, (_, j) => (i === j ? 0 : Number.POSITIVE_INFINITY)),
    );
    for (let i = 0; i < k; i += 1) {
        for (let j = i + 1; j < k; j += 1) {
            if (clearBySampling(points[i] as Point, points[j] as Point, points, i, j)) {
                const len = dist(points[i] as Point, points[j] as Point);
                d[i]![j] = len;
                d[j]![i] = len;
            }
        }
    }
    for (let m = 0; m < k; m += 1) {
        for (let i = 0; i < k; i += 1) {
            for (let j = 0; j < k; j += 1) {
                d[i]![j] = Math.min(d[i]![j] as number, (d[i]![m] as number) + (d[m]![j] as number));
            }
        }
    }
    return d[0]![1] as number;
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

describe("Euclidean Shortest Path", () => {
    it("matches an independent visibility graph and Floyd-Warshall reference", () => {
        const cases: Array<{ start: Point; goal: Point; obstacles: Point[] }> = [
            { start: [0, 0], goal: [6, 0], obstacles: [] },
            { start: [0, 0], goal: [6, 0], obstacles: [[3, 1]] },
            {
                start: [0, 0],
                goal: [6, 0],
                obstacles: [[3, 0.5], [3, -0.5]],
            },
            {
                start: [0, 0],
                goal: [6, 0],
                obstacles: [[2, 1], [3, -1], [4, 1]],
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            const points: Point[] = [testCase.start, testCase.goal, ...testCase.obstacles];
            checkFrames(frames, points.length);
            const actual = frames[frames.length - 1]?.meta["distance"] as number;
            expect(actual, `distance for ${JSON.stringify(testCase.obstacles)}`).toBeCloseTo(
                referenceDistance(points),
                1,
            );
        }
    });

    it("returns a start-to-goal route with clear segments", () => {
        const input = mod.defaultInput as { start: Point; goal: Point; obstacles: Point[] };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        const path = final?.["path"] as number[];
        const points: Point[] = [input.start, input.goal, ...input.obstacles];
        expect(path[0]).toBe(0);
        expect(path[path.length - 1]).toBe(1);
        for (let i = 0; i < path.length - 1; i += 1) {
            const a = path[i] as number;
            const b = path[i + 1] as number;
            expect(clearBySampling(points[a] as Point, points[b] as Point, points, a, b)).toBe(true);
        }
        let length = 0;
        for (let i = 0; i < path.length - 1; i += 1) {
            length += dist(points[path[i] as number] as Point, points[path[i + 1] as number] as Point);
        }
        expect(length).toBeCloseTo(final?.["distance"] as number, 6);
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
