/**
 * in-place-merge-sort.test.ts – Correctness and frame checks for In-Place Merge Sort.
 */

import { describe, expect, it } from "vitest";
import inPlaceMergeSort from "./in-place-merge-sort";

function framesOf(input: unknown) {
    return [...inPlaceMergeSort.run(input)];
}

function checkFrameShape(frames: ReturnType<typeof framesOf>) {
    const lines = inPlaceMergeSort.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lines);
        expect(frame.layout).toBe(inPlaceMergeSort.visualType);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const entity of frame.entities) {
            expect(typeof entity.value).toBe("number");
            expect(entity.id).toBeTruthy();
        }
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function lcg(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state;
    };
}

describe("InPlaceMergeSort", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = framesOf(inPlaceMergeSort.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        expect(frames.length).toBeLessThan(200);
        checkFrameShape(frames);
    });

    it("sorts random arrays matching the reference sort, preserving the multiset", () => {
        const rand = lcg(12345);
        for (let trial = 0; trial < 30; trial += 1) {
            const length = 1 + (rand() % 12);
            const input = Array.from({ length }, () => (rand() % 60) - 30);
            const frames = framesOf(input);
            const finalValues = frames[frames.length - 1]?.entities.map((e) => e.value as number) ?? [];
            expect(finalValues).toEqual([...input].sort((a, b) => a - b));
            // Every frame is a permutation of the original data.
            for (const frame of frames) {
                const values = frame.entities.map((e) => e.value as number).sort((a, b) => a - b);
                expect(values).toEqual([...input].sort((a, b) => a - b));
            }
        }
    });

    it("handles already sorted and reverse sorted inputs", () => {
        expect(framesOf([1, 2, 3, 4, 5]).at(-1)?.entities.map((e) => e.value)).toEqual([1, 2, 3, 4, 5]);
        expect(framesOf([5, 4, 3, 2, 1]).at(-1)?.entities.map((e) => e.value)).toEqual([1, 2, 3, 4, 5]);
    });
});
