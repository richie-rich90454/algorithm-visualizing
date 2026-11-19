/** liang-barsky-line-clipping.test.ts - Sampling-based clipping reference and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./liang-barsky-line-clipping";

type Pt = [number, number];
interface Rect { xmin: number; xmax: number; ymin: number; ymax: number }

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 200; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(200);
    return frames;
}

/** Independent reference: densely sample t and keep the extreme inside values. */
function reference(p0: Pt, p1: Pt, rect: Rect): { accept: boolean; t0: number; t1: number } {
    const samples = 4000;
    let lo = Infinity;
    let hi = -Infinity;
    for (let s = 0; s <= samples; s += 1) {
        const t = s / samples;
        const x = p0[0] + t * (p1[0] - p0[0]);
        const y = p0[1] + t * (p1[1] - p0[1]);
        if (x >= rect.xmin - 1e-12 && x <= rect.xmax + 1e-12 && y >= rect.ymin - 1e-12 && y <= rect.ymax + 1e-12) {
            lo = Math.min(lo, t);
            hi = Math.max(hi, t);
        }
    }
    return { accept: lo <= hi, t0: lo, t1: hi };
}

const CASES: Array<{ p0: Pt; p1: Pt; rect: Rect }> = [
    { p0: [-2, -1], p1: [3, 2], rect: { xmin: 0, xmax: 2, ymin: 0, ymax: 2 } },
    { p0: [0.5, 0.5], p1: [1.5, 1.5], rect: { xmin: 0, xmax: 2, ymin: 0, ymax: 2 } },
    { p0: [-3, 5], p1: [-1, 4], rect: { xmin: 0, xmax: 2, ymin: 0, ymax: 2 } },
    { p0: [0, 0], p1: [2, 2], rect: { xmin: 0, xmax: 2, ymin: 0, ymax: 2 } },
    { p0: [5, 1], p1: [-1, 1], rect: { xmin: 0, xmax: 2, ymin: 0, ymax: 2 } },
    { p0: [1, 1], p1: [1, 1], rect: { xmin: 0, xmax: 2, ymin: 0, ymax: 2 } },
    { p0: [-1, -1], p1: [4, 0.5], rect: { xmin: 0, xmax: 3, ymin: -1, ymax: 1 } },
];

describe("Liang-Barsky Line Clipping", () => {
    it("matches dense sampling of the inside interval", () => {
        for (const input of CASES) {
            const frames = framesFor(input);
            const final = frames[frames.length - 1]!;
            const expected = reference(input.p0, input.p1, input.rect);
            expect(final.meta.accept).toBe(expected.accept);
            if (expected.accept) {
                expect(final.meta.t0 as number).toBeCloseTo(expected.t0, 3);
                expect(final.meta.t1 as number).toBeCloseTo(expected.t1, 3);
            }
        }
    });

    it("keeps clipped endpoints inside the window", () => {
        for (const input of CASES) {
            const frames = framesFor(input);
            const last = frames[frames.length - 1]!;
            const clipped = last.meta.clipped as number[];
            if (last.meta.accept) {
                expect(clipped.length).toBe(4);
                for (let i = 0; i < clipped.length; i += 2) {
                    const x = clipped[i]!;
                    const y = clipped[i + 1]!;
                    expect(x).toBeGreaterThanOrEqual(input.rect.xmin - 1e-9);
                    expect(x).toBeLessThanOrEqual(input.rect.xmax + 1e-9);
                    expect(y).toBeGreaterThanOrEqual(input.rect.ymin - 1e-9);
                    expect(y).toBeLessThanOrEqual(input.rect.ymax + 1e-9);
                }
            } else {
                expect(clipped.length).toBe(0);
            }
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBe(6);
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
