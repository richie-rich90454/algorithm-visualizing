/** quadsort.test.ts - Brute-force sort check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import quadsort from "./quadsort";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? -1).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 999).toBeLessThan(quadsort.pseudocode?.length ?? 0);
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

describe("Quad Sort", () => {
    it("matches a reference sort on several inputs", () => {
        const cases = [
            [9, 2, 7, 1, 8, 3, 6, 4, 5, 0],
            [1],
            [2, 2, 2, 2, 2],
            [5, 4, 3, 2, 1],
            [8, -3, 8, 0, -3, 7, 1],
            [],
            [6, 5, 4],
            [3, 1, 2, 4, 7, 6, 5],
        ];
        for (const input of cases) {
            const frames = sumAll(quadsort.run([...input]));
            const final = frames[frames.length - 1];
            expect(final).toBeDefined();
            const got = final?.entities.map((entity) => Number(entity.value));
            expect(got).toEqual([...input].sort((a, b) => a - b));
        }
    });

    it("emits well-formed frames and terminates on the default input", () => {
        checkFrames(sumAll(quadsort.run(quadsort.defaultInput)));
        const generator = quadsort.run(quadsort.defaultInput);
        let count = 0;
        while (generator.next().done !== true) {
            count += 1;
            expect(count).toBeLessThan(100000);
        }
    });
});
