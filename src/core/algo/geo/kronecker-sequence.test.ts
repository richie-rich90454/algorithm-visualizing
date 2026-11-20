/** kronecker-sequence.test.ts - Independent fractional-part reference and three-gap properties. */

import { describe, expect, it } from "vitest";
import mod from "./kronecker-sequence";

const ALPHA = (1 + Math.sqrt(5)) / 2;

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

function finalValues(count: number): number[] {
    const frames = framesFor({ count });
    return frames[frames.length - 1]!.meta.values as number[];
}

describe("Kronecker Sequence", () => {
    it("matches an independent fractional-part computation", () => {
        for (const count of [1, 10, 64]) {
            const actual = finalValues(count);
            expect(actual.length).toBe(count);
            for (let i = 0; i < count; i += 1) {
                const product = i * ALPHA;
                expect(actual[i]!).toBeCloseTo(product - Math.floor(product), 12);
            }
        }
    });

    it("stays in range, is distinct, and has bounded gaps", () => {
        const count = 80;
        const values = finalValues(count);
        expect(values[0]!).toBe(0);
        const seen = new Set<number>();
        for (const v of values) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
            seen.add(v);
        }
        expect(seen.size).toBe(count);
        const sorted = [...values].sort((a, b) => a - b);
        let maxGap = 0;
        for (let i = 1; i < sorted.length; i += 1) maxGap = Math.max(maxGap, sorted[i]! - sorted[i - 1]!);
        maxGap = Math.max(maxGap, 1 - sorted[sorted.length - 1]! + sorted[0]!);
        expect(maxGap).toBeLessThan(3 / count);
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
