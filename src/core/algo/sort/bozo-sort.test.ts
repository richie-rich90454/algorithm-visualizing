/** bozo-sort.test.ts - Randomized sorting correctness, frames, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./bozo-sort";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities).toHaveLength(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function values(frame: VisualFrame): number[] {
    return frame.entities.map((e) => Number(e.value));
}

describe("BozoSort", () => {
    it("sorts small arrays by random pair swaps", () => {
        const cases = [
            [2, 1],
            [3, 1, 2],
            [5, 1, 4, 2, 3],
            [4, 3, 2, 1],
            [3, 3, 1, 2],
            [1, 2, 3, 4, 5],
        ];
        for (const arr of cases) {
            const before = [...arr];
            const frames = [...mod.run({ values: arr, seed: 777, maxAttempts: 4000 })];
            checkFrames(frames, arr.length);
            expect(arr).toEqual(before);
            const last = frames[frames.length - 1] as VisualFrame;
            expect(last.meta["sorted"]).toBe(true);
            expect(values(last)).toEqual([...arr].sort((a, b) => a - b));
        }
    });

    it("handles empty and singleton inputs without spinning", () => {
        for (const arr of [[], [7]]) {
            const frames = [...mod.run({ values: arr, seed: 42, maxAttempts: 100 })];
            checkFrames(frames, arr.length);
            expect(frames[frames.length - 1]?.meta["sorted"]).toBe(true);
        }
    });

    it("terminates cleanly and reports swaps", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
        const last = frames[frames.length - 1] as VisualFrame;
        expect(Number(last.meta["swaps"])).toBeGreaterThanOrEqual(0);
        expect(Number(last.meta["attempts"])).toBeGreaterThanOrEqual(Number(last.meta["swaps"]));
    });
});
