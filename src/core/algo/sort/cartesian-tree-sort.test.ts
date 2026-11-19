/**
 * cartesian-tree-sort.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./cartesian-tree-sort";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.meta["sorted"])).toBe(true);
    });
}

function resultOf(values: number[]): number[] {
    const frames = [...mod.run({ values })];
    checkFrames(frames);
    const final = frames[frames.length - 1];
    return (final?.meta["sorted"] as number[]) ?? [];
}

describe("Cartesian Tree Sort", () => {
    it("matches the reference sort on fixed and duplicate-heavy inputs", () => {
        const cases: number[][] = [
            [5, 3, 8, 1, 9, 2, 7],
            [4, 4, 4, 4],
            [1, 2, 3, 4, 5],
            [5, 4, 3, 2, 1],
            [0, -3, 7, -3, 2, 0],
            [42],
        ];
        for (const values of cases) {
            expect(resultOf(values)).toEqual([...values].sort((a, b) => a - b));
        }
    });

    it("matches the reference sort on randomized inputs", () => {
        let seed = 12345;
        const rand = () => {
            seed = (1103515245 * seed + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const n = 1 + Math.floor(rand() * 12);
            const values = Array.from({ length: n }, () => Math.floor(rand() * 21) - 10);
            expect(resultOf(values)).toEqual([...values].sort((a, b) => a - b));
        }
    });

    it("handles the empty array without emitting invalid frames", () => {
        const frames = [...mod.run({ values: [] })];
        expect(frames.length).toBeGreaterThan(0);
        expect(frames[frames.length - 1]?.meta["count"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
