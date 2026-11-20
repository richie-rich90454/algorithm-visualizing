/**
 * cache-lirs.test.ts - Independent LIRS reference, capacity and hit-count
 * properties, scan resistance, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateLirs } from "./cache-lirs";
import type { VisualFrame } from "@/types";

/** Independent reference written with explicit loops and arrays. */
function reference(requests: number[], capacity: number, lirSize: number) {
    const last = new Map<number, number>();
    const prev = new Map<number, number>();
    let lir: number[] = [];
    let hir: number[] = [];
    const cache: number[] = [];
    const hits: boolean[] = [];
    const evicted: number[] = [];
    const demote = () => {
        while (lir.length > lirSize) {
            const block = lir[0] as number;
            lir = lir.slice(1);
            hir = hir.filter((b) => b !== block);
            hir.push(block);
        }
    };
    for (let time = 0; time < requests.length; time += 1) {
        const block = requests[time] as number;
        const lastTime = last.get(block);
        const irr = lastTime === undefined ? Number.POSITIVE_INFINITY : time - (prev.get(block) ?? 0);
        prev.set(block, lastTime ?? 0);
        last.set(block, time);
        if (lir.indexOf(block) >= 0) {
            hits.push(true);
            lir = lir.filter((b) => b !== block);
            lir.push(block);
            demote();
        } else if (hir.indexOf(block) >= 0) {
            hits.push(true);
            const bottom = lir[0];
            const bottomRecency = bottom === undefined ? Number.POSITIVE_INFINITY : time - (last.get(bottom) ?? time);
            hir = hir.filter((b) => b !== block);
            if (irr < bottomRecency) {
                lir.push(block);
                demote();
            } else {
                hir.push(block);
            }
        } else {
            hits.push(false);
            if (cache.length >= capacity) {
                let victim = hir.length > 0 ? hir[0] : lir[0];
                hir = hir.filter((b) => b !== victim);
                lir = lir.filter((b) => b !== victim);
                cache.splice(cache.indexOf(victim as number), 1);
                evicted.push(victim as number);
            }
            cache.push(block);
            hir.push(block);
        }
    }
    return { hits, evicted, cache };
}

function checkFrames(frames: VisualFrame[], blockCount: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(blockCount);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("LIRS Cache Replacement", () => {
    it("matches an independent reference on many random request streams", () => {
        let seed = 991;
        for (let trial = 0; trial < 150; trial += 1) {
            const length = 5 + (trial % 25);
            const requests: number[] = [];
            for (let i = 0; i < length; i += 1) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                requests.push(seed % 8);
            }
            const capacity = 2 + (trial % 4);
            const lirSize = 1 + (trial % capacity);
            const got = simulateLirs({ requests, capacity, lirSize });
            const expected = reference(requests, capacity, lirSize);
            expect(got.hits).toEqual(expected.hits);
            expect(got.evicted).toEqual(expected.evicted);
            expect(got.cache.slice().sort((a, b) => a - b)).toEqual(expected.cache.slice().sort((a, b) => a - b));
        }
    });

    it("never holds more blocks than the cache capacity", () => {
        const requests = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2];
        for (const capacity of [1, 2, 3, 5]) {
            const result = simulateLirs({ requests, capacity, lirSize: 1 });
            expect(result.cache.length).toBeLessThanOrEqual(capacity);
            expect(new Set(result.cache).size).toBe(result.cache.length);
        }
    });

    it("hits every repeat once the cache is large enough", () => {
        const requests = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4];
        const result = simulateLirs({ requests, capacity: 8, lirSize: 4 });
        expect(result.hitCount).toBe(5);
        expect(result.evicted.length).toBe(0);
    });

    it("keeps a repeatedly used hot block through a one-time scan", () => {
        const warmup = [0, 0, 0, 0];
        const scan = Array.from({ length: 12 }, (_v, i) => i + 10);
        const probe = [0];
        const result = simulateLirs({ requests: [...warmup, ...scan, ...probe], capacity: 4, lirSize: 1 });
        expect(result.hits[warmup.length + scan.length]).toBe(true);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 5);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
