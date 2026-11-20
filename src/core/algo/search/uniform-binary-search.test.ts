/** uniform-binary-search.test.ts - Brute-force search check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import uniformBinarySearch from "./uniform-binary-search";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? -1).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 999).toBeLessThan(uniformBinarySearch.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("array");
        expect(frame.meta).toBeTypeOf("object");
    });
}

function sumAll(generator: Generator<VisualFrame, void, unknown>): VisualFrame[] {
    const frames: VisualFrame[] = [];
    for (const frame of generator) {
        frames.push(frame);
        expect(frames.length).toBeLessThan(100000);
    }
    return frames;
}

function lastOccurrence(array: number[], target: number): number {
    let found = -1;
    for (let i = 0; i < array.length; i += 1) {
        if (array[i] === target) {
            found = i;
        }
    }
    return found;
}

describe("Uniform Binary Search", () => {
    it("finds the same index as a linear scan for every target", () => {
        const cases = [
            [1, 3, 5, 7, 9, 11, 13, 15, 17],
            [2, 2, 2, 2, 2],
            [4],
            [-9, -4, 0, 1, 6, 6, 12],
            [],
        ];
        for (const array of cases) {
            const targets = new Set([...array, ...array.map((value) => value - 1), 1000, -1000]);
            for (const target of targets) {
                const frames = sumAll(uniformBinarySearch.run({ array: [...array], target }));
                const final = frames[frames.length - 1];
                const expected = lastOccurrence(array, target);
                expect(final?.meta["index"]).toBe(expected);
                expect(final?.meta["found"]).toBe(expected >= 0);
            }
        }
    });

    it("emits well-formed frames and terminates on the default input", () => {
        checkFrames(sumAll(uniformBinarySearch.run(uniformBinarySearch.defaultInput)));
        const generator = uniformBinarySearch.run(uniformBinarySearch.defaultInput);
        let count = 0;
        while (generator.next().done !== true) {
            count += 1;
            expect(count).toBeLessThan(100000);
        }
    });
});
