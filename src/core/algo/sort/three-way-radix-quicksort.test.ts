import { describe, expect, it } from "vitest";
import module from "./three-way-radix-quicksort";

function framesFor(array: number[]) {
    return [...module.run({ array })];
}

function sortedResult(array: number[]): number[] {
    const frames = framesFor(array);
    return frames[frames.length - 1]!.entities.map((e) => e.value as number);
}

describe("three-way-radix-quicksort", () => {
    it("sorts many random arrays including negatives and duplicates (brute force)", () => {
        let seed = 987654321;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return Math.floor(seed / 7);
        };
        for (let t = 0; t < 100; t += 1) {
            const n = 1 + (rand() % 9);
            const array = Array.from({ length: n }, () => (rand() % 2000) - 1000);
            expect(sortedResult(array)).toEqual([...array].sort((a, b) => a - b));
        }
        expect(sortedResult([5, 5, 5, 5])).toEqual([5, 5, 5, 5]);
        expect(sortedResult([])).toEqual([]);
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = framesFor([170, 45, 75, 90, 802, 24, 2, 66]);
        expect(frames.length).toBeGreaterThan(3);
        const maxLine = module.pseudocode!.length - 1;
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThanOrEqual(0);
            expect(frame.edges).toEqual([]);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThanOrEqual(maxLine);
            expect(frame.layout).toBe("array");
            expect(frame.meta).toHaveProperty("partitions");
            expect(frame.meta).toHaveProperty("swaps");
        });
        expect(sortedResult([170, 45, 75, 90, 802, 24, 2, 66])).toEqual([2, 24, 45, 66, 75, 90, 170, 802]);
    });
});
