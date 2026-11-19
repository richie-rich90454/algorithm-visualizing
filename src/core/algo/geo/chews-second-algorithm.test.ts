/** chews-second-algorithm.test.ts - Brute-force radius comparison, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./chews-second-algorithm";

type Pt = [number, number];

function centroid(pts: Pt[]): Pt {
    let area2 = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i]!;
        const b = pts[(i + 1) % pts.length]!;
        const cross = a[0] * b[1] - b[0] * a[1];
        area2 += cross;
        cx += (a[0] + b[0]) * cross;
        cy += (a[1] + b[1]) * cross;
    }
    return [cx / (3 * area2), cy / (3 * area2)];
}

function segDist(p: Pt, a: Pt, b: Pt): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
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

describe("Chew's Second Algorithm", () => {
    it("matches brute-force minimum and maximum edge distances", () => {
        const cases: Pt[][] = [
            [
                [0, 0],
                [2, 0],
                [2, 2],
                [0, 2],
            ],
            [
                [0, 0],
                [6, 0],
                [6, 4],
                [3, 6],
                [0, 4],
            ],
            [
                [1, 1],
                [5, 0],
                [7, 3],
                [4, 6],
                [0, 4],
            ],
        ];
        for (const polygon of cases) {
            const frames = framesFor({ polygon });
            const final = frames[frames.length - 1]!;
            const c = centroid(polygon);
            const dists = polygon.map((a, i) => segDist(c, a, polygon[(i + 1) % polygon.length]!));
            const expectedInner = Math.min(...dists);
            const expectedOuter = Math.max(...dists);
            expect(final.meta.centroidX as number).toBeCloseTo(c[0], 9);
            expect(final.meta.centroidY as number).toBeCloseTo(c[1], 9);
            expect(final.meta.innerRadius as number).toBeCloseTo(expectedInner, 9);
            expect(final.meta.outerRadius as number).toBeCloseTo(expectedOuter, 9);
            expect(final.meta.innerRadius as number).toBeLessThanOrEqual(final.meta.outerRadius as number);
            for (const d of dists) {
                expect(d).toBeGreaterThanOrEqual(expectedInner - 1e-9);
                expect(d).toBeLessThanOrEqual(expectedOuter + 1e-9);
            }
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
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

    it("handles too few vertices", () => {
        const frames = framesFor({ polygon: [[0, 0], [1, 1]] });
        expect(frames.length).toBe(1);
        expect(frames[0]!.description.length).toBeGreaterThanOrEqual(10);
    });
});
