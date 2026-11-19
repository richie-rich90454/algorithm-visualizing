/**
 * ninther-quicksort.test.ts – Correctness and frame checks for Ninther Quicksort.
 */

import { describe, expect, it } from "vitest";
import nintherQuicksort from "./ninther-quicksort";

function framesOf(input: unknown) {
    return [...nintherQuicksort.run(input)];
}

function checkFrameShape(frames: ReturnType<typeof framesOf>) {
    const lines = nintherQuicksort.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lines);
        expect(frame.layout).toBe(nintherQuicksort.visualType);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const entity of frame.entities) expect(typeof entity.value).toBe("number");
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

describe("NintherQuicksort", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = framesOf(nintherQuicksort.defaultInput);
        expect(frames.length).toBeGreaterThan(3);
        expect(frames.length).toBeLessThan(200);
        checkFrameShape(frames);
    });

    it("sorts random arrays matching the reference sort", () => {
        const rand = lcg(987654321);
        for (let trial = 0; trial < 40; trial += 1) {
            const length = 1 + (rand() % 20);
            const input = Array.from({ length }, () => (rand() % 100) - 50);
            const frames = framesOf(input);
            const finalValues = frames[frames.length - 1]?.entities.map((e) => e.value as number) ?? [];
            expect(finalValues).toEqual([...input].sort((a, b) => a - b));
            for (const frame of frames) {
                const values = frame.entities.map((e) => e.value as number).sort((a, b) => a - b);
                expect(values).toEqual([...input].sort((a, b) => a - b));
            }
        }
    });

    it("handles duplicates, singletons, and reversed order", () => {
        expect(framesOf([3, 3, 1, 1, 2]).at(-1)?.entities.map((e) => e.value)).toEqual([1, 1, 2, 3, 3]);
        expect(framesOf([7]).at(-1)?.entities.map((e) => e.value)).toEqual([7]);
        expect(framesOf([6, 5, 4, 3, 2, 1]).at(-1)?.entities.map((e) => e.value)).toEqual([1, 2, 3, 4, 5, 6]);
    });
});
