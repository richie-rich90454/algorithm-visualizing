/**
 * bart-model.test.ts - Brute-force corruption check, round-trip property,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { MASK_ID, bartCorrupt, bartReconstruct } from "./bart-model";
import type { VisualFrame } from "@/types";

const STATES = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

/** Independent seeded mask using the same linear congruential stream. */
function referenceMask(n: number, seed: number, ratio: number): boolean[] {
    const out: boolean[] = [];
    let s = seed >>> 0;
    for (let i = 0; i < n; i += 1) {
        const u = ((Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        out.push(u < ratio);
    }
    return out;
}

/** Independent span/corrupt computation built from per-position tests. */
function referenceCorrupt(ids: number[], seed: number, ratio: number) {
    const mask = referenceMask(ids.length, seed, ratio);
    const starts: number[] = [];
    for (let i = 0; i < ids.length; i += 1) {
        if (mask[i] && (i === 0 || !mask[i - 1])) starts.push(i);
    }
    const spans = starts.map((start) => {
        let length = 0;
        while (mask[start + length]) length += 1;
        return { start, length, tokens: ids.slice(start, start + length) };
    });
    const corrupted: number[] = [];
    for (let i = 0; i < ids.length; i += 1) {
        if (!mask[i]) corrupted.push(ids[i]);
        else if (starts.includes(i)) corrupted.push(MASK_ID);
    }
    return { corrupted, spans, mask };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) {
            expect(STATES.has(entity.state)).toBe(true);
            expect(entity.metadata).toBeDefined();
        }
    });
}

describe("BART text infilling", () => {
    it("matches an independent corruption computation", () => {
        for (let seed = 0; seed < 12; seed += 1) {
            const ids = Array.from({ length: 9 }, (_, i) => (i * 7 + seed * 3) % 17);
            const got = bartCorrupt(ids, seed, 0.4);
            const ref = referenceCorrupt(ids, seed, 0.4);
            expect(got.masked).toEqual(ref.mask);
            expect(got.spans).toEqual(ref.spans);
            expect(got.corrupted).toEqual(ref.corrupted);
        }
    });

    it("round-trips any input through corrupt then reconstruct", () => {
        for (let seed = 0; seed < 30; seed += 1) {
            const n = 1 + (seed % 11);
            const ids = Array.from({ length: n }, (_, i) => (i * 5 + seed) % 13);
            const ratio = 0.1 + (seed % 8) / 10;
            const { corrupted, spans } = bartCorrupt(ids, seed, ratio);
            expect(bartReconstruct(corrupted, spans)).toEqual(ids);
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["exact"]).toBe(true);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
