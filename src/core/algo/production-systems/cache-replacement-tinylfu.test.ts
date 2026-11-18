/**
 * cache-replacement-tinylfu.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./cache-replacement-tinylfu";
import type { VisualFrame } from "@/types";

const ROWS = 4;
const WIDTH = 32;
const PRIMES = [3, 5, 7, 11];
const SALTS = [1, 3, 5, 7];

function hash(value: number, row: number): number {
    return (Math.imul(value + 1, PRIMES[row] as number) + (SALTS[row] as number)) % WIDTH;
}

/** Reference TinyLFU policy implemented independently. */
function reference(capacity: number, accesses: number[]) {
    const sketch = Array.from({ length: ROWS }, () => new Array<number>(WIDTH).fill(0));
    const cache: number[] = [];
    const decisions: string[] = [];
    let increments = 0;
    let hits = 0;
    let misses = 0;
    let admits = 0;
    let rejects = 0;
    let evictions = 0;
    let resets = 0;
    const resetAt = 10 * capacity;
    const estimate = (key: number) =>
        Math.min(...sketch.map((row, r) => row[hash(key, r)] as number));

    for (const key of accesses) {
        for (let r = 0; r < ROWS; r += 1) {
            const row = sketch[r] as number[];
            const p = hash(key, r);
            row[p] = Math.min(15, (row[p] as number) + 1);
        }
        increments += 1;
        if (increments >= resetAt) {
            for (const row of sketch) {
                for (let i = 0; i < WIDTH; i += 1) row[i] = Math.floor((row[i] as number) / 2);
            }
            increments = 0;
            resets += 1;
        }

        const at = cache.indexOf(key);
        if (at >= 0) {
            cache.splice(at, 1);
            cache.push(key);
            hits += 1;
            decisions.push("hit");
            continue;
        }
        misses += 1;
        const candidate = estimate(key);
        if (cache.length < capacity) {
            cache.push(key);
            admits += 1;
            decisions.push("admit");
        } else {
            const victim = cache[0] as number;
            if (candidate > estimate(victim)) {
                cache.shift();
                cache.push(key);
                evictions += 1;
                admits += 1;
                decisions.push("admit");
            } else {
                rejects += 1;
                decisions.push("reject");
            }
        }
    }
    return { cache, decisions, hits, misses, admits, rejects, evictions, resets };
}

function checkFrames(frames: VisualFrame[], cells: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("TinyLFU Cache Replacement", () => {
    it("matches an independent sketch and admission policy", () => {
        const input = mod.defaultInput as { capacity: number; accesses: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.accesses.length + input.capacity);
        const expected = reference(input.capacity, input.accesses);
        const meta = frames[frames.length - 1]?.meta;
        for (const field of ["hits", "misses", "admits", "rejects", "evictions", "resets"] as const) {
            expect(meta?.[field]).toBe(expected[field]);
        }
        expect(meta?.["cache"]).toEqual(expected.cache);
        expect(meta?.["decisions"]).toEqual(expected.decisions);
    });

    it("agrees with the reference under a scan-heavy workload", () => {
        const input = { capacity: 3, accesses: [1, 1, 1, 2, 2, 3, 1, 2, 4, 5, 6, 7, 1, 1, 3] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.accesses.length + input.capacity);
        const expected = reference(input.capacity, input.accesses);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["decisions"]).toEqual(expected.decisions);
        expect(meta?.["cache"]).toEqual(expected.cache);
        expect(meta?.["resets"]).toBe(expected.resets);
    });

    it("respects decision accounting and capacity", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames) {
            const meta = frame.meta;
            const hits = meta["hits"] as number;
            const misses = meta["misses"] as number;
            const admits = meta["admits"] as number;
            const rejects = meta["rejects"] as number;
            expect(misses).toBe(admits + rejects);
            expect(hits + misses).toBe((meta["decisions"] as string[]).length);
            expect((meta["cache"] as number[]).length).toBeLessThanOrEqual(meta["capacity"] as number);
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
