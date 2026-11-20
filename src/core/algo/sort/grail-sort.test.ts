/**
 * grail-sort.test.ts - Correctness and frame-shape checks for Grail Sort.
 */

import { describe, expect, it } from "vitest";
import grailSort from "./grail-sort";

function framesFor(input: number[]) {
    return [...grailSort.run(input)];
}

describe("GrailSort", () => {
    it("sorts many random arrays exactly like the reference sort", () => {
        let seed = 12345;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 60; t += 1) {
            const len = 1 + (rand() % 30);
            const arr = Array.from({ length: len }, () => rand() % 40 - 20);
            const expected = [...arr].sort((a, b) => a - b);
            const frames = framesFor(arr);
            const finalValues = frames[frames.length - 1]?.entities.map((e) => e.value);
            expect(finalValues).toEqual(expected);
        }
    });

    it("handles empty and singleton arrays without losing elements", () => {
        expect(framesFor([])[0]?.entities.map((e) => e.value)).toEqual([]);
        expect(framesFor([42]).at(-1)?.entities.map((e) => e.value)).toEqual([42]);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor([5, 3, 8, 3, 9, 1, 7, 2, 6, 4]);
        expect(frames.length).toBeGreaterThan(2);
        for (let i = 0; i < frames.length; i += 1) {
            const frame = frames[i];
            expect(frame).toBeDefined();
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.layout).toBe("array");
            expect(typeof frame.meta).toBe("object");
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(grailSort.pseudocode?.length ?? 0);
            for (const entity of frame.entities) {
                expect(entity.id).toMatch(/^bar-/);
                expect(entity.type).toBe("bar");
                expect(typeof entity.value).toBe("number");
            }
        }
    });
});
