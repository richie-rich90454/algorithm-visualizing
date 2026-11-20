/** negative-cache.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./negative-cache";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

type Outcome = "hit" | "positive" | "negative";

function reference(keys: number[], present: number[], capacity: number): { outcomes: Outcome[]; hits: number; misses: number } {
    const presentSet = new Set(present);
    const cache: number[] = [];
    const outcomes: Outcome[] = [];
    let hits = 0;
    let misses = 0;
    for (const key of keys) {
        const found = cache.indexOf(key);
        if (found >= 0) {
            cache.splice(found, 1);
            cache.push(key);
            outcomes.push("hit");
            hits += 1;
        } else {
            misses += 1;
            outcomes.push(presentSet.has(key) ? "positive" : "negative");
            cache.push(key);
            while (cache.length > capacity) cache.shift();
        }
    }
    return { outcomes, hits, misses };
}

describe("Negative Cache", () => {
    it("matches an LRU reference on the default request stream", () => {
        const input = mod.defaultInput as { keys: number[]; present: number[]; capacity: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        const expected = reference(input.keys, input.present, input.capacity);
        expect(last?.meta["outcomes"]).toEqual(expected.outcomes);
        expect(last?.meta["hits"]).toBe(expected.hits);
        expect(last?.meta["misses"]).toBe(expected.misses);
        expect(Number(last?.meta["hits"] ?? 0) + Number(last?.meta["misses"] ?? 0)).toBe(input.keys.length);
    });

    it("matches brute force over random request streams", () => {
        let seed = 6060;
        const rand = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let trial = 0; trial < 80; trial += 1) {
            const present = Array.from({ length: rand(6) }, () => rand(8));
            const keys = Array.from({ length: 1 + rand(20) }, () => rand(8));
            const capacity = 1 + rand(5);
            const frames = [...mod.run({ keys, present, capacity })];
            const last = frames[frames.length - 1];
            const expected = reference(keys, present, capacity);
            expect(last?.meta["outcomes"]).toEqual(expected.outcomes);
            expect(last?.meta["hits"]).toBe(expected.hits);
            expect(last?.meta["misses"]).toBe(expected.misses);
            const cache = last?.meta["cache"] as Array<{ key: number; positive: boolean }>;
            expect(cache.length).toBeLessThanOrEqual(capacity);
            for (const entry of cache) expect(entry.positive).toBe(present.includes(entry.key));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
