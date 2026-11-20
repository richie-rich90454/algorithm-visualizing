/**
 * tag-sort.test.ts - Brute-force correctness, frame-shape, and termination checks.
 */
import { describe, expect, it } from "vitest";
import mod from "./tag-sort";

function finalMeta(array: number[]) {
    const frames = [...mod.run({ array })];
    return frames[frames.length - 1]?.meta;
}

describe("Tag Sort", () => {
    it("matches a full sort on fixed inputs including duplicates and negatives", () => {
        const arrays = [
            [5, 2, 9, 1, 5, 6],
            [1],
            [],
            [3, 3, 3, 3],
            [0, -1, 5, -1, 2],
            [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
        ];
        for (const array of arrays) {
            const meta = finalMeta(array);
            expect(meta?.["sorted"]).toEqual([...array].sort((a, b) => a - b));
            expect(meta?.["work"]).toEqual([...array].sort((a, b) => a - b));
        }
    });

    it("matches a full sort on randomized inputs and produces a tag permutation", () => {
        let seed = 98765;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 40; t += 1) {
            const len = rand() % 25;
            const array = Array.from({ length: len }, () => (rand() % 41) - 20);
            const meta = finalMeta(array);
            expect(meta?.["sorted"]).toEqual([...array].sort((a, b) => a - b));
            const tags = meta?.["tags"] as number[];
            expect([...tags].sort((a, b) => a - b)).toEqual(Array.from({ length: len }, (_, i) => i));
        }
    });

    it("keeps equal keys stable in the tag mapping", () => {
        const array = [5, 1, 5, 1, 5];
        const meta = finalMeta(array);
        const tags = meta?.["tags"] as number[];
        const firstFive = tags[0] as number;
        const secondFive = tags[2] as number;
        const thirdFive = tags[4] as number;
        expect(firstFive).toBeLessThan(secondFive);
        expect(secondFive).toBeLessThan(thirdFive);
        expect(meta?.["sorted"]).toEqual([1, 1, 5, 5, 5]);
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const n = (mod.defaultInput as { array: number[] }).array.length;
        expect(frames.length).toBe(2 * n + 3);
        expect(frames.length).toBeLessThan(60);
        const lines = (mod.pseudocode ?? []).length;
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber as number).toBeLessThan(lines);
            expect(frame.layout).toBe("array");
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(Array.isArray(frame.meta["tags"])).toBe(true);
        });
    });
});
