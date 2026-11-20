import { describe, expect, it } from "vitest";
import module from "./natural-insertion-sort";

function framesFor(array: number[]) {
    return [...module.run({ array })];
}

function lastValues(array: number[]): number[] {
    const frames = framesFor(array);
    return frames[frames.length - 1]!.entities.map((e) => e.value as number);
}

describe("natural-insertion-sort", () => {
    it("matches the reference sort on many random arrays (brute force)", () => {
        let seed = 12345;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 120; t += 1) {
            const n = 1 + (rand() % 11);
            const array = Array.from({ length: n }, () => (rand() % 25) - 12);
            expect(lastValues(array)).toEqual([...array].sort((a, b) => a - b));
        }
        // Already-sorted input performs zero shifts.
        const sortedFrames = framesFor([1, 2, 3, 4, 5]);
        expect(sortedFrames[sortedFrames.length - 1]!.meta.shifts).toBe(0);
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = framesFor([3, 4, 2, 1, 8, 7, 9]);
        expect(frames.length).toBeGreaterThan(2);
        const maxLine = module.pseudocode!.length - 1;
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.edges).toEqual([]);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThanOrEqual(maxLine);
            expect(frame.layout).toBe("array");
            expect(frame.meta).toHaveProperty("shifts");
        });
        const values = frames[frames.length - 1]!.entities.map((e) => e.value as number);
        expect(values).toEqual([1, 2, 3, 4, 7, 8, 9]);
    });
});
