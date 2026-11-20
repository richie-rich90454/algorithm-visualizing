/**
 * parallel-prefix-scan.test.ts - Brute-force prefix comparison, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./parallel-prefix-scan";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], length: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(length);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Straightforward sequential running total used as the oracle. */
function sequentialPrefix(values: number[]): number[] {
    const result: number[] = [];
    let total = 0;
    for (const value of values) {
        total += value;
        result.push(total);
    }
    return result;
}

describe("ParallelPrefixScan", () => {
    it("matches sequential prefix sums on many inputs", () => {
        const cases: number[][] = [
            [1, 2, 3, 4, 5, 6, 7, 8],
            [5],
            [0, 0, 0, 0],
            [3, -1, 4, -1, 5, -9, 2, 6],
            [10, -10, 10, -10, 10],
            [2, 2, 2, 2, 2, 2, 2],
        ];
        for (const values of cases) {
            const frames = [...mod.run({ values })];
            checkFrames(frames, values.length);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["result"]).toEqual(sequentialPrefix(values));
            const lastFrameValues = frames[frames.length - 1]?.entities.map((e) => e.value);
            expect(lastFrameValues).toEqual(sequentialPrefix(values));
        }
    });

    it("uses logarithmic depth and reports the update count", () => {
        const values = Array.from({ length: 16 }, (_, i) => i + 1);
        const frames = [...mod.run({ values })];
        checkFrames(frames, 16);
        // One setup frame, four doubling rounds, one final frame.
        expect(frames.length).toBe(6);
        const meta = frames[frames.length - 1]?.meta;
        const expectedUpdates = [1, 2, 4, 8].reduce((total, offset) => total + (16 - offset), 0);
        expect(meta?.["updates"]).toBe(expectedUpdates);
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
