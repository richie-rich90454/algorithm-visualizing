/**
 * tiled-merge-sort.test.ts – Correctness and frame checks for Tiled Merge Sort.
 */

import { describe, expect, it } from "vitest";
import tiledMergeSort from "./tiled-merge-sort";

function framesOf(input: unknown) {
    return [...tiledMergeSort.run(input)];
}

function checkFrameShape(frames: ReturnType<typeof framesOf>) {
    const lines = tiledMergeSort.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lines);
        expect(frame.layout).toBe(tiledMergeSort.visualType);
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

describe("TiledMergeSort", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = framesOf(tiledMergeSort.defaultInput);
        expect(frames.length).toBeGreaterThan(3);
        expect(frames.length).toBeLessThan(200);
        checkFrameShape(frames);
    });

    it("sorts random arrays for several tile sizes against the reference sort", () => {
        const rand = lcg(13579);
        for (let trial = 0; trial < 30; trial += 1) {
            const length = 1 + (rand() % 18);
            const values = Array.from({ length }, () => (rand() % 70) - 35);
            const tileSize = 1 + (rand() % 5);
            const frames = framesOf({ values, tileSize });
            const finalValues = frames[frames.length - 1]?.entities.map((e) => e.value as number) ?? [];
            expect(finalValues).toEqual([...values].sort((a, b) => a - b));
            for (const frame of frames) {
                const got = frame.entities.map((e) => e.value as number).sort((a, b) => a - b);
                expect(got).toEqual([...values].sort((a, b) => a - b));
            }
        }
    });

    it("accepts a bare array and preserves multiset on duplicates", () => {
        expect(framesOf([4, 2, 4, 1, 2]).at(-1)?.entities.map((e) => e.value)).toEqual([1, 2, 2, 4, 4]);
    });
});
