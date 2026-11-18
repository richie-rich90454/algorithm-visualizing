/**
 * cache-replacement-lru.test.ts - Map-based reference, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cache-replacement-lru";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], capacity: number, accesses: number[]): void {
    expect(frames.length).toBe(accesses.length + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(accesses.length + capacity);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(Math.max(accesses.length, capacity));
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect((frame.meta["cache"] as number[]).length).toBeLessThanOrEqual(capacity);
    });
}

/** Reference cache using a Map, whose iteration order is insertion order. */
function reference(capacity: number, accesses: number[]) {
    const cache = new Map<number, true>();
    let hits = 0;
    let misses = 0;
    let evictions = 0;
    for (const key of accesses) {
        if (cache.has(key)) {
            cache.delete(key);
            cache.set(key, true);
            hits += 1;
        } else {
            misses += 1;
            if (cache.size >= capacity) {
                const oldest = cache.keys().next().value;
                if (oldest !== undefined) {
                    cache.delete(oldest);
                    evictions += 1;
                }
            }
            cache.set(key, true);
        }
    }
    return { hits, misses, evictions, cache: [...cache.keys()] };
}

describe("CacheReplacementLru", () => {
    it("matches a Map-based reference on several access streams", () => {
        const cases: Array<{ capacity: number; accesses: number[] }> = [
            { capacity: 3, accesses: [1, 2, 3, 2, 4, 1, 5, 2, 3, 4, 5] },
            { capacity: 1, accesses: [1, 2, 1, 3, 2, 2] },
            { capacity: 2, accesses: [4, 4, 4, 5, 6, 5, 6] },
            { capacity: 4, accesses: [1, 2, 3, 4, 5, 6, 7] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.capacity, testCase.accesses);
            const expected = reference(testCase.capacity, testCase.accesses);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["hits"]).toBe(expected.hits);
            expect(meta?.["misses"]).toBe(expected.misses);
            expect(meta?.["evictions"]).toBe(expected.evictions);
            expect(meta?.["cache"]).toEqual(expected.cache);
            expect(meta?.["hits"]).toBe(testCase.accesses.length - (meta?.["misses"] as number));
        }
    });

    it("reorders on a hit so the least recent item is evicted", () => {
        const frames = [...mod.run({ capacity: 3, accesses: [1, 2, 3, 2, 4] })];
        checkFrames(frames, 3, [1, 2, 3, 2, 4]);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["cache"]).toEqual([3, 2, 4]);
        expect(meta?.["evictions"]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(12);
        expect(generator.next().done).toBe(true);
    });
});
