/** chan-convex-hull.test.ts - Reference hull comparison, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./chan-convex-hull";

type Pt = [number, number];

function cross(o: Pt, a: Pt, b: Pt): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function referenceHull(points: Pt[]): Set<number> {
    if (points.length <= 1) {
        return new Set(points.map((_, i) => i));
    }
    const order = points.map((_, i) => i).sort((a, b) => points[a]![0] - points[b]![0] || points[a]![1] - points[b]![1]);
    const lower: number[] = [];
    const upper: number[] = [];
    for (const i of order) {
        while (lower.length >= 2 && cross(points[lower[lower.length - 2]!]!, points[lower[lower.length - 1]!]!, points[i]!) <= 0) {
            lower.pop();
        }
        lower.push(i);
    }
    for (const i of [...order].reverse()) {
        while (upper.length >= 2 && cross(points[upper[upper.length - 2]!]!, points[upper[upper.length - 1]!]!, points[i]!) <= 0) {
            upper.pop();
        }
        upper.push(i);
    }
    return new Set([...lower.slice(0, -1), ...upper.slice(0, -1)]);
}

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 2000; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(2000);
    return frames;
}

describe("Chan's Convex Hull", () => {
    it("wraps the same hull as a reference monotone chain", () => {
        const cases: Pt[][] = [
            [[0, 0], [4, 0], [4, 4], [0, 4], [2, 2]],
            [[0, 0], [1, 0], [2, 0], [3, 0]],
            [[0, 0], [5, 0], [1, 2], [4, 4], [0, 5], [6, 3], [3, 1]],
            [[2, 2]],
            [],
        ];
        for (const points of cases) {
            const frames = framesFor({ points });
            const final = frames[frames.length - 1]!;
            const hull = final.meta.hull as number[];
            const reference = referenceHull(points);
            expect(hull.length).toBe(reference.size);
            expect(hull.every((x) => reference.has(x))).toBe(true);
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(3);
        const ids = new Set(frames[0]!.entities.map((e) => e.id));
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(mod.pseudocode!.length);
            expect(frame.layout).toBe("point");
            expect(frame.entities.length).toBeGreaterThan(0);
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });
});
