/** dewall-delaunay.test.ts - Incremental Delaunay property, brute-force reference, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./dewall-delaunay";

type Pt = [number, number];

function circum(a: Pt, b: Pt, c: Pt) {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-12) return null;
    const a2 = a[0] * a[0] + a[1] * a[1];
    const b2 = b[0] * b[0] + b[1] * b[1];
    const c2 = c[0] * c[0] + c[1] * c[1];
    const x = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
    const y = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
    return { x, y, r2: (x - a[0]) ** 2 + (y - a[1]) ** 2 };
}

function referenceEdges(pts: Pt[], indices: number[]): Set<string> {
    const edges = new Set<string>();
    for (let a = 0; a < indices.length; a += 1) {
        for (let b = a + 1; b < indices.length; b += 1) {
            for (let c = b + 1; c < indices.length; c += 1) {
                const i = indices[a]!;
                const j = indices[b]!;
                const k = indices[c]!;
                const cc = circum(pts[i]!, pts[j]!, pts[k]!);
                if (!cc) continue;
                const empty = indices.every(
                    (m) =>
                        m === i ||
                        m === j ||
                        m === k ||
                        (pts[m]![0] - cc.x) ** 2 + (pts[m]![1] - cc.y) ** 2 >= cc.r2 - 1e-9,
                );
                if (empty) {
                    for (const [u, v] of [
                        [i, j],
                        [j, k],
                        [k, i],
                    ]) {
                        edges.add(`${Math.min(u, v)}-${Math.max(u, v)}`);
                    }
                }
            }
        }
    }
    return edges;
}

function actualEdges(flat: number[]): Set<string> {
    const edges = new Set<string>();
    for (let i = 0; i + 2 < flat.length; i += 3) {
        const tri = [flat[i]!, flat[i + 1]!, flat[i + 2]!];
        for (const [u, v] of [
            [tri[0]!, tri[1]!],
            [tri[1]!, tri[2]!],
            [tri[2]!, tri[0]!],
        ]) {
            edges.add(`${Math.min(u, v)}-${Math.max(u, v)}`);
        }
    }
    return edges;
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

describe("DeWall Delaunay", () => {
    it("stays Delaunay after every arrival and matches the batch reference", () => {
        const points: Pt[] = [
            [0, 0],
            [4, 0],
            [4.3, 3],
            [0.2, 3.2],
            [1.6, 1.4],
        ];
        const frames = framesFor({ points, seed: 7 });
        const final = frames[frames.length - 1]!;
        const order = final.meta.order as number[];
        expect(order.length).toBe(points.length);
        expect(new Set(order).size).toBe(points.length);

        for (const frame of frames) {
            const inserted = frame.meta.inserted as number;
            const flat = frame.meta.triangles as number[];
            if (inserted < 3 || flat.length === 0) continue;
            const expected = referenceEdges(points, order.slice(0, inserted));
            const actual = actualEdges(flat);
            expect(actual.size).toBe(expected.size);
            for (const e of expected) expect(actual.has(e)).toBe(true);
        }
    });

    it("matches the brute-force reference for several shuffles", () => {
        const points: Pt[] = [
            [0.5, 0],
            [3, 0.2],
            [5, 1],
            [4, 4],
            [2, 5],
            [0, 3],
            [2.2, 2.4],
        ];
        for (const seed of [1, 7, 42]) {
            const frames = framesFor({ points, seed });
            const final = frames[frames.length - 1]!;
            const expected = referenceEdges(points, points.map((_, i) => i));
            const actual = actualEdges(final.meta.triangles as number[]);
            expect(actual.size).toBe(expected.size);
            for (const e of expected) expect(actual.has(e)).toBe(true);
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThanOrEqual(3);
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
});
