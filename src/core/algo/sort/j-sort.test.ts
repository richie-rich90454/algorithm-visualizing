/**
 * j-sort.test.ts - Correctness and frame checks for J-Sort.
 */
import { describe, expect, it } from "vitest";
import module from "./j-sort";

function collectFrames(input: unknown) {
    const frames = [...module.run(input)];
    return frames;
}

function verifyFrameShapes(frames: ReturnType<typeof collectFrames>): void {
    const pseudocodeLength = module.pseudocode?.length ?? 1;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(pseudocodeLength);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("bar");
            expect(typeof entity.label).toBe("string");
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        }
    });
}

describe("J-Sort", () => {
    it("matches a reference lexicographic sort on random keys", () => {
        for (let trial = 0; trial < 60; trial += 1) {
            const n = 1 + (trial % 9);
            const values = Array.from({ length: n }, () => 10 + Math.floor(Math.random() * 90));
            const frames = collectFrames(values);
            verifyFrameShapes(frames);
            const final = frames[frames.length - 1];
            expect(final).toBeDefined();
            const actual = final?.entities.map((e) => Number(e.value)) ?? [];
            const expected = [...values].sort(
                (a, b) => String(a).localeCompare(String(b), "en"),
            );
            expect(actual).toEqual(expected);
        }
    });

    it("handles duplicates and an empty input", () => {
        const duplicateFrames = collectFrames([5, 5, 5, 5]);
        expect(duplicateFrames.length).toBeGreaterThan(1);
        expect(duplicateFrames[duplicateFrames.length - 1]?.meta.result).toEqual([5, 5, 5, 5]);
        const emptyFrames = collectFrames([]);
        expect(emptyFrames.length).toBeGreaterThan(0);
        expect(emptyFrames[emptyFrames.length - 1]?.entities).toHaveLength(0);
        verifyFrameShapes(emptyFrames);
    });

    it("terminates with sequential step numbers", () => {
        const frames = collectFrames(module.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => expect(frame.stepNumber).toBe(index));
    });
});
