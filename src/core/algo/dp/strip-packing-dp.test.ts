/**
 * strip-packing-dp.test.ts - Independent partition brute force, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./strip-packing-dp";
import type { VisualFrame } from "@/types";

/** Backtracking feasibility: can the items fit into k strips of given capacity? */
function fits(widths: number[], capacity: number, k: number): boolean {
    const loads = new Array<number>(k).fill(0);
    const place = (index: number): boolean => {
        if (index === widths.length) return true;
        const width = widths[index] ?? 0;
        for (let b = 0; b < k; b += 1) {
            if ((loads[b] ?? 0) + width <= capacity) {
                loads[b] = (loads[b] ?? 0) + width;
                if (place(index + 1)) return true;
                loads[b] = (loads[b] ?? 0) - width;
            }
            if (loads[b] === 0) break; // symmetric empty strips
        }
        return false;
    };
    return place(0);
}

function brute(widths: number[], capacity: number): number {
    if (widths.length === 0) return 0;
    if (widths.some((w) => w > capacity)) return -1;
    for (let k = 1; k <= widths.length; k += 1) {
        if (fits(widths, capacity, k)) return k;
    }
    return -1;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    const lines = mod.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber!).toBeLessThan(lines);
        expect(frame.meta).toBeDefined();
    });
}

function answerFor(widths: number[], capacity: number): number {
    const frames = [...mod.run({ widths, capacity })];
    checkFrames(frames);
    return Number(frames[frames.length - 1]?.meta["answer"]);
}

describe("Strip Packing (Bitmask DP)", () => {
    it("matches the partition brute force on the default input", () => {
        const input = mod.defaultInput as { widths: number[]; capacity: number };
        expect(answerFor(input.widths, input.capacity)).toBe(brute(input.widths, input.capacity));
    });

    it("agrees with brute force on varied small instances", () => {
        const cases: Array<{ widths: number[]; capacity: number }> = [
            { widths: [], capacity: 5 },
            { widths: [3], capacity: 5 },
            { widths: [2, 2, 2], capacity: 5 },
            { widths: [1, 1, 1, 1, 1], capacity: 5 },
            { widths: [4, 3, 2, 1], capacity: 5 },
            { widths: [2, 3, 1, 4, 2, 3], capacity: 6 },
            { widths: [5, 5, 5], capacity: 5 },
            { widths: [2, 2, 3, 3], capacity: 4 },
        ];
        for (const testCase of cases) {
            expect(answerFor(testCase.widths, testCase.capacity)).toBe(
                brute(testCase.widths, testCase.capacity),
            );
        }
    });

    it("detects an item wider than the strip", () => {
        expect(answerFor([2, 9, 1], 5)).toBe(-1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
