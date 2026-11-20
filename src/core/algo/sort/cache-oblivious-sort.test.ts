/**
 * cache-oblivious-sort.test.ts - Correctness and frame-contract tests.
 */

import { describe, expect, it } from "vitest";
import cacheObliviousSort from "./cache-oblivious-sort";

function collect(input: unknown) {
    const frames = [];
    for (const frame of cacheObliviousSort.run(input)) {
        frames.push(frame);
    }
    return frames;
}

function finalValues(input: unknown): number[] {
    const frames = collect(input);
    const last = frames[frames.length - 1];
    if (!last) throw new Error("no frames");
    return last.entities.map((entity) => entity.value as number);
}

describe("Cache-Oblivious Sort", () => {
    it("matches a reference sort and preserves the multiset on the default input", () => {
        const input = (cacheObliviousSort.defaultInput as { array: number[] }).array;
        const expected = [...input].sort((a, b) => a - b);
        expect(finalValues(cacheObliviousSort.defaultInput)).toEqual(expected);
    });

    it("passes a property check on many random arrays (sorted and same multiset)", () => {
        let seed = 1234567;
        const next = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const n = 1 + Math.floor(next() * 30);
            const array = Array.from({ length: n }, () => Math.floor(next() * 41) - 20);
            const expected = [...array].sort((a, b) => a - b);
            const actual = finalValues({ array });
            expect(actual).toEqual(expected);
            expect([...actual].sort((a, b) => a - b)).toEqual([...array].sort((a, b) => a - b));
        }
    });

    it("handles empty and single-element arrays", () => {
        expect(finalValues({ array: [] })).toEqual([]);
        expect(finalValues({ array: [42] })).toEqual([42]);
    });

    it("emits well-formed VisualFrames with sequential steps and a valid final verdict", () => {
        const frames = collect(cacheObliviousSort.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        const pseudocodeLength = cacheObliviousSort.pseudocode?.length ?? 0;
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(pseudocodeLength);
            expect(frame.layout).toBe("array");
            expect(frame.edges).toEqual([]);
            expect(frame.meta).toHaveProperty("n");
            expect(frame.meta).toHaveProperty("phase");
        });
        expect(frames[frames.length - 1]?.meta.phase).toBe("done");
        expect(frames.some((frame) => frame.meta.phase === "runs")).toBe(true);
        expect(frames.some((frame) => frame.meta.phase === "merge")).toBe(true);
    });

    it("terminates cleanly", () => {
        let count = 0;
        for (const _frame of cacheObliviousSort.run(cacheObliviousSort.defaultInput)) {
            count += 1;
            expect(count).toBeLessThan(500);
        }
        expect(count).toBeGreaterThan(0);
    });
});
