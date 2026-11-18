/**
 * bulk-synchronous-parallel.test.ts - Scan correctness, BSP structure, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { bspPrefixScan, sequentialPrefix } from "./bulk-synchronous-parallel";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Bulk Synchronous Parallel Prefix Scan", () => {
    it("matches the sequential prefix sum on random inputs and processor counts", () => {
        let seed = 77;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const n = 1 + (rand() % 20);
            const values = Array.from({ length: n }, () => (rand() % 21) - 10);
            const processors = 1 + (rand() % 8);
            const result = bspPrefixScan(values, processors);
            expect(result.result).toEqual(sequentialPrefix(values));
            expect(result.result.length).toBe(n);
            expect(result.totals.length).toBe(result.chunks.length);
            expect(result.offsets.length).toBe(result.chunks.length);

            // Offsets are the exclusive prefix of the per-block totals.
            let running = 0;
            for (let i = 0; i < result.totals.length; i += 1) {
                expect(result.offsets[i]).toBe(running);
                running += result.totals[i]!;
            }
            // Each block is owned contiguously by exactly one processor.
            expect(result.owners.length).toBe(n);
            for (let i = 1; i < result.owners.length; i += 1) {
                expect(result.owners[i]!).toBeGreaterThanOrEqual(result.owners[i - 1]!);
            }
        }
    });

    it("uses three supersteps each ending at a barrier", () => {
        const result = bspPrefixScan([1, 2, 3, 4], 2);
        expect(result.supersteps.length).toBe(3);
        expect(result.supersteps.every((s) => s.barrier)).toBe(true);
        expect(result.supersteps.map((s) => s.index)).toEqual([1, 2, 3]);
        expect(result.supersteps[1]!.messages).toBe(2);
    });

    it("produces well-formed frames whose final answer is correct", () => {
        const input = mod.defaultInput as { values: number[]; processors: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.values.length);
        const final = frames[frames.length - 1]!;
        expect(final.meta["result"]).toEqual(sequentialPrefix(input.values));
        expect(Number(final.meta["barriers"])).toBe(3);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
