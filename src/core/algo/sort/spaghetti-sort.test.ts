/** spaghetti-sort.test.ts - Brute-force sort check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./spaghetti-sort";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Spaghetti Sort", () => {
    it("produces the same descending order as a brute-force sort", () => {
        const cases = [
            [3, 1, 4, 1, 5, 9, 2, 6],
            [5, 5, 5],
            [-2, 0, 7, -9, 3],
            [1],
            [2, 2, 1, 3, 3],
        ];
        for (const values of cases) {
            const frames = [...mod.run({ values })];
            checkFrames(frames, values.length);
            const final = frames[frames.length - 1]?.meta["order"];
            const expected = [...values].sort((a, b) => b - a);
            expect(final).toEqual(expected);
        }
    });

    it("emits each value exactly once as a permutation", () => {
        const values = [4, 4, 2, 8, 1, 8];
        const final = [...mod.run({ values })].at(-1)?.meta["order"] as number[];
        expect([...final].sort((a, b) => a - b)).toEqual([...values].sort((a, b) => a - b));
        expect(final.length).toBe(values.length);
    });

    it("removes one strand per frame and finishes", () => {
        const values = [3, 6, 2, 9];
        const frames = [...mod.run({ values })];
        // frame 0 setup, n plucks, frame n+2 final summary
        expect(frames.length).toBe(values.length + 2);
        const counts = frames.map((f) => (f.meta["order"] as number[]).length);
        expect(counts[0]).toBe(0);
        expect(counts[counts.length - 1]).toBe(values.length);
        for (let i = 1; i < counts.length - 1; i += 1) {
            expect(counts[i]).toBe(i);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
