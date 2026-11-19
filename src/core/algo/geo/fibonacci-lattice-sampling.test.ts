/** fibonacci-lattice-sampling.test.ts - Independent lattice formula and uniformity properties. */

import { describe, expect, it } from "vitest";
import mod from "./fibonacci-lattice-sampling";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

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

describe("Fibonacci Lattice Sampling", () => {
    it("matches an independent golden-angle lattice construction", () => {
        for (const count of [1, 12, 60]) {
            const actual = finalPoints(count);
            expect(actual.length).toBe(count);
            for (let i = 0; i < count; i += 1) {
                const radius = Math.sqrt((i + 0.5) / count);
                const angle = i * GOLDEN_ANGLE;
                expect(actual[i]![0]).toBeCloseTo(radius * Math.cos(angle), 12);
                expect(actual[i]![1]).toBeCloseTo(radius * Math.sin(angle), 12);
            }
        }
    });

    it("lies in the unit disk, grows in radius, and is area-uniform", () => {
        const count = 400;
        const points = finalPoints(count);
        let previousRadius = -1;
        let inner = 0;
        for (const p of points) {
            const radius = Math.hypot(p[0], p[1]);
            expect(radius).toBeLessThanOrEqual(1);
            expect(radius).toBeGreaterThanOrEqual(previousRadius);
            previousRadius = radius;
            if (radius <= 0.5) inner += 1;
        }
        expect(inner / count).toBeGreaterThan(0.2);
        expect(inner / count).toBeLessThan(0.3);
        const seen = new Set(points.map((p) => `${p[0]},${p[1]}`));
        expect(seen.size).toBe(count);
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
