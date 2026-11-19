/**
 * sentinel-sort.test.ts – Correctness and frame checks for Sentinel Sort.
 */

import { describe, expect, it } from "vitest";
import sentinelSort from "./sentinel-sort";

function framesOf(input: unknown) {
    return [...sentinelSort.run(input)];
}

function checkFrameShape(frames: ReturnType<typeof framesOf>) {
    const lines = sentinelSort.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lines);
        expect(frame.layout).toBe(sentinelSort.visualType);
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

describe("SentinelSort", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = framesOf(sentinelSort.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        expect(frames.length).toBeLessThan(200);
        checkFrameShape(frames);
    });

    it("sorts random arrays matching the reference sort and never loses values", () => {
        const rand = lcg(24680);
        for (let trial = 0; trial < 40; trial += 1) {
            const length = 1 + (rand() % 15);
            const input = Array.from({ length }, () => (rand() % 80) - 40);
            const frames = framesOf(input);
            const finalValues = frames[frames.length - 1]?.entities.map((e) => e.value as number) ?? [];
            expect(finalValues).toEqual([...input].sort((a, b) => a - b));
            for (const frame of frames) {
                const values = frame.entities.map((e) => e.value as number).sort((a, b) => a - b);
                expect(values).toEqual([...input].sort((a, b) => a - b));
            }
        }
    });

    it("reports a sentinel strictly below the data and handles negatives", () => {
        const frames = framesOf([-3, 5, -1, 0]);
        expect(frames[0]?.meta.sentinel).toBe(-4);
        expect(frames.at(-1)?.entities.map((e) => e.value)).toEqual([-3, -1, 0, 5]);
        expect(framesOf([2, 2, 2]).at(-1)?.entities.map((e) => e.value)).toEqual([2, 2, 2]);
    });
});
