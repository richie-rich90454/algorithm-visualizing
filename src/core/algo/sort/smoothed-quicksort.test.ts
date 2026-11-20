import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./smoothed-quicksort";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(f.layout).toBe(module.visualType);
        expect(f.meta).toBeDefined();
    });
}

describe("Smoothed Quicksort", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("sorts varied arrays and preserves every value", () => {
        const cases: number[][] = [
            [5, 3, 8, 1, 9, 2, 7, 4, 6],
            [1, 2, 3, 4, 5],
            [5, 4, 3, 2, 1],
            [7, 7, 7, 7],
            [3, 1, 3, 1, 3],
            [],
            [42],
            [9, -3, 0, 9, -3, 7],
        ];
        for (const arr of cases) {
            const frames = [...module.run(arr)];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            const sorted = last.meta.sorted as number[];
            expect(sorted).toEqual([...arr].sort((a, b) => a - b));
            expect([...sorted].sort((a, b) => a - b)).toEqual([...arr].sort((a, b) => a - b));
        }
    });
});
