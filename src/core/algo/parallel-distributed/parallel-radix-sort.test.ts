/**
 * parallel-radix-sort.test.ts - Brute-force sort check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./parallel-radix-sort";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["histogram"] as number[]).length).toBe(10);
    });
}

describe("ParallelRadixSort", () => {
    it("matches Array sort on random nonnegative integers", () => {
        const sets = [
            [170, 45, 75, 90, 802, 24, 2, 66],
            [5, 3, 9, 1, 3, 7],
            [0, 0, 0],
            [999, 1, 500, 42, 7],
        ];
        for (const values of sets) {
            const frames = [...mod.run({ values, digits: 3 })];
            checkFrames(frames, values.length);
            const result = frames[frames.length - 1]?.meta["result"] as number[];
            expect(result).toEqual([...values].sort((a, b) => a - b));
        }
    });

    it("has a histogram that sums to the number of keys on counting passes", () => {
        const values = [170, 45, 75, 90, 802, 24, 2, 66];
        const frames = [...mod.run({ values, digits: 2 })];
        checkFrames(frames, values.length);
        const counting = frames.filter((f) => f.description.startsWith("Pass"));
        for (const frame of counting) {
            expect((frame.meta["histogram"] as number[]).reduce((a, b) => a + b, 0)).toBe(values.length);
        }
    });

    it("is stable in the sense that equal keys stay in sorted order", () => {
        const values = [21, 11, 21, 1];
        const frames = [...mod.run({ values, digits: 2 })];
        checkFrames(frames, values.length);
        expect(frames[frames.length - 1]?.meta["result"]).toEqual([1, 11, 21, 21]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
