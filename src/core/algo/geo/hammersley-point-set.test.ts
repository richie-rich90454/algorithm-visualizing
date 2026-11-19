/** hammersley-point-set.test.ts - Independent radical-inverse reference, column properties, frames. */

import { describe, expect, it } from "vitest";
import mod from "./hammersley-point-set";

function refRadicalInverse2(i: number): number {
    if (i === 0) return 0;
    let digits = "";
    let x = i;
    while (x > 0) {
        digits = String(x % 2) + digits;
        x = Math.floor(x / 2);
    }
    let value = 0;
    let fraction = 0.5;
    for (let k = digits.length - 1; k >= 0; k -= 1) {
        value += Number(digits[k]) * fraction;
        fraction /= 2;
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

describe("Hammersley Point Set", () => {
    it("matches an independent digit-reversal vertical coordinate", () => {
        for (const count of [1, 8, 16, 33]) {
            const actual = finalPoints(count);
            expect(actual.length).toBe(count);
            for (let i = 0; i < count; i += 1) {
                expect(actual[i]![0]).toBeCloseTo(i / count, 12);
                expect(actual[i]![1]).toBeCloseTo(refRadicalInverse2(i), 12);
            }
        }
    });

    it("stratifies dyadic rows and keeps points inside the square", () => {
        const count = 8;
        const points = finalPoints(count);
        const yValues = points.map((p) => p[1]).sort((a, b) => a - b);
        for (let k = 0; k < count; k += 1) {
            expect(yValues[k]!).toBeCloseTo(k / count, 12);
        }
        for (const p of points) {
            expect(p[0]).toBeGreaterThanOrEqual(0);
            expect(p[0]).toBeLessThan(1);
            expect(p[1]).toBeGreaterThanOrEqual(0);
            expect(p[1]).toBeLessThan(1);
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
