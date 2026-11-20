/** merge-sort-with-sentinel.test.ts - Brute-force sort check and frame validation. */

import { describe, expect, it } from "vitest";
import mod from "./merge-sort-with-sentinel";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities).toHaveLength(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.entities.every((e) => Number.isFinite(Number(e.value)))).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("MergeSortWithSentinel", () => {
    it("matches a reference sort on deterministic cases", () => {
        const cases = [
            [],
            [1],
            [2, 1],
            [3, 3, 3, 3],
            [6, 3, 8, 1, 7, 2, 5, 4],
            [-2, 5, -2, 0, 9, 1, 1, -7],
        ];
        for (const arr of cases) {
            const frames = [...mod.run({ values: arr })];
            checkFrames(frames, arr.length);
            const last = frames[frames.length - 1] as VisualFrame;
            expect(last.entities.map((e) => Number(e.value))).toEqual([...arr].sort((a, b) => a - b));
        }
    });

    it("actually exercises the sentinel path on the default input", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const sentinelFrames = frames.filter((f) => f.meta["sentinelUsed"] === true);
        expect(sentinelFrames.length).toBeGreaterThan(0);
        expect(sentinelFrames.every((f) => f.description.toLowerCase().includes("sentinel"))).toBe(true);
        expect(Number((frames[frames.length - 1] as VisualFrame).meta["sentinelComparisons"])).toBeGreaterThan(0);
    });

    it("keeps input immutable and terminates", () => {
        const input = { values: [5, 4, 3, 2, 1] };
        const before = [...input.values];
        const generator = mod.run(input);
        const frames = [...generator];
        expect(input.values).toEqual(before);
        expect(generator.next().done).toBe(true);
        expect(frames.length).toBeGreaterThan(0);
    });
});
