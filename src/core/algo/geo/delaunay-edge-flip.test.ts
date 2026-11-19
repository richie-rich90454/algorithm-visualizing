/** delaunay-edge-flip.test.ts - Brute-force Delaunay edge comparison, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./delaunay-edge-flip";

type Pt = [number, number];

function circum(a: Pt, b: Pt, c: Pt): { x: number; y: number; r2: number } | null {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-12) return null;
    const a2 = a[0] * a[0] + a[1] * a[1];
    const b2 = b[0] * b[0] + b[1] * b[1];
    const c2 = c[0] * c[0] + c[1] * c[1];
    const x = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
    const y = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
    return { x, y, r2: (x - a[0]) ** 2 + (y - a[1]) ** 2 };
}

function referenceEdges(pts: Pt[]): Set<string> {
    const edges = new Set<string>();
    for (let i = 0; i < pts.length; i += 1) {
        for (let j = i + 1; j < pts.length; j += 1) {
            for (let k = j + 1; k < pts.length; k += 1) {
                const cc = circum(pts[i]!, pts[j]!, pts[k]!);
                if (!cc) continue;
                const empty = pts.every(
                    (p, m) =>
                        m === i ||
                        m === j ||
                        m === k ||
                        (p[0] - cc.x) ** 2 + (p[1] - cc.y) ** 2 >= cc.r2 - 1e-9,
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

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 800; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(800);
    return frames;
}

function finalEdges(final: ReturnType<typeof framesFor>[number]): Set<string> {
    const flat = final.meta.triangles as number[];
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

describe("Delaunay Edge Flip", () => {
    it("matches a brute-force empty-circumcircle reference", () => {
        const cases: Pt[][] = [
            [
                [0, 0],
                [4, 0],
                [4.3, 3],
                [0.2, 3.2],
                [1.6, 1.4],
            ],
            [
                [0, 0],
                [5, 0.3],
                [4.2, 4],
                [1.1, 3.4],
                [2.5, 1.2],
                [3.3, 2.1],
            ],
            [
                [0.5, 0],
                [3, 0.2],
                [5, 1],
                [4, 4],
                [2, 5],
                [0, 3],
                [2.2, 2.4],
            ],
        ];
        for (const points of cases) {
            const frames = framesFor({ points });
            const final = frames[frames.length - 1]!;
            const expected = referenceEdges(points);
            const actual = finalEdges(final);
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
