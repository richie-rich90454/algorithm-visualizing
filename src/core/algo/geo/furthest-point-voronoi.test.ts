/** furthest-point-voronoi.test.ts - Hull reference, bisector geometry, and frames. */

import { describe, expect, it } from "vitest";
import mod from "./furthest-point-voronoi";

type Pt = [number, number];

function cross(o: Pt, a: Pt, b: Pt): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function refHull(points: Pt[]): Set<number> {
    const order = points.map((_, i) => i).sort((a, b) => points[a]![0] - points[b]![0] || points[a]![1] - points[b]![1]);
    const lower: number[] = [];
    const upper: number[] = [];
    for (const i of order) {
        while (lower.length >= 2 && cross(points[lower[lower.length - 2]!]!, points[lower[lower.length - 1]!]!, points[i]!) <= 0) lower.pop();
        lower.push(i);
    }
    for (const i of [...order].reverse()) {
        while (upper.length >= 2 && cross(points[upper[upper.length - 2]!]!, points[upper[upper.length - 1]!]!, points[i]!) <= 0) upper.pop();
        upper.push(i);
    }
    return new Set([...lower.slice(0, -1), ...upper.slice(0, -1)]);
}

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 500; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(500);
    return frames;
}

const SETS: Pt[][] = [
    [[0, 0], [4, 0], [5, 3], [2, 5], [-1, 3], [2, 2], [3, 1]],
    [[0, 0], [4, 0], [4, 4], [0, 4], [2, 2], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [3, 0], [3, 3], [0, 3]],
];

describe("Farthest-Point Voronoi Diagram", () => {
    it("keeps exactly the hull vertices as cell owners", () => {
        for (const points of SETS) {
            const final = framesFor({ points }).slice(-1)[0]!;
            const hull = final.meta.hull as number[];
            const reference = refHull(points);
            expect(new Set(hull).size).toBe(hull.length);
            expect(hull.length).toBe(reference.size);
            for (const i of hull) expect(reference.has(i)).toBe(true);
            expect(final.meta.bisectors as number[]).toHaveLength(hull.length * 4);
        }
    });

    it("draws true perpendicular bisectors of consecutive hull pairs", () => {
        for (const points of SETS) {
            const final = framesFor({ points }).slice(-1)[0]!;
            const hull = final.meta.hull as number[];
            const flat = final.meta.bisectors as number[];
            for (let i = 0; i < hull.length; i += 1) {
                const a = points[hull[i]!]!;
                const b = points[hull[(i + 1) % hull.length]!]!;
                const ax = flat[i * 4]!, ay = flat[i * 4 + 1]!, bx = flat[i * 4 + 2]!, by = flat[i * 4 + 3]!;
                const sx = b[0] - a[0], sy = b[1] - a[1];
                const dx = bx - ax, dy = by - ay;
                expect(sx * dx + sy * dy).toBeCloseTo(0, 8);
                const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
                const lineMidX = (ax + bx) / 2, lineMidY = (ay + by) / 2;
                expect((lineMidX - mx) * sx + (lineMidY - my) * sy).toBeCloseTo(0, 8);
            }
        }
    });

    it("only lets hull vertices win a brute-force farthest query", () => {
        const points = SETS[0]!;
        const final = framesFor({ points }).slice(-1)[0]!;
        const hull = new Set(final.meta.hull as number[]);
        for (let qx = -3; qx <= 8; qx += 1) {
            for (let qy = -3; qy <= 8; qy += 1) {
                const query: Pt = [qx, qy];
                let best = -1;
                let bestD = -Infinity;
                points.forEach((p, i) => {
                    const d = (p[0] - query[0]) ** 2 + (p[1] - query[1]) ** 2;
                    if (d > bestD) {
                        bestD = d;
                        best = i;
                    }
                });
                expect(hull.has(best)).toBe(true);
            }
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber!).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(mod.pseudocode!.length);
            expect(frame.layout).toBe("point");
            const ids = new Set(frame.entities.map((e) => e.id));
            for (const entity of frame.entities) {
                expect(Number.isFinite(entity.x)).toBe(true);
                expect(Number.isFinite(entity.y)).toBe(true);
            }
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });
});
