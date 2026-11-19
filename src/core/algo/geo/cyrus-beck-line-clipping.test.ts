/** cyrus-beck-line-clipping.test.ts - Dense sampling check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./cyrus-beck-line-clipping";

type Pt = [number, number];

function insideConvex(p: Pt, poly: Pt[]): boolean {
    for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i]!;
        const b = poly[(i + 1) % poly.length]!;
        // Counter-clockwise polygon: interior is to the left of each edge.
        const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        if (cross < -1e-9) return false;
    }
    return true;
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

function check(poly: Pt[], from: Pt, to: Pt): void {
    const frames = framesFor({ polygon: poly, from, to });
    const final = frames[frames.length - 1]!;
    const t0 = final.meta.t0 as number;
    const t1 = final.meta.t1 as number;
    const rejected = final.meta.rejected as boolean;
    const EPS = 1e-7;

    for (let s = 0; s <= 1000; s += 1) {
        const t = s / 1000;
        const p: Pt = [from[0] + t * (to[0] - from[0]), from[1] + t * (to[1] - from[1])];
        const expected = insideConvex(p, poly);
        const inInterval = !rejected && t >= t0 - EPS && t <= t1 + EPS;
        expect(inInterval).toBe(expected);
    }

    if (!rejected && t0 <= t1) {
        const a: Pt = [from[0] + t0 * (to[0] - from[0]), from[1] + t0 * (to[1] - from[1])];
        const b: Pt = [from[0] + t1 * (to[0] - from[0]), from[1] + t1 * (to[1] - from[1])];
        expect(insideConvex(a, poly)).toBe(true);
        expect(insideConvex(b, poly)).toBe(true);
    }
}

describe("Cyrus-Beck Line Clipping", () => {
    it("clips to the same interval as dense point sampling", () => {
        const square: Pt[] = [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2],
        ];
        check(square, [-1, 1], [3, 1]);
        check(square, [0.5, 0.5], [1.5, 1.5]);
        check(square, [-2, -2], [-1, -1]);
        check(
            [
                [1, 1],
                [7, 1],
                [8, 5],
                [4, 7],
                [1, 4],
            ],
            [-1, 3],
            [10, 4],
        );
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
});
