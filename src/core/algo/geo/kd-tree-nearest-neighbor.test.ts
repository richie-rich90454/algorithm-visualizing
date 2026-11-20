import { describe, expect, it } from "vitest";
import mod from "./kd-tree-nearest-neighbor";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function bruteForce(points: Point[], q: Point) {
    let best = Infinity;
    let index = -1;
    points.forEach((p, i) => {
        const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
        if (d < best) {
            best = d;
            index = i;
        }
    });
    return { best, index };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
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

describe("KD-Tree Nearest Neighbor", () => {
    it("finds the exact nearest neighbor on several fixed data sets", () => {
        const cases: Array<{ points: Point[]; query: Point }> = [
            {
                points: [
                    [1, 2],
                    [3, 1],
                    [5, 4],
                    [7, 2],
                    [2, 6],
                    [6, 6],
                    [8, 7],
                    [4, 8],
                ],
                query: [6, 3],
            },
            {
                points: [
                    [0, 0],
                    [10, 0],
                    [0, 10],
                    [10, 10],
                    [5, 5],
                ],
                query: [4, 6],
            },
            {
                points: [
                    [-3, -3],
                    [-1, 0],
                    [2, 2],
                    [5, -1],
                    [7, 4],
                    [1, 8],
                ],
                query: [0, 0],
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.points.length);
            const expected = bruteForce(testCase.points, testCase.query);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["bestDist"]).toBe(expected.best);
            const bestIndex = Number(final?.["bestIndex"]);
            const actual = testCase.points[bestIndex] as Point;
            expect((actual[0] - testCase.query[0]) ** 2 + (actual[1] - testCase.query[1]) ** 2).toBe(expected.best);
        }
    });

    it("matches brute force on a grid of query points", () => {
        const points: Point[] = [];
        for (let x = 0; x < 6; x += 1) {
            for (let y = 0; y < 6; y += 1) {
                points.push([x * 3 + (x % 2), y * 2]);
            }
        }
        for (const query of [
            [0, 0],
            [7, 5],
            [14, 9],
            [20, 3],
        ] as Point[]) {
            const frames = [...mod.run({ points, query })];
            checkFrames(frames, points.length);
            const expected = bruteForce(points, query);
            expect(Number(frames[frames.length - 1]?.meta["bestDist"])).toBe(expected.best);
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
