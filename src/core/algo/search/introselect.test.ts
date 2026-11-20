/**
 * introselect.test.ts - Brute-force correctness, fallback, frame-shape,
 * and termination checks.
 */
import { describe, expect, it } from "vitest";
import mod from "./introselect";

function answerFor(array: number[], k: number, depthLimit?: number): number | null {
    const frames = [...mod.run({ array, k, ...(depthLimit === undefined ? {} : { depthLimit }) })];
    return (frames[frames.length - 1]?.meta["answer"] as number | null | undefined) ?? null;
}

describe("Introselect", () => {
    it("matches a full sort for every rank on varied inputs", () => {
        const arrays = [
            [7, 2, 9, 1, 5, 6],
            [1, 2, 3, 4, 5, 6, 7],
            [7, 6, 5, 4, 3, 2, 1],
            [4, 4, 4, 4, 4],
            [3, -1, 3, -1, 0, 3],
            [42],
            [-5, -2, -9, -1],
        ];
        for (const array of arrays) {
            const sorted = [...array].sort((a, b) => a - b);
            for (let k = 1; k <= array.length; k += 1) {
                expect(answerFor(array, k)).toBe(sorted[k - 1]);
            }
        }
    });

    it("matches a full sort on randomized inputs", () => {
        let seed = 12345;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 40; t += 1) {
            const len = 1 + (rand() % 30);
            const array = Array.from({ length: len }, () => (rand() % 61) - 30);
            const sorted = [...array].sort((a, b) => a - b);
            const k = 1 + (rand() % len);
            expect(answerFor(array, k)).toBe(sorted[k - 1]);
        }
    });

    it("uses the linear fallback correctly when the depth limit is forced", () => {
        const array = [7, 2, 9, 1, 5, 6, 8, 3];
        const sorted = [...array].sort((a, b) => a - b);
        for (let k = 1; k <= array.length; k += 1) {
            const frames = [...mod.run({ array, k, depthLimit: 0 })];
            const final = frames[frames.length - 1];
            expect(final?.meta["fallback"]).toBe(true);
            expect(final?.meta["answer"]).toBe(sorted[k - 1]);
        }
    });

    it("handles an empty array without throwing", () => {
        const frames = [...mod.run({ array: [], k: 1 })];
        expect(frames.length).toBeGreaterThan(0);
        expect(frames[frames.length - 1]?.meta["answer"]).toBeNull();
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(1);
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
            expect(typeof frame.meta["k"]).toBe("number");
        });
        const final = frames[frames.length - 1];
        expect(final?.meta["answer"]).toBe(5);
    });
});
