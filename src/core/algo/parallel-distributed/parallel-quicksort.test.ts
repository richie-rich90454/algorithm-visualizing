import { describe, expect, it } from "vitest";
import mod from "./parallel-quicksort";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Parallel Quick Sort", () => {
    it("sorts exactly like a reference sort while preserving the multiset", () => {
        const inputs: number[][] = [
            [7, 2, 9, 4, 1, 6, 3, 8, 5, 0],
            [5, 5, 5, 5],
            [3, 1, 2],
            [9, 8, 7, 6, 5, 4, 3, 2, 1],
            [1, 2, 3, 4, 5],
        ];
        for (const array of inputs) {
            const frames = [...mod.run({ array, workers: 3 })];
            checkFrames(frames, array.length);
            const final = frames[frames.length - 1]?.meta;
            const result = final?.["result"] as number[];
            expect(result).toEqual([...array].sort((a, b) => a - b));
            expect(Number(final?.["sorted"] === true)).toBe(1);
            const lastFrame = frames[frames.length - 1] as VisualFrame;
            expect(lastFrame.entities.every((e) => e.state === "sorted")).toBe(true);
        }
    });

    it("reports the pivot at a valid final index in each partition frame", () => {
        const input = mod.defaultInput as { array: number[]; workers: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.array.length);
        for (const frame of frames.slice(1, -1)) {
            const pivotIndex = Number(frame.meta["pivotIndex"]);
            expect(pivotIndex).toBeGreaterThanOrEqual(0);
            expect(pivotIndex).toBeLessThan(input.array.length);
            expect(Number(frame.meta["pending"])).toBeGreaterThanOrEqual(0);
        }
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
