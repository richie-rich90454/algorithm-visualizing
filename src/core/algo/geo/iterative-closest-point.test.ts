/** iterative-closest-point.test.ts - Recovery of a known rigid transform and error monotonicity. */

import { describe, expect, it } from "vitest";
import mod from "./iterative-closest-point";

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

function unpack(flat: number[]): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < flat.length; i += 2) out.push([flat[i]!, flat[i + 1]!]);
    return out;
}

describe("Iterative Closest Point", () => {
    it("recovers the known rotation and translation of the demo clouds", () => {
        const frames = framesFor(mod.defaultInput);
        const final = frames[frames.length - 1]!;
        const rot = final.meta.rotation as number[];
        const translation = final.meta.translation as number[];
        expect(rot[0]!).toBeCloseTo(Math.cos(0.4), 3);
        expect(rot[3]!).toBeCloseTo(Math.cos(0.4), 3);
        expect(rot[1]!).toBeCloseTo(-Math.sin(0.4), 3);
        expect(rot[2]!).toBeCloseTo(Math.sin(0.4), 3);
        expect(translation[0]!).toBeCloseTo(1, 2);
        expect(translation[1]!).toBeCloseTo(-0.5, 2);
    });

    it("places every aligned source point onto its target", () => {
        const frames = framesFor(mod.defaultInput);
        const final = frames[frames.length - 1]!;
        const target = unpack(final.meta.target as number[]);
        const aligned = unpack(final.meta.aligned as number[]);
        expect(aligned.length).toBe(target.length);
        for (const p of aligned) {
            let best = Infinity;
            for (const q of target) best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1]));
            expect(best).toBeLessThan(0.02);
        }
        expect(final.meta.rmsd as number).toBeLessThan(0.02);
    });

    it("never increases the mean correspondence error", () => {
        const frames = framesFor(mod.defaultInput);
        const final = frames[frames.length - 1]!;
        const errors = final.meta.errors as number[];
        expect(errors.length).toBeGreaterThan(1);
        for (let i = 1; i < errors.length; i += 1) {
            expect(errors[i]!).toBeLessThanOrEqual(errors[i - 1]! + 1e-9);
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
