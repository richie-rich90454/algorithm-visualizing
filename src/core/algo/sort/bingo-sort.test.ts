/** bingo-sort.test.ts - Brute-force sort check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import bingoSort from "./bingo-sort";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? -1).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 999).toBeLessThan(bingoSort.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("array");
        expect(frame.meta).toBeTypeOf("object");
        frame.entities.forEach((entity) => expect(entity.type).toBe("bar"));
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

describe("Bingo Sort", () => {
    it("matches a reference sort on several inputs", () => {
        const cases = [
            [5, 3, 5, 1, 4, 1, 2, 5],
            [2, 2, 2, 2],
            [9],
            [4, 3, 2, 1],
            [7, -2, 7, 0, -2, 3, 3, 3],
            [],
        ];
        for (const input of cases) {
            const frames = sumAll(bingoSort.run([...input]));
            const final = frames[frames.length - 1];
            expect(final).toBeDefined();
            const got = final?.entities.map((entity) => Number(entity.value));
            expect(got).toEqual([...input].sort((a, b) => a - b));
        }
    });

    it("emits well-formed frames and terminates on the default input", () => {
        const frames = sumAll(bingoSort.run(bingoSort.defaultInput));
        checkFrames(frames);
        const done = bingoSort.run(bingoSort.defaultInput);
        let count = 0;
        while (done.next().done !== true) {
            count += 1;
            expect(count).toBeLessThan(100000);
        }
    });
});
