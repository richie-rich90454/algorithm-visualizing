/** best-candidate-sampling.test.ts - Reference LCG comparison, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./best-candidate-sampling";

type Pt = [number, number];

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

/** Independent reimplementation of Mitchell's rule used as a reference. */
function reference(width: number, height: number, count: number, k: number, seed: number): Pt[] {
    const rand = lcg(seed);
    const placed: Pt[] = [[rand() * width, rand() * height]];
    while (placed.length < count) {
        let best: Pt = [0, 0];
        let bestD = -1;
        for (let c = 0; c < k; c += 1) {
            const p: Pt = [rand() * width, rand() * height];
            let d = Infinity;
            for (const q of placed) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1]));
            if (d > bestD) {
                bestD = d;
                best = p;
            }
        }
        placed.push(best);
    }
    return placed;
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

describe("Best Candidate Sampling", () => {
    it("matches an independent best-candidate construction", () => {
        for (const input of [
            { width: 10, height: 10, count: 20, candidates: 10, seed: 1 },
            { width: 5, height: 3, count: 8, candidates: 4, seed: 7 },
            { width: 20, height: 10, count: 30, candidates: 6, seed: 99 },
        ]) {
            const frames = framesFor(input);
            const final = frames[frames.length - 1]!;
            const flat = final.meta.samples as number[];
            const actual: Pt[] = [];
            for (let i = 0; i < flat.length; i += 2) actual.push([flat[i]!, flat[i + 1]!]);
            const expected = reference(
                input.width,
                input.height,
                input.count,
                input.candidates,
                input.seed,
            );
            expect(actual.length).toBe(expected.length);
            for (let i = 0; i < expected.length; i += 1) {
                expect(actual[i]![0]).toBeCloseTo(expected[i]![0], 9);
                expect(actual[i]![1]).toBeCloseTo(expected[i]![1], 9);
            }
        }
    });

    it("keeps every sample inside the domain and spaced apart", () => {
        const frames = framesFor({ width: 10, height: 10, count: 15, candidates: 8, seed: 3 });
        const flat = frames[frames.length - 1]!.meta.samples as number[];
        const pts: Pt[] = [];
        for (let i = 0; i < flat.length; i += 2) pts.push([flat[i]!, flat[i + 1]!]);
        for (const p of pts) {
            expect(p[0]).toBeGreaterThanOrEqual(0);
            expect(p[0]).toBeLessThanOrEqual(10);
            expect(p[1]).toBeGreaterThanOrEqual(0);
            expect(p[1]).toBeLessThanOrEqual(10);
        }
        for (let i = 0; i < pts.length; i += 1) {
            for (let j = i + 1; j < pts.length; j += 1) {
                expect(Math.hypot(pts[i]![0] - pts[j]![0], pts[i]![1] - pts[j]![1])).toBeGreaterThan(0);
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
            for (const entity of frame.entities) {
                expect(entity.id.length).toBeGreaterThan(0);
                expect(Number.isFinite(entity.x)).toBe(true);
                expect(Number.isFinite(entity.y)).toBe(true);
            }
            for (const edge of frame.edges) {
                const ids = new Set(frame.entities.map((e) => e.id));
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });
});
