import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./annular-nearest-neighbor";

type Point = [number, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(f.layout).toBe(module.visualType);
        expect(f.meta).toBeDefined();
    });
}

function bruteDistance(points: Point[], query: Point, inner: number, outer: number): number {
    let best = Infinity;
    for (const p of points) {
        const dx = p[0] - query[0];
        const dy = p[1] - query[1];
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= inner && d <= outer && d < best) best = d;
    }
    return best;
}

describe("Annular Nearest Neighbor", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("matches brute-force annular distance on several inputs", () => {
        const points: Point[] = [[1, 1], [2, 5], [3, 3], [5, 5], [6, 2], [7, 7], [4, 6], [2, 2], [8, 4], [5, 1]];
        const cases: Array<[Point, number, number]> = [
            [[4, 4], 1, 3],
            [[0, 0], 2, 6],
            [[7, 7], 0, 2],
            [[3, 3], 4, 10],
            [[4, 4], 0, 100],
        ];
        for (const [query, inner, outer] of cases) {
            const frames = [...module.run({ points, query, inner, outer })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            const expected = bruteDistance(points, query, inner, outer);
            if (!Number.isFinite(expected)) {
                expect(last.meta.nearest).toBe(-1);
            } else {
                expect(last.meta.distance).toBeCloseTo(expected, 9);
                expect(last.meta.nearest).toBeGreaterThanOrEqual(0);
            }
        }
    });
});
