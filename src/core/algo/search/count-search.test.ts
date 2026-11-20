/** count-search.test.ts - Brute-force frequency check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./count-search";

function collect(input: unknown) {
    return [...mod.run(input)];
}

function assertFrameShape(frames: ReturnType<typeof collect>): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((f, index) => {
        expect(f.stepNumber).toBe(index);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.layout).toBe("array");
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(f.meta).toBeDefined();
        expect(f.entities.every((e) => e.type === "bar")).toBe(true);
    });
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) >>> 0;
        return s / 0x100000000;
    };
}

describe("CountSearch", () => {
    it("produces well-formed frames on the default input and terminates", () => {
        const frames = collect(mod.defaultInput);
        assertFrameShape(frames);
        expect(frames.at(-1)!.meta.count).toBe(3);
    });

    it("matches a brute-force count on random sorted arrays", () => {
        const rnd = seeded(31415);
        for (let t = 0; t < 200; t += 1) {
            const n = Math.floor(rnd() * 25);
            const array = Array.from({ length: n }, () => Math.floor(rnd() * 9) - 4).sort((a, b) => a - b);
            const target = Math.floor(rnd() * 11) - 5;
            const frames = collect({ array, target });
            const last = frames.at(-1)!;
            const expected = array.filter((v) => v === target).length;
            expect(last.meta.count).toBe(expected);
            expect(last.meta.lower).toBe(array.findIndex((v) => v >= target) === -1 ? n : array.findIndex((v) => v >= target));
            expect((last.meta.upper as number) - (last.meta.lower as number)).toBe(expected);
        }
    });

    it("stays logarithmic in the number of comparisons", () => {
        const rnd = seeded(2718);
        for (let t = 0; t < 40; t += 1) {
            const n = 1 + Math.floor(rnd() * 500);
            const array = Array.from({ length: n }, (_, i) => i * 2);
            const frames = collect({ array, target: Math.floor(rnd() * n) * 2 });
            const comparisons = frames.at(-1)!.meta.comparisons as number;
            expect(comparisons).toBeLessThanOrEqual(2 * Math.ceil(Math.log2(n + 1)) + 2);
        }
    });

    it("handles an empty array and a target outside the range", () => {
        expect(collect({ array: [], target: 5 }).at(-1)!.meta.count).toBe(0);
        expect(collect({ array: [1, 2, 3], target: 99 }).at(-1)!.meta.count).toBe(0);
        expect(collect({ array: [1, 2, 3], target: -99 }).at(-1)!.meta.count).toBe(0);
    });
});
