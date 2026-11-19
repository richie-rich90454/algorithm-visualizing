/** halton-sequence.test.ts - Independent radical-inverse reference, uniformity properties, frames. */

import { describe, expect, it } from "vitest";
import mod from "./halton-sequence";

/** Reference radical inverse built by literally reversing the digit string. */
function refRadicalInverse(i: number, base: number): number {
    if (i === 0) return 0;
    let digits = "";
    let x = i;
    while (x > 0) {
        digits = String(x % base) + digits;
        x = Math.floor(x / base);
    }
    let value = 0;
    let fraction = 1 / base;
    for (let k = digits.length - 1; k >= 0; k -= 1) {
        value += Number(digits[k]) * fraction;
        fraction /= base;
    }
    return value;
}

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 1000; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(1000);
    return frames;
}

function finalPoints(count: number): Array<[number, number]> {
    const frames = framesFor({ count });
    const flat = frames[frames.length - 1]!.meta.points as number[];
    const points: Array<[number, number]> = [];
    for (let i = 0; i < flat.length; i += 2) points.push([flat[i]!, flat[i + 1]!]);
    return points;
}

describe("Halton Sequence", () => {
    it("matches an independent digit-reversal radical inverse", () => {
        for (const count of [1, 5, 16, 37]) {
            const actual = finalPoints(count);
            expect(actual.length).toBe(count);
            for (let i = 0; i < count; i += 1) {
                expect(actual[i]![0]).toBeCloseTo(refRadicalInverse(i, 2), 12);
                expect(actual[i]![1]).toBeCloseTo(refRadicalInverse(i, 3), 12);
            }
        }
    });

    it("stays in range, starts at the origin, and stratifies base-2 coordinates", () => {
        const points = finalPoints(64);
        expect(points[0]!).toEqual([0, 0]);
        const seen = new Set<string>();
        for (const p of points) {
            expect(p[0]).toBeGreaterThanOrEqual(0);
            expect(p[0]).toBeLessThan(1);
            expect(p[1]).toBeGreaterThanOrEqual(0);
            expect(p[1]).toBeLessThan(1);
            seen.add(`${p[0]},${p[1]}`);
        }
        expect(seen.size).toBe(points.length);
        const firstEight = points.slice(0, 8).map((p) => p[0]).sort((a, b) => a - b);
        for (let k = 0; k < 8; k += 1) {
            expect(firstEight[k]!).toBeCloseTo(k / 8, 12);
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
            expect(frame.entities.length).toBeGreaterThan(0);
            for (const entity of frame.entities) {
                expect(Number.isFinite(entity.x)).toBe(true);
                expect(Number.isFinite(entity.y)).toBe(true);
            }
            expect(frame.edges.length).toBe(0);
        });
    });
});
