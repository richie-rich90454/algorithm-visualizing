import { describe, expect, it } from "vitest";
import mod from "./dichotomous-search";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Dichotomous Search", () => {
    it("returns a correct index for every key in a sorted array", () => {
        const array = [1, 3, 5, 7, 9, 11, 13, 15];
        for (const target of array) {
            const frames = [...mod.run({ array, target })];
            checkFrames(frames, array.length);
            const found = Number(frames[frames.length - 1]?.meta["found"]);
            expect(found).toBeGreaterThanOrEqual(0);
            expect(array[found]).toBe(target);
        }
    });

    it("agrees with brute force on present and absent keys", () => {
        const cases: Array<{ array: number[]; target: number }> = [
            { array: [1, 2, 3, 4, 5], target: 3 },
            { array: [1, 2, 3, 4, 5], target: 4 },
            { array: [1, 2, 3, 4, 5], target: 0 },
            { array: [1, 2, 3, 4, 5], target: 6 },
            { array: [2, 2, 2, 2], target: 2 },
            { array: [7], target: 7 },
            { array: [7], target: 8 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.array.length);
            const found = Number(frames[frames.length - 1]?.meta["found"]);
            const present = testCase.array.includes(testCase.target);
            expect(found >= 0).toBe(present);
            if (found >= 0) {
                expect(testCase.array[found]).toBe(testCase.target);
            }
        }
    });

    it("uses logarithmic steps on a long sorted array", () => {
        const array = Array.from({ length: 256 }, (_, i) => i * 2);
        const frames = [...mod.run({ array, target: 300 })];
        checkFrames(frames, array.length);
        expect(frames.length).toBeLessThan(12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
